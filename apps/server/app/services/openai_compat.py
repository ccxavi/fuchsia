from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException, status

from app.v1.schemas import ChatMessage, ChatResponse, ImagePart, TextPart


def flatten_text_content(content: str | list[Any]) -> str:
    """Collapse a text-only content parts list into a plain string.

    Used by text-only providers (e.g. DeepSeek) that expect ``content`` as a
    string rather than the OpenAI multimodal parts array.
    """
    if isinstance(content, str):
        return content

    return "".join(
        part.text for part in content if isinstance(part, TextPart)
    )


def _serialize_content(content: str | list[Any]) -> Any:
    if isinstance(content, str):
        return content

    serialized: list[dict[str, Any]] = []
    for part in content:
        if isinstance(part, TextPart):
            serialized.append({"type": "text", "text": part.text})
        elif isinstance(part, ImagePart):
            serialized.append(
                {
                    "type": "image_url",
                    "image_url": {"url": part.image_url.url},
                }
            )
    return serialized


def build_payload(
    model: str,
    messages: list[ChatMessage],
    *,
    temperature: float | None,
    max_tokens: int | None,
    flatten_content: bool = False,
) -> dict[str, Any]:
    """Build an OpenAI-compatible chat completion request body.

    When ``flatten_content`` is set, multimodal parts are collapsed to a plain
    string (for text-only providers).
    """
    serialize = flatten_text_content if flatten_content else _serialize_content
    payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": message.role, "content": serialize(message.content)}
            for message in messages
        ],
        "stream": False,
    }
    if temperature is not None:
        payload["temperature"] = temperature
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens

    return payload


def raise_from_response(response: httpx.Response, *, provider: str) -> None:
    try:
        payload = response.json()
    except ValueError:
        payload = {}

    detail = f"{provider} chat completion request failed."
    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            message = error.get("message")
            if isinstance(message, str) and message:
                detail = message
        elif isinstance(error, str) and error:
            detail = error

    raise HTTPException(status_code=response.status_code, detail=detail)


def parse_chat_response(payload: dict[str, Any], *, fallback_model: str) -> ChatResponse:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Upstream returned an invalid response.",
        )

    first_choice = choices[0]
    message = first_choice.get("message") if isinstance(first_choice, dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Upstream returned an empty message.",
        )

    model = payload.get("model")
    usage = payload.get("usage")

    return ChatResponse(
        message=ChatMessage(role="assistant", content=content),
        model=model if isinstance(model, str) and model else fallback_model,
        usage=usage if isinstance(usage, dict) else None,
    )
