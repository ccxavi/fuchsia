from __future__ import annotations

import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException

from app.services.agent.openai_compat import (
    Provider,
    build_body,
    first_choice_message,
    post_chat,
    serialize_messages,
)
from app.v1.schemas import ChatMessage


def _provider() -> Provider:
    return Provider(
        name="DeepSeek",
        base_url="https://api.deepseek.com",
        api_key="sk-test",
        model="deepseek-chat",
        flatten_content=True,
    )


class SerializeMessagesTestCase(unittest.TestCase):
    def test_flattens_text_parts_to_string(self) -> None:
        messages = [
            ChatMessage(
                role="user",
                content=[
                    {"type": "text", "text": "hello "},
                    {"type": "text", "text": "world"},
                ],
            )
        ]

        serialized = serialize_messages(messages, flatten=True)

        self.assertEqual(serialized[0]["content"], "hello world")

    def test_preserves_image_parts_when_not_flattening(self) -> None:
        messages = [
            ChatMessage(
                role="user",
                content=[
                    {"type": "text", "text": "describe"},
                    {
                        "type": "image_url",
                        "image_url": {"url": "data:image/png;base64,iVBORw0KGgo="},
                    },
                ],
            )
        ]

        serialized = serialize_messages(messages, flatten=False)

        content = serialized[0]["content"]
        self.assertIsInstance(content, list)
        self.assertEqual(content[1]["type"], "image_url")


class BuildBodyTestCase(unittest.TestCase):
    def test_includes_tools_only_when_provided(self) -> None:
        message_dicts = [{"role": "user", "content": "hi"}]

        without = build_body(
            "deepseek-chat", message_dicts, temperature=0.7, max_tokens=100
        )
        self.assertNotIn("tools", without)
        self.assertFalse(without["stream"])

        tools = [{"type": "function", "function": {"name": "x"}}]
        with_tools = build_body(
            "deepseek-chat",
            message_dicts,
            temperature=None,
            max_tokens=None,
            tools=tools,
        )
        self.assertEqual(with_tools["tools"], tools)
        self.assertNotIn("temperature", with_tools)


class PostChatTestCase(unittest.TestCase):
    def test_parses_successful_response(self) -> None:
        upstream = httpx.Response(
            200,
            json={
                "model": "deepseek-chat",
                "choices": [{"message": {"role": "assistant", "content": "Hi!"}}],
            },
        )

        with patch("app.services.agent.openai_compat.httpx.Client") as client_cls:
            client = client_cls.return_value.__enter__.return_value
            client.post.return_value = upstream

            payload = post_chat(_provider(), {"model": "deepseek-chat", "messages": []})

        self.assertEqual(first_choice_message(payload)["content"], "Hi!")

    def test_raises_502_on_transport_error(self) -> None:
        with patch("app.services.agent.openai_compat.httpx.Client") as client_cls:
            client = client_cls.return_value.__enter__.return_value
            client.post.side_effect = httpx.ConnectError("boom")

            with self.assertRaises(HTTPException) as ctx:
                post_chat(_provider(), {})

        self.assertEqual(ctx.exception.status_code, 502)
        self.assertEqual(ctx.exception.detail, "Failed to reach DeepSeek.")

    def test_propagates_upstream_status(self) -> None:
        upstream = httpx.Response(401, json={"error": {"message": "Invalid API key"}})

        with patch("app.services.agent.openai_compat.httpx.Client") as client_cls:
            client = client_cls.return_value.__enter__.return_value
            client.post.return_value = upstream

            with self.assertRaises(HTTPException) as ctx:
                post_chat(_provider(), {})

        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(ctx.exception.detail, "Invalid API key")


class FirstChoiceMessageTestCase(unittest.TestCase):
    def test_raises_502_when_choices_missing(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            first_choice_message({})

        self.assertEqual(ctx.exception.status_code, 502)


if __name__ == "__main__":
    unittest.main()
