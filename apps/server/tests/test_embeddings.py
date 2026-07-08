from __future__ import annotations

import unittest
from unittest.mock import patch

import httpx

from app.core.config import settings
from app.services.embeddings import (
    EMBEDDING_DIMENSIONS,
    embed_query,
    embed_texts,
)


class EmbedTextsTestCase(unittest.TestCase):
    def test_returns_empty_list_for_empty_input_without_network(self) -> None:
        with patch("app.services.embeddings.httpx.Client") as client_cls:
            result = embed_texts([])

        self.assertEqual(result, [])
        client_cls.assert_not_called()

    def test_builds_request_and_parses_vectors_in_index_order(self) -> None:
        upstream = httpx.Response(
            200,
            json={
                "data": [
                    {"embedding": [0.3, 0.4], "index": 1},
                    {"embedding": [0.1, 0.2], "index": 0},
                ]
            },
        )

        with patch.object(settings, "gemini_api_key", "gm-test"), patch.object(
            settings, "gemini_embedding_model", "gemini-embedding-001"
        ), patch("app.services.embeddings.httpx.Client") as client_cls:
            client = client_cls.return_value.__enter__.return_value
            client.post.return_value = upstream

            result = embed_texts(["first", "second"])

        # Ordered by the response index, not arrival order.
        self.assertEqual(result, [[0.1, 0.2], [0.3, 0.4]])

        _, kwargs = client.post.call_args
        body = kwargs["json"]
        self.assertEqual(body["model"], "gemini-embedding-001")
        self.assertEqual(body["input"], ["first", "second"])
        self.assertEqual(body["dimensions"], EMBEDDING_DIMENSIONS)

    def test_returns_none_on_http_error(self) -> None:
        upstream = httpx.Response(500, json={"error": {"message": "boom"}})

        with patch.object(settings, "gemini_api_key", "gm-test"), patch(
            "app.services.embeddings.httpx.Client"
        ) as client_cls:
            client = client_cls.return_value.__enter__.return_value
            client.post.return_value = upstream

            self.assertIsNone(embed_texts(["hi"]))

    def test_returns_none_on_transport_error(self) -> None:
        with patch.object(settings, "gemini_api_key", "gm-test"), patch(
            "app.services.embeddings.httpx.Client"
        ) as client_cls:
            client = client_cls.return_value.__enter__.return_value
            client.post.side_effect = httpx.ConnectError("down")

            self.assertIsNone(embed_texts(["hi"]))

    def test_returns_none_when_api_key_missing(self) -> None:
        with patch.object(settings, "gemini_api_key", None), patch(
            "app.services.embeddings.httpx.Client"
        ) as client_cls:
            result = embed_texts(["hi"])

        self.assertIsNone(result)
        client_cls.assert_not_called()

    def test_returns_none_on_count_mismatch(self) -> None:
        upstream = httpx.Response(200, json={"data": [{"embedding": [0.1], "index": 0}]})

        with patch.object(settings, "gemini_api_key", "gm-test"), patch(
            "app.services.embeddings.httpx.Client"
        ) as client_cls:
            client = client_cls.return_value.__enter__.return_value
            client.post.return_value = upstream

            self.assertIsNone(embed_texts(["a", "b"]))


class EmbedQueryTestCase(unittest.TestCase):
    def test_returns_first_vector(self) -> None:
        with patch(
            "app.services.embeddings.embed_texts", return_value=[[0.5, 0.6]]
        ) as embed_mock:
            result = embed_query("  hello  ")

        self.assertEqual(result, [0.5, 0.6])
        embed_mock.assert_called_once_with(["hello"])

    def test_returns_none_for_blank_query(self) -> None:
        with patch("app.services.embeddings.embed_texts") as embed_mock:
            self.assertIsNone(embed_query("   "))

        embed_mock.assert_not_called()

    def test_returns_none_when_embedding_fails(self) -> None:
        with patch("app.services.embeddings.embed_texts", return_value=None):
            self.assertIsNone(embed_query("hello"))


if __name__ == "__main__":
    unittest.main()
