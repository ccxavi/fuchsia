from __future__ import annotations

import asyncio
import unittest
from typing import Any
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import HTTPException

from app.services import web_search
from app.services.web_search import search


def _response(payload: Any, *, status_code: int = 200) -> httpx.Response:
    """Build a real httpx.Response so raise_for_status behaves as in production."""
    return httpx.Response(
        status_code=status_code,
        json=payload,
        request=httpx.Request("POST", "https://api.tavily.com/search"),
    )


def _results_payload(*, answer: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "results": [
            {
                "title": "Fall 2026 color trends",
                "url": "https://example.test/trends",
                "content": "Earth tones and burgundy lead the season.",
                "score": 0.98,
            },
            {
                "title": "Runway recap",
                "url": "https://example.test/runway",
                "content": "Oversized tailoring returns.",
            },
        ]
    }
    if answer is not None:
        payload["answer"] = answer
    return payload


class WebSearchServiceTestCase(unittest.TestCase):
    """Covers the Tavily client directly; the agent tests all mock it out."""

    def setUp(self) -> None:
        # Force a key so tests are hermetic regardless of a local .env.
        patcher = patch.object(web_search.settings, "tavily_api_key", "tvly-test-key")
        patcher.start()
        self.addCleanup(patcher.stop)

    def _patch_post(self, *responses: Any) -> AsyncMock:
        """Patch httpx.AsyncClient.post to return/raise the given responses in order."""
        fake = AsyncMock(side_effect=responses)
        patcher = patch.object(httpx.AsyncClient, "post", new=fake)
        patcher.start()
        self.addCleanup(patcher.stop)
        return fake

    def test_search_returns_trimmed_results(self) -> None:
        self._patch_post(_response(_results_payload()))

        result = asyncio.run(search("fall trends"))

        self.assertEqual(result["query"], "fall trends")
        self.assertEqual(len(result["results"]), 2)
        first = result["results"][0]
        self.assertEqual(first["title"], "Fall 2026 color trends")
        self.assertEqual(first["url"], "https://example.test/trends")
        self.assertEqual(first["content"], "Earth tones and burgundy lead the season.")
        # Only the model-relevant fields are surfaced; noise like "score" is dropped.
        self.assertNotIn("score", first)

    def test_search_includes_answer_when_present(self) -> None:
        self._patch_post(_response(_results_payload(answer="Earth tones are in.")))

        result = asyncio.run(search("fall trends"))

        self.assertEqual(result["answer"], "Earth tones are in.")

    def test_search_omits_answer_when_absent(self) -> None:
        self._patch_post(_response(_results_payload()))

        result = asyncio.run(search("fall trends"))

        self.assertNotIn("answer", result)

    def test_search_sends_bearer_key_and_query(self) -> None:
        fake = self._patch_post(_response(_results_payload()))

        asyncio.run(search("black chelsea boots"))

        _, kwargs = fake.await_args
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer tvly-test-key")
        self.assertEqual(kwargs["json"]["query"], "black chelsea boots")

    def test_search_clamps_max_results_to_ceiling(self) -> None:
        fake = self._patch_post(_response(_results_payload()))

        asyncio.run(search("boots", max_results=50))

        _, kwargs = fake.await_args
        self.assertEqual(kwargs["json"]["max_results"], web_search.MAX_RESULTS_CEILING)

    def test_search_floors_max_results_at_one(self) -> None:
        fake = self._patch_post(_response(_results_payload()))

        asyncio.run(search("boots", max_results=0))

        _, kwargs = fake.await_args
        self.assertEqual(kwargs["json"]["max_results"], 1)

    def test_search_request_error_becomes_503(self) -> None:
        self._patch_post(httpx.ConnectError("no route to host"))

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(search("trends"))

        self.assertEqual(ctx.exception.status_code, 503)

    def test_search_upstream_status_propagates(self) -> None:
        self._patch_post(_response({"error": "rate limited"}, status_code=429))

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(search("trends"))

        self.assertEqual(ctx.exception.status_code, 429)

    def test_search_malformed_body_becomes_500(self) -> None:
        self._patch_post(_response({"unexpected": True}))

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(search("trends"))

        self.assertEqual(ctx.exception.status_code, 500)


class WebSearchMissingKeyTestCase(unittest.TestCase):
    def test_require_key_raises_value_error(self) -> None:
        # The missing-key ValueError surfaces before any HTTP call, so the service
        # never reaches the network without a key. The agent tool wrapper catches
        # this and degrades it to a readable error payload.
        with patch.object(web_search.settings, "tavily_api_key", None):
            with self.assertRaises(ValueError):
                asyncio.run(search("trends"))


if __name__ == "__main__":
    unittest.main()
