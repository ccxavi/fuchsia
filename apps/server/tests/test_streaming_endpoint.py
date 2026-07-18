from __future__ import annotations

import json
import unittest
from contextlib import contextmanager
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.auth import (
    AuthenticatedUser,
    VerifiedTokenClaims,
    get_current_authenticated_user,
)
from app.db.session import get_db_session
from app.main import app
from app.models.user import User
from app.services.agent.openai_compat import Provider

_TEXT_PROVIDER = Provider(
    name="DeepSeek",
    base_url="https://api.deepseek.com",
    api_key="sk-test",
    model="deepseek-chat",
    flatten_content=True,
)
_VISION_PROVIDER = Provider(
    name="Gemini",
    base_url="https://gemini.test",
    api_key="gm-test",
    model="gemini-2.5-flash",
    flatten_content=False,
)


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


def _sample_frames() -> list[str]:
    return [
        'event: status\ndata: {"tool": "web_search", "label": "Searching the web"}\n\n',
        'event: token\ndata: {"text": "Wear "}\n\n',
        'event: token\ndata: {"text": "boots."}\n\n',
        'event: done\ndata: {"message": {"role": "assistant", "content": "Wear boots."},'
        ' "model": "deepseek-chat", "outfit_suggestions": []}\n\n',
    ]


class StreamEndpointTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        app.dependency_overrides[get_db_session] = lambda: None

    def tearDown(self) -> None:
        app.dependency_overrides.clear()

    def _override_auth(self) -> None:
        app.dependency_overrides[get_current_authenticated_user] = _authenticated_user

    @contextmanager
    def _patch_stream(self, **stream_kwargs):
        with patch(
            "app.v1.chat.stream_stylist_chat", **stream_kwargs
        ) as stream_mock, patch(
            "app.v1.chat.deepseek_provider", return_value=_TEXT_PROVIDER
        ), patch(
            "app.v1.chat.gemini_provider", return_value=_VISION_PROVIDER
        ):
            yield stream_mock

    def test_stream_returns_401_without_auth(self) -> None:
        response = self.client.post(
            "/api/v1/chat/stream",
            json={"messages": [{"role": "user", "content": "hi"}]},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"detail": "Authentication required."})

    def test_stream_emits_sse_frames_in_order(self) -> None:
        self._override_auth()

        with self._patch_stream(return_value=iter(_sample_frames())):
            with self.client.stream(
                "POST",
                "/api/v1/chat/stream",
                json={"messages": [{"role": "user", "content": "what should I wear?"}]},
            ) as response:
                self.assertEqual(response.status_code, 200)
                self.assertTrue(
                    response.headers["content-type"].startswith("text/event-stream")
                )
                body = "".join(response.iter_text())

        frames = [b.strip() for b in body.split("\n\n") if b.strip()]
        events = [line.split("\n")[0][len("event: "):] for line in frames]
        self.assertEqual(events, ["status", "token", "token", "done"])
        done_data = json.loads(frames[-1].split("\n")[1][len("data: "):])
        self.assertEqual(done_data["message"]["content"], "Wear boots.")

    def test_stream_forwards_request_params(self) -> None:
        self._override_auth()

        with self._patch_stream(return_value=iter(_sample_frames())) as stream_mock:
            with self.client.stream(
                "POST",
                "/api/v1/chat/stream",
                json={
                    "messages": [{"role": "user", "content": "hi"}],
                    "temperature": 0.5,
                    "latitude": 14.6,
                    "longitude": 121.0,
                },
            ) as response:
                list(response.iter_text())

        _, kwargs = stream_mock.call_args
        self.assertEqual(kwargs["temperature"], 0.5)
        self.assertEqual(kwargs["latitude"], 14.6)
        self.assertEqual(kwargs["longitude"], 121.0)
        self.assertEqual(kwargs["user_id"], _authenticated_user().user.id)
        self.assertIs(kwargs["provider"], _TEXT_PROVIDER)

    def test_stream_image_request_uses_gemini_provider(self) -> None:
        self._override_auth()

        with self._patch_stream(return_value=iter(_sample_frames())) as stream_mock:
            with self.client.stream(
                "POST",
                "/api/v1/chat/stream",
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
            ) as response:
                list(response.iter_text())

        _, kwargs = stream_mock.call_args
        self.assertIs(kwargs["provider"], _VISION_PROVIDER)

    def test_stream_rejects_empty_messages(self) -> None:
        self._override_auth()

        response = self.client.post("/api/v1/chat/stream", json={"messages": []})

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
