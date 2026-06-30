from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.v1.schemas import ChatMessage, ChatResponse


def _build_headers() -> dict[str, str]:
    api_key = settings.require_deepseek_api_key()
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def _build_payload(
    messages: list[ChatMessage],
    *,
    temperature: float | None,
    max_tokens: int | None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": settings.deepseek_model,
        "messages": [
            {"role": message.role, "content": message.content} for message in messages
        ],
        "stream": False,
    }
    if temperature is not None:
        payload["temperature"] = temperature
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens

    return payload


def _raise_from_deepseek_response(response: httpx.Response) -> None:
    try:
        payload = response.json()
    except ValueError:
        payload = {}

    detail = "DeepSeek chat completion request failed."
    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            message = error.get("message")
            if isinstance(message, str) and message:
                detail = message
        elif isinstance(error, str) and error:
            detail = error

    raise HTTPException(status_code=response.status_code, detail=detail)


def _build_chat_response(payload: dict[str, Any]) -> ChatResponse:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="DeepSeek returned an invalid response.",
        )

    first_choice = choices[0]
    message = first_choice.get("message") if isinstance(first_choice, dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="DeepSeek returned an empty message.",
        )

    model = payload.get("model")
    usage = payload.get("usage")

    return ChatResponse(
        message=ChatMessage(role="assistant", content=content),
        model=model if isinstance(model, str) and model else settings.deepseek_model,
        usage=usage if isinstance(usage, dict) else None,
    )


def create_chat_completion(
    messages: list[ChatMessage],
    *,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> ChatResponse:
    url = f"{settings.require_deepseek_base_url()}/chat/completions"
    body = _build_payload(messages, temperature=temperature, max_tokens=max_tokens)

    try:
        with httpx.Client(timeout=60) as client:
            response = client.post(url, headers=_build_headers(), json=body)
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to reach DeepSeek.",
        ) from error

    if response.is_error:
        _raise_from_deepseek_response(response)

    try:
        payload = response.json()
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="DeepSeek returned an invalid response.",
        ) from error

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="DeepSeek returned an invalid response.",
        )

    return _build_chat_response(payload)
