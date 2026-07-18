from __future__ import annotations

import unittest
from typing import Any
from unittest.mock import patch

import httpx
from fastapi import HTTPException

from app.services.agent.openai_compat import Provider, build_body, stream_chat

_PROVIDER = Provider(
    name="DeepSeek",
    base_url="https://api.deepseek.com",
    api_key="sk-test",
    model="deepseek-chat",
    flatten_content=True,
)


class _FakeResponse:
    def __init__(
        self,
        lines: list[str],
        *,
        is_error: bool = False,
        status_code: int = 200,
        json_body: dict[str, Any] | None = None,
    ) -> None:
        self._lines = lines
        self.is_error = is_error
        self.status_code = status_code
        self._json = json_body or {}

    def iter_lines(self):
        return iter(self._lines)

    def read(self) -> bytes:
        return b""

    def json(self) -> dict[str, Any]:
        return self._json


class _FakeStream:
    def __init__(self, response: _FakeResponse) -> None:
        self._response = response

    def __enter__(self) -> _FakeResponse:
        return self._response

    def __exit__(self, *args: object) -> bool:
        return False


def _patch_stream(response: _FakeResponse):
    return patch.object(
        httpx.Client, "stream", new=lambda self, *a, **k: _FakeStream(response)
    )


class StreamChatTestCase(unittest.TestCase):
    def test_build_body_streaming_sets_flags(self) -> None:
        body = build_body("deepseek-chat", [], temperature=None, max_tokens=None, stream=True)

        self.assertTrue(body["stream"])
        self.assertEqual(body["stream_options"], {"include_usage": True})

    def test_build_body_non_streaming_omits_stream_options(self) -> None:
        body = build_body("deepseek-chat", [], temperature=None, max_tokens=None)

        self.assertFalse(body["stream"])
        self.assertNotIn("stream_options", body)

    def test_parses_content_and_tool_call_deltas_and_stops_on_done(self) -> None:
        lines = [
            'data: {"model":"deepseek-chat","choices":[{"index":0,"delta":{"content":"Hi"}}]}',
            "",
            'data: {"choices":[{"index":0,"delta":{"tool_calls":['
            '{"index":0,"id":"c1","function":{"name":"web_search","arguments":"{}"}}]}}]}',
            "data: [DONE]",
            'data: {"choices":[{"index":0,"delta":{"content":"unreachable"}}]}',
        ]
        with _patch_stream(_FakeResponse(lines)):
            chunks = list(stream_chat(_PROVIDER, {"stream": True}))

        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0]["choices"][0]["delta"]["content"], "Hi")
        self.assertEqual(
            chunks[1]["choices"][0]["delta"]["tool_calls"][0]["function"]["name"],
            "web_search",
        )

    def test_skips_non_data_lines_and_bad_json(self) -> None:
        lines = [
            ": keep-alive comment",
            "event: message",
            "data: not-json",
            'data: {"choices":[{"index":0,"delta":{"content":"ok"}}]}',
        ]
        with _patch_stream(_FakeResponse(lines)):
            chunks = list(stream_chat(_PROVIDER, {"stream": True}))

        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0]["choices"][0]["delta"]["content"], "ok")

    def test_upstream_error_status_is_surfaced(self) -> None:
        response = _FakeResponse(
            [],
            is_error=True,
            status_code=429,
            json_body={"error": {"message": "rate limited"}},
        )
        with _patch_stream(response):
            with self.assertRaises(HTTPException) as ctx:
                list(stream_chat(_PROVIDER, {"stream": True}))

        self.assertEqual(ctx.exception.status_code, 429)
        self.assertEqual(ctx.exception.detail, "rate limited")

    def test_transport_error_becomes_502(self) -> None:
        def _raise(self, *a, **k):
            raise httpx.ConnectError("no route")

        with patch.object(httpx.Client, "stream", new=_raise):
            with self.assertRaises(HTTPException) as ctx:
                list(stream_chat(_PROVIDER, {"stream": True}))

        self.assertEqual(ctx.exception.status_code, 502)


if __name__ == "__main__":
    unittest.main()
