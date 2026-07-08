from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.v1.schemas import ChatMessage, ChatResponse, ImagePart, TextPart

_HTTP_TIMEOUT = 60


@dataclass(frozen=True, slots=True)
class Provider:
    """Configuration for an OpenAI-compatible chat completions provider."""

    name: str
    base_url: str
    api_key: str
    model: str
    flatten_content: bool


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


def serialize_messages(
    messages: list[ChatMessage], *, flatten: bool = False
) -> list[dict[str, Any]]:
    """Serialize public ``ChatMessage`` objects into OpenAI message dicts.

    When ``flatten`` is set, multimodal parts are collapsed to a plain string
    (for text-only providers).
    """
    serialize = flatten_text_content if flatten else _serialize_content
    return [
        {"role": message.role, "content": serialize(message.content)}
        for message in messages
    ]


def build_body(
    model: str,
    message_dicts: list[dict[str, Any]],
    *,
    temperature: float | None,
    max_tokens: int | None,
    tools: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Build an OpenAI-compatible chat completion request body.

    ``message_dicts`` must already be serialized (see :func:`serialize_messages`),
    which lets the agentic loop append raw ``assistant``/``tool`` messages between
    rounds.
    """
    payload: dict[str, Any] = {
        "model": model,
        "messages": message_dicts,
        "stream": False,
    }
    if temperature is not None:
        payload["temperature"] = temperature
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    if tools:
        payload["tools"] = tools

    return payload


def post_chat(provider: Provider, body: dict[str, Any]) -> dict[str, Any]:
    """POST a chat completion request and return the raw response payload."""
    url = f"{provider.base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {provider.api_key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            response = client.post(url, headers=headers, json=body)
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to reach {provider.name}.",
        ) from error

    if response.is_error:
        raise_from_response(response, provider=provider.name)

    try:
        payload = response.json()
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{provider.name} returned an invalid response.",
        ) from error

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{provider.name} returned an invalid response.",
        )

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


def first_choice_message(payload: dict[str, Any]) -> dict[str, Any]:
    """Return ``choices[0].message`` (may contain ``tool_calls``)."""
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Upstream returned an invalid response.",
        )

    first_choice = choices[0]
    message = first_choice.get("message") if isinstance(first_choice, dict) else None
    if not isinstance(message, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Upstream returned an invalid response.",
        )

    return message


def parse_chat_response(payload: dict[str, Any], *, fallback_model: str) -> ChatResponse:
    message = first_choice_message(payload)
    content = message.get("content")
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
