from __future__ import annotations

import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.services.openai_compat import (
    build_payload,
    parse_chat_response,
    raise_from_response,
)
from app.v1.schemas import ChatMessage, ChatResponse


def _build_headers() -> dict[str, str]:
    api_key = settings.require_gemini_api_key()
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def create_gemini_completion(
    messages: list[ChatMessage],
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> ChatResponse:
    url = f"{settings.require_gemini_base_url()}/chat/completions"
    body = build_payload(
        settings.gemini_model,
        messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    try:
        with httpx.Client(timeout=60) as client:
            response = client.post(url, headers=_build_headers(), json=body)
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to reach Gemini.",
        ) from error

    if response.is_error:
        raise_from_response(response, provider="Gemini")

    try:
        payload = response.json()
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gemini returned an invalid response.",
        ) from error

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Gemini returned an invalid response.",
        )

    return parse_chat_response(payload, fallback_model=settings.gemini_model)
