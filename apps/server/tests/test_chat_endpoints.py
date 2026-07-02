from __future__ import annotations

import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.auth import (
    AuthenticatedUser,
    VerifiedTokenClaims,
    get_current_authenticated_user,
)
from app.main import app
from app.models.user import User
from app.v1.schemas import ChatMessage, ChatResponse


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


class ChatEndpointTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def _override_auth(self) -> None:
        app.dependency_overrides[get_current_authenticated_user] = _authenticated_user

    def test_chat_returns_401_without_auth(self) -> None:
        response = self.client.post(
            "/api/v1/chat",
            json={"messages": [{"role": "user", "content": "hi"}]},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"detail": "Authentication required."})

    def test_chat_returns_422_on_empty_messages(self) -> None:
        self._override_auth()

        response = self.client.post("/api/v1/chat", json={"messages": []})

        self.assertEqual(response.status_code, 422)

    def test_chat_rejects_too_small_max_tokens(self) -> None:
        self._override_auth()

        response = self.client.post(
            "/api/v1/chat",
            json={
                "messages": [{"role": "user", "content": "hi"}],
                "max_tokens": 1,
            },
        )

        self.assertEqual(response.status_code, 422)

    def test_chat_returns_completion(self) -> None:
        self._override_auth()
        completion = ChatResponse(
            message=ChatMessage(role="assistant", content="Hello there!"),
            model="deepseek-chat",
            usage={"prompt_tokens": 3, "completion_tokens": 2, "total_tokens": 5},
        )

        with patch(
            "app.v1.chat.create_chat_completion", return_value=completion
        ) as create_mock:
            response = self.client.post(
                "/api/v1/chat",
                json={
                    "messages": [{"role": "user", "content": "hi"}],
                    "temperature": 0.7,
                },
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["message"], {"role": "assistant", "content": "Hello there!"})
        self.assertEqual(body["model"], "deepseek-chat")
        self.assertEqual(body["usage"]["total_tokens"], 5)
        create_mock.assert_called_once()
        _, kwargs = create_mock.call_args
        self.assertEqual(kwargs["temperature"], 0.7)
        self.assertEqual(kwargs["max_tokens"], 1024)

    def test_chat_propagates_upstream_error(self) -> None:
        self._override_auth()

        with patch(
            "app.v1.chat.create_chat_completion",
            side_effect=HTTPException(status_code=502, detail="Failed to reach DeepSeek."),
        ):
            response = self.client.post(
                "/api/v1/chat",
                json={"messages": [{"role": "user", "content": "hi"}]},
            )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json(), {"detail": "Failed to reach DeepSeek."})

    def test_text_request_routes_to_deepseek(self) -> None:
        self._override_auth()
        completion = ChatResponse(
            message=ChatMessage(role="assistant", content="text reply"),
            model="deepseek-chat",
        )

        with patch(
            "app.v1.chat.create_chat_completion", return_value=completion
        ) as deepseek_mock, patch(
            "app.v1.chat.create_gemini_completion"
        ) as gemini_mock:
            response = self.client.post(
                "/api/v1/chat",
                json={"messages": [{"role": "user", "content": "hi"}]},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["model"], "deepseek-chat")
        deepseek_mock.assert_called_once()
        gemini_mock.assert_not_called()

    def test_image_request_routes_to_gemini(self) -> None:
        self._override_auth()
        completion = ChatResponse(
            message=ChatMessage(role="assistant", content="a cat"),
            model="gemini-2.5-flash",
        )

        with patch(
            "app.v1.chat.create_chat_completion"
        ) as deepseek_mock, patch(
            "app.v1.chat.create_gemini_completion", return_value=completion
        ) as gemini_mock:
            response = self.client.post(
                "/api/v1/chat",
                json={
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": "what is this?"},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": "data:image/png;base64,iVBORw0KGgo="
                                    },
                                },
                            ],
                        }
                    ]
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["model"], "gemini-2.5-flash")
        gemini_mock.assert_called_once()
        deepseek_mock.assert_not_called()

    def test_chat_rejects_empty_content_parts(self) -> None:
        self._override_auth()

        response = self.client.post(
            "/api/v1/chat",
            json={"messages": [{"role": "user", "content": []}]},
        )

        self.assertEqual(response.status_code, 422)


class DeepSeekServiceTestCase(unittest.TestCase):
    def _patch_settings(self):
        return patch.multiple(
            "app.services.deepseek.settings",
            deepseek_api_key="sk-test",
            deepseek_base_url="https://api.deepseek.com",
            deepseek_model="deepseek-chat",
        )

    def test_create_chat_completion_parses_response(self) -> None:
        from app.services.deepseek import create_chat_completion

        upstream = httpx.Response(
            200,
            json={
                "model": "deepseek-chat",
                "choices": [
                    {"message": {"role": "assistant", "content": "Hi!"}}
                ],
                "usage": {"total_tokens": 4},
            },
        )

        with self._patch_settings(), patch(
            "app.services.deepseek.httpx.Client"
        ) as client_cls:
            client = client_cls.return_value.__enter__.return_value
            client.post.return_value = upstream

            result = create_chat_completion(
                [ChatMessage(role="user", content="hi")],
            )

        self.assertEqual(result.message.content, "Hi!")
        self.assertEqual(result.model, "deepseek-chat")
        self.assertEqual(result.usage, {"total_tokens": 4})

    def test_create_chat_completion_raises_on_transport_error(self) -> None:
        from app.services.deepseek import create_chat_completion

        with self._patch_settings(), patch(
            "app.services.deepseek.httpx.Client"
        ) as client_cls:
            client = client_cls.return_value.__enter__.return_value
            client.post.side_effect = httpx.ConnectError("boom")

            with self.assertRaises(HTTPException) as ctx:
                create_chat_completion([ChatMessage(role="user", content="hi")])

        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(ctx.exception.detail, "Failed to reach DeepSeek.")

    def test_create_chat_completion_propagates_upstream_status(self) -> None:
        from app.services.deepseek import create_chat_completion

        upstream = httpx.Response(
            401, json={"error": {"message": "Invalid API key"}}
        )

        with self._patch_settings(), patch(
            "app.services.deepseek.httpx.Client"
        ) as client_cls:
            client = client_cls.return_value.__enter__.return_value
            client.post.return_value = upstream

            with self.assertRaises(HTTPException) as ctx:
                create_chat_completion([ChatMessage(role="user", content="hi")])

        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(ctx.exception.detail, "Invalid API key")


class GeminiServiceTestCase(unittest.TestCase):
    def _patch_settings(self):
        return patch.multiple(
            "app.services.gemini.settings",
            gemini_api_key="gm-test",
            gemini_base_url="https://generativelanguage.googleapis.com/v1beta/openai",
            gemini_model="gemini-2.5-flash",
        )

    def _image_message(self) -> ChatMessage:
        return ChatMessage(
            role="user",
            content=[
                {"type": "text", "text": "describe"},
                {
                    "type": "image_url",
                    "image_url": {"url": "data:image/png;base64,iVBORw0KGgo="},
                },
            ],
        )

    def test_create_gemini_completion_parses_response(self) -> None:
        from app.services.gemini import create_gemini_completion

        upstream = httpx.Response(
            200,
            json={
                "model": "gemini-2.5-flash",
                "choices": [
                    {"message": {"role": "assistant", "content": "A cat."}}
                ],
                "usage": {"total_tokens": 7},
            },
        )

        with self._patch_settings(), patch(
            "app.services.gemini.httpx.Client"
        ) as client_cls:
            client = client_cls.return_value.__enter__.return_value
            client.post.return_value = upstream

            result = create_gemini_completion([self._image_message()])

        self.assertEqual(result.message.content, "A cat.")
        self.assertEqual(result.model, "gemini-2.5-flash")
        self.assertEqual(result.usage, {"total_tokens": 7})

    def test_create_gemini_completion_forwards_image_parts(self) -> None:
        from app.services.gemini import create_gemini_completion

        upstream = httpx.Response(
            200,
            json={"choices": [{"message": {"role": "assistant", "content": "ok"}}]},
        )

        with self._patch_settings(), patch(
            "app.services.gemini.httpx.Client"
        ) as client_cls:
            client = client_cls.return_value.__enter__.return_value
            client.post.return_value = upstream

            create_gemini_completion([self._image_message()])

        _, kwargs = client.post.call_args
        sent_content = kwargs["json"]["messages"][0]["content"]
        self.assertIsInstance(sent_content, list)
        self.assertEqual(sent_content[1]["type"], "image_url")
        self.assertEqual(
            sent_content[1]["image_url"]["url"],
            "data:image/png;base64,iVBORw0KGgo=",
        )

    def test_create_gemini_completion_raises_on_transport_error(self) -> None:
        from app.services.gemini import create_gemini_completion

        with self._patch_settings(), patch(
            "app.services.gemini.httpx.Client"
        ) as client_cls:
            client = client_cls.return_value.__enter__.return_value
            client.post.side_effect = httpx.ConnectError("boom")

            with self.assertRaises(HTTPException) as ctx:
                create_gemini_completion([self._image_message()])

        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(ctx.exception.detail, "Failed to reach Gemini.")

    def test_create_gemini_completion_propagates_upstream_status(self) -> None:
        from app.services.gemini import create_gemini_completion

        upstream = httpx.Response(
            400, json={"error": {"message": "Invalid image"}}
        )

        with self._patch_settings(), patch(
            "app.services.gemini.httpx.Client"
        ) as client_cls:
            client = client_cls.return_value.__enter__.return_value
            client.post.return_value = upstream

            with self.assertRaises(HTTPException) as ctx:
                create_gemini_completion([self._image_message()])

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail, "Invalid image")


class DeepSeekFlattenTestCase(unittest.TestCase):
    def test_text_parts_are_flattened_to_string(self) -> None:
        from app.services.deepseek import create_chat_completion

        upstream = httpx.Response(
            200,
            json={"choices": [{"message": {"role": "assistant", "content": "ok"}}]},
        )

        with patch.multiple(
            "app.services.deepseek.settings",
            deepseek_api_key="sk-test",
            deepseek_base_url="https://api.deepseek.com",
            deepseek_model="deepseek-chat",
        ), patch("app.services.deepseek.httpx.Client") as client_cls:
            client = client_cls.return_value.__enter__.return_value
            client.post.return_value = upstream

            create_chat_completion(
                [
                    ChatMessage(
                        role="user",
                        content=[
                            {"type": "text", "text": "hello "},
                            {"type": "text", "text": "world"},
                        ],
                    )
                ]
            )

        _, kwargs = client.post.call_args
        self.assertEqual(kwargs["json"]["messages"][0]["content"], "hello world")


if __name__ == "__main__":
    unittest.main()
