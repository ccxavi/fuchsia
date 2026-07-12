from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.auth import (
    AuthenticatedUser,
    VerifiedTokenClaims,
    get_current_authenticated_user,
)
from app.main import app
from app.models.user import User
from app.services.agent.openai_compat import Provider
from app.services.agent.vision import analyze_clothing_image
from app.v1.schemas import ClothingItemAnalysis

_VISION_PROVIDER = Provider(
    name="Gemini",
    base_url="https://gemini.test",
    api_key="gm-test",
    model="gemini-2.5-flash",
    flatten_content=False,
)

_IMAGE_BYTES = b"\x89PNG\r\n\x1a\n fake image bytes"


def _authenticated_user() -> AuthenticatedUser:
    claims = VerifiedTokenClaims(
        subject="supabase-user-123",
        issuer="https://demo-project.supabase.co/auth/v1",
        expires_at=1_900_000_000,
        audience=("authenticated",),
        email="user@example.com",
        role="authenticated",
    )
    user = User(supabase_user_id="supabase-user-123", email="user@example.com")
    return AuthenticatedUser(claims=claims, user=user)


def _payload(content: str) -> dict:
    return {"choices": [{"message": {"role": "assistant", "content": content}}]}


class AnalyzeClothingImageServiceTestCase(unittest.TestCase):
    """Unit tests for the vision service (no network, provider mocked)."""

    def _run(self, content: str) -> ClothingItemAnalysis:
        with patch(
            "app.services.agent.vision.gemini_provider",
            return_value=_VISION_PROVIDER,
        ), patch(
            "app.services.agent.vision.post_chat",
            return_value=_payload(content),
        ):
            return analyze_clothing_image(_IMAGE_BYTES, "image/png")

    def test_parses_valid_json(self) -> None:
        result = self._run(
            '{"name": "Blue Denim Jacket", "category": "Outerwear", '
            '"color": "blue", "brand": "Levi\'s"}'
        )

        self.assertEqual(result.name, "Blue Denim Jacket")
        self.assertEqual(result.category, "Outerwear")
        self.assertEqual(result.color, "blue")
        self.assertEqual(result.brand, "Levi's")

    def test_coerces_off_list_category_to_none(self) -> None:
        result = self._run(
            '{"name": "Sombrero", "category": "Headgear", '
            '"color": "brown", "brand": null}'
        )

        self.assertEqual(result.name, "Sombrero")
        self.assertIsNone(result.category)
        self.assertEqual(result.color, "brown")
        self.assertIsNone(result.brand)

    def test_parses_markdown_fenced_json(self) -> None:
        result = self._run(
            '```json\n{"name": "White Tee", "category": "Tops", '
            '"color": "white", "brand": null}\n```'
        )

        self.assertEqual(result.name, "White Tee")
        self.assertEqual(result.category, "Tops")
        self.assertEqual(result.color, "white")

    def test_normalizes_string_null_and_empty_fields(self) -> None:
        result = self._run(
            '{"name": "Plain Shirt", "category": "Tops", '
            '"color": "", "brand": "unknown"}'
        )

        self.assertIsNone(result.color)
        self.assertIsNone(result.brand)

    def test_raises_502_on_malformed_output(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            self._run("I think this is a nice shirt, not JSON at all.")

        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(ctx.exception.detail, "Could not analyze image.")

    def test_sends_image_and_requests_json_object(self) -> None:
        with patch(
            "app.services.agent.vision.gemini_provider",
            return_value=_VISION_PROVIDER,
        ), patch(
            "app.services.agent.vision.post_chat",
            return_value=_payload('{"name": "X"}'),
        ) as post_mock:
            analyze_clothing_image(_IMAGE_BYTES, "image/png")

        (_provider, body), _ = post_mock.call_args
        self.assertEqual(body["response_format"], {"type": "json_object"})
        # Thinking is disabled so gemini-2.5-flash returns the JSON directly.
        self.assertEqual(body["reasoning_effort"], "none")
        # The user message carries the base64 data URI of the image.
        user_message = body["messages"][-1]
        image_part = user_message["content"][-1]
        self.assertEqual(image_part["type"], "image_url")
        self.assertTrue(
            image_part["image_url"]["url"].startswith("data:image/png;base64,")
        )


class AnalyzeClothingImageEndpointTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def _override_auth(self) -> None:
        app.dependency_overrides[get_current_authenticated_user] = _authenticated_user

    def test_returns_401_without_auth(self) -> None:
        response = self.client.post(
            "/api/v1/clothing-items/analyze",
            files={"image": ("shirt.png", _IMAGE_BYTES, "image/png")},
        )

        self.assertEqual(response.status_code, 401)

    def test_rejects_non_image_upload(self) -> None:
        self._override_auth()

        response = self.client.post(
            "/api/v1/clothing-items/analyze",
            files={"image": ("notes.txt", b"hello", "text/plain")},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "File must be an image"})

    def test_rejects_empty_image(self) -> None:
        self._override_auth()

        response = self.client.post(
            "/api/v1/clothing-items/analyze",
            files={"image": ("shirt.png", b"", "image/png")},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "Image file is empty"})

    def test_returns_analysis(self) -> None:
        self._override_auth()
        analysis = ClothingItemAnalysis(
            name="Blue Denim Jacket",
            category="Outerwear",
            color="blue",
            brand=None,
        )

        with patch(
            "app.v1.clothing_items.analyze_clothing_image",
            return_value=analysis,
        ) as analyze_mock:
            response = self.client.post(
                "/api/v1/clothing-items/analyze",
                files={"image": ("jacket.png", _IMAGE_BYTES, "image/png")},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "name": "Blue Denim Jacket",
                "category": "Outerwear",
                "color": "blue",
                "brand": None,
            },
        )
        analyze_mock.assert_called_once()
        (sent_bytes, sent_type), _ = analyze_mock.call_args
        self.assertEqual(sent_bytes, _IMAGE_BYTES)
        self.assertEqual(sent_type, "image/png")

    def test_propagates_upstream_error(self) -> None:
        self._override_auth()

        with patch(
            "app.v1.clothing_items.analyze_clothing_image",
            side_effect=HTTPException(status_code=502, detail="Could not analyze image."),
        ):
            response = self.client.post(
                "/api/v1/clothing-items/analyze",
                files={"image": ("jacket.png", _IMAGE_BYTES, "image/png")},
            )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json(), {"detail": "Could not analyze image."})


if __name__ == "__main__":
    unittest.main()
