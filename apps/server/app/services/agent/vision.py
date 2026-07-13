"""Vision-based clothing analysis.

Derives structured attributes (name, category, color, brand) from a clothing
photo by reusing the existing Gemini vision path and OpenAI-compatible HTTP
layer. This does not touch storage or the database — it only analyzes.
"""

from __future__ import annotations

import base64
import json
from typing import Any

from fastapi import HTTPException, status

from app.core.categories import CLOTHING_CATEGORIES
from app.services.agent.openai_compat import (
    build_body,
    first_choice_message,
    post_chat,
    serialize_messages,
)
from app.services.agent.providers import gemini_provider
from app.v1.schemas import (
    ChatMessage,
    ClothingItemAnalysis,
    ImagePart,
    ImageUrl,
    TextPart,
)

_SYSTEM_PROMPT = (
    "You are a fashion cataloguing assistant. You are given a single photo of "
    "one clothing item or accessory. Identify it and return its attributes."
)

_CATEGORY_LIST = ", ".join(CLOTHING_CATEGORIES)

_INSTRUCTIONS = (
    "Analyze the clothing item in the image and respond with a JSON object "
    "containing exactly these keys:\n"
    '- "name": a short, human-friendly label, e.g. "Blue Denim Jacket".\n'
    f'- "category": exactly one of [{_CATEGORY_LIST}], or null if none fits.\n'
    '- "color": the single dominant color as one lowercase word, or null.\n'
    '- "brand": the brand only if a logo or wordmark is clearly legible, '
    "otherwise null. Never guess a brand.\n"
    "Respond with only the JSON object and nothing else. Use null (not a "
    "guess) for anything you cannot determine confidently."
)


def analyze_clothing_image(
    image_bytes: bytes, content_type: str
) -> ClothingItemAnalysis:
    """Analyze a clothing image and return AI-derived attributes.

    Raises ``HTTPException(502)`` if the model response cannot be parsed into
    the expected structure.
    """
    data_uri = _to_data_uri(image_bytes, content_type)

    messages = [
        ChatMessage(role="system", content=_SYSTEM_PROMPT),
        ChatMessage(
            role="user",
            content=[
                TextPart(type="text", text=_INSTRUCTIONS),
                ImagePart(type="image_url", image_url=ImageUrl(url=data_uri)),
            ],
        ),
    ]

    provider = gemini_provider()
    body = build_body(
        provider.model,
        serialize_messages(messages, flatten=provider.flatten_content),
        temperature=0.0,
        max_tokens=512,
        response_format={"type": "json_object"},
        # gemini-2.5-flash is a thinking model; disable reasoning so the whole
        # token budget goes to the JSON answer (otherwise thinking can starve
        # the output, yielding empty content) and the call stays ~fast.
        reasoning_effort="none",
    )

    payload = post_chat(provider, body)
    message = first_choice_message(payload)
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not analyze image.",
        )

    parsed = _parse_json_object(content)
    return _to_analysis(parsed)


def _to_data_uri(image_bytes: bytes, content_type: str) -> str:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def _parse_json_object(content: str) -> dict[str, Any]:
    """Parse a JSON object from model output, tolerating markdown fences."""
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        # Drop an optional language hint (e.g. "json\n{...}").
        newline = cleaned.find("\n")
        if newline != -1 and " " not in cleaned[:newline]:
            cleaned = cleaned[newline + 1 :]
        cleaned = cleaned.strip()

    try:
        parsed = json.loads(cleaned)
    except (ValueError, TypeError) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not analyze image.",
        ) from error

    if not isinstance(parsed, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not analyze image.",
        )

    return parsed


def _to_analysis(parsed: dict[str, Any]) -> ClothingItemAnalysis:
    category = _clean(parsed.get("category"))
    if category is not None and category not in CLOTHING_CATEGORIES:
        category = None

    return ClothingItemAnalysis(
        name=_clean(parsed.get("name")),
        category=category,
        color=_clean(parsed.get("color")),
        brand=_clean(parsed.get("brand")),
    )


def _clean(value: Any) -> str | None:
    """Normalize a model-provided field to a non-empty string or ``None``."""
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    if not cleaned or cleaned.lower() in {"null", "none", "unknown", "n/a"}:
        return None
    return cleaned
