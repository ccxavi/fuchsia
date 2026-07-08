from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings

# The vector size is baked into the pgvector column, so it lives here as a
# single source of truth rather than a setting: changing it requires a new
# migration and must stay in lockstep with the column definition.
EMBEDDING_DIMENSIONS = 768

_HTTP_TIMEOUT = 60


def embed_texts(texts: list[str]) -> list[list[float]] | None:
    """Embed a batch of texts with the Gemini embedding model.

    Best-effort and secondary to whatever the caller is doing: any missing
    configuration, transport error, HTTP error, or malformed response yields
    ``None`` rather than raising, so an embedding hiccup never fails chat or the
    memory-ingest reply. An empty input returns ``[]`` without a network call.

    On success returns one vector per input text, in the same order.
    """
    if not texts:
        return []

    try:
        base_url = settings.require_gemini_base_url()
        api_key = settings.require_gemini_api_key()
    except ValueError:
        return None

    url = f"{base_url.rstrip('/')}/embeddings"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": settings.gemini_embedding_model,
        "input": texts,
        "dimensions": EMBEDDING_DIMENSIONS,
    }

    try:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            response = client.post(url, headers=headers, json=body)
    except httpx.HTTPError:
        return None

    if response.is_error:
        return None

    try:
        payload = response.json()
    except ValueError:
        return None

    return _parse_embeddings(payload, expected=len(texts))


def embed_query(text: str) -> list[float] | None:
    """Embed a single query string; ``None`` on empty text or any failure."""
    cleaned = text.strip()
    if not cleaned:
        return None

    vectors = embed_texts([cleaned])
    if not vectors:
        return None
    return vectors[0]


def _parse_embeddings(payload: Any, *, expected: int) -> list[list[float]] | None:
    """Extract ``data[i].embedding`` ordered by ``index`` from an OpenAI-compat body."""
    if not isinstance(payload, dict):
        return None

    data = payload.get("data")
    if not isinstance(data, list) or len(data) != expected:
        return None

    indexed: list[tuple[int, list[float]]] = []
    for position, item in enumerate(data):
        if not isinstance(item, dict):
            return None
        embedding = item.get("embedding")
        if not isinstance(embedding, list) or not embedding:
            return None
        vector = [float(value) for value in embedding]
        index = item.get("index")
        indexed.append((index if isinstance(index, int) else position, vector))

    indexed.sort(key=lambda pair: pair[0])
    return [vector for _, vector in indexed]
