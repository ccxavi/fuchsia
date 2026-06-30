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


if __name__ == "__main__":
    unittest.main()
