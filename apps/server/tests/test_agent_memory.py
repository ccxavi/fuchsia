from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.services.agent.memory import (
    _parse_suggestions,
    extract_memory_suggestions,
)
from app.services.agent.openai_compat import Provider
from app.v1.schemas import ChatMessage


def _provider() -> Provider:
    return Provider(
        name="Test",
        base_url="https://example.test",
        api_key="key",
        model="test-model",
        flatten_content=True,
    )


def _payload(content: str) -> dict:
    return {"choices": [{"message": {"role": "assistant", "content": content}}]}


class ParseSuggestionsTestCase(unittest.TestCase):
    def test_parses_plain_array(self) -> None:
        result = _parse_suggestions(
            '[{"content": "Never wears heels", "category": "preference"}]'
        )

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].content, "Never wears heels")
        self.assertEqual(result[0].category, "preference")

    def test_parses_code_fenced_array(self) -> None:
        text = '```json\n[{"content": "Wears size M tops", "category": "measurement"}]\n```'

        result = _parse_suggestions(text)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].category, "measurement")

    def test_accepts_memories_object_wrapper(self) -> None:
        result = _parse_suggestions('{"memories": [{"content": "Loves linen"}]}')

        self.assertEqual(len(result), 1)
        self.assertIsNone(result[0].category)

    def test_unknown_category_becomes_none(self) -> None:
        result = _parse_suggestions('[{"content": "X", "category": "vibe"}]')

        self.assertEqual(len(result), 1)
        self.assertIsNone(result[0].category)

    def test_deduplicates(self) -> None:
        result = _parse_suggestions(
            '[{"content": "Never wears heels", "category": "preference"},'
            ' {"content": "never wears heels", "category": "preference"}]'
        )

        self.assertEqual(len(result), 1)

    def test_junk_returns_empty(self) -> None:
        self.assertEqual(_parse_suggestions("sorry, nothing to remember"), [])
        self.assertEqual(_parse_suggestions("[]"), [])
        self.assertEqual(_parse_suggestions('[{"category": "fact"}]'), [])


class ExtractMemorySuggestionsTestCase(unittest.TestCase):
    def _messages(self) -> list[ChatMessage]:
        return [
            ChatMessage(role="system", content="stylist system prompt"),
            ChatMessage(role="user", content="I never wear heels"),
        ]

    def test_returns_suggestions_from_model(self) -> None:
        with patch(
            "app.services.agent.memory.post_chat",
            return_value=_payload(
                '[{"content": "Never wears heels", "category": "preference"}]'
            ),
        ) as post_mock:
            result = extract_memory_suggestions(self._messages(), provider=_provider())

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].content, "Never wears heels")

        # System prompt is replaced with the extraction prompt; text is flattened.
        _, body = post_mock.call_args.args
        self.assertEqual(body["messages"][0]["role"], "system")
        self.assertIn("JSON", body["messages"][0]["content"])
        self.assertNotIn("tools", body)

    def test_no_conversation_skips_call(self) -> None:
        with patch("app.services.agent.memory.post_chat") as post_mock:
            result = extract_memory_suggestions(
                [ChatMessage(role="system", content="only system")],
                provider=_provider(),
            )

        self.assertEqual(result, [])
        post_mock.assert_not_called()

    def test_upstream_error_is_swallowed(self) -> None:
        with patch(
            "app.services.agent.memory.post_chat",
            side_effect=HTTPException(status_code=502, detail="boom"),
        ):
            result = extract_memory_suggestions(self._messages(), provider=_provider())

        self.assertEqual(result, [])

    def test_non_string_content_returns_empty(self) -> None:
        with patch(
            "app.services.agent.memory.post_chat",
            return_value={"choices": [{"message": {"role": "assistant", "content": None}}]},
        ):
            result = extract_memory_suggestions(self._messages(), provider=_provider())

        self.assertEqual(result, [])


if __name__ == "__main__":
    unittest.main()
