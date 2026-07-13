"""AI wardrobe style tips.

Generates a short list of practical style tips grounded in the clothing items a
user owns, reusing the OpenAI-compatible HTTP layer and the DeepSeek text
provider. Tips are deliberately weather- and date-independent so they can be
cached against a wardrobe fingerprint (see :func:`wardrobe_fingerprint`).
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from typing import Any

from fastapi import HTTPException, status
from pydantic import ValidationError

from app.services.agent.memory import _load_json
from app.services.agent.openai_compat import (
    build_body,
    first_choice_message,
    post_chat,
    serialize_messages,
)
from app.services.agent.providers import deepseek_provider
from app.v1.schemas import ChatMessage, StyleTip

# Kinds the client can map to an icon. Kept in sync with ``StyleTipKind`` in
# app/v1/schemas.py. Anything the model returns outside this set becomes None.
STYLE_TIP_KINDS: tuple[str, ...] = (
    "pairing",
    "color",
    "occasion",
    "care",
    "versatility",
)

# Keep the tip list short and useful; the model is asked for ~3.
MAX_TIPS = 5

_KIND_LIST = ", ".join(STYLE_TIP_KINDS)

_SYSTEM_PROMPT = (
    "You are a personal fashion stylist. Given the list of clothing items a "
    "user owns, offer a few practical, encouraging style tips grounded only in "
    "those pieces. Be specific and reference real items they own. Do not mention "
    "the weather, temperature, season, or any date — those are handled elsewhere."
)

_INSTRUCTIONS = (
    "Suggest 2 to 3 style tips based on the wardrobe below. Keep them concise. "
    'Respond with a JSON object with a single key "tips" whose value is an array '
    "of objects, each with exactly these keys:\n"
    '- "title": a short, punchy headline (max ~6 words).\n'
    '- "description": one short sentence of practical advice (max ~18 words). '
    "No filler, no preamble, no repeating the title.\n"
    f'- "kind": exactly one of [{_KIND_LIST}], choosing the best fit.\n'
    "Ground every tip in items the user actually owns. Respond with only the "
    "JSON object and nothing else."
)


def wardrobe_fingerprint(items: list[dict[str, Any]]) -> str:
    """Return a coarse sha256 fingerprint of the wardrobe's shape.

    Hashes item count, per-category counts, and the distinct set of colors — so
    small edits (renaming an item, changing its brand, toggling favorite) keep
    the same fingerprint, while adding or removing items, or shifting the
    category/color makeup, produces a new one. Deterministic regardless of the
    input order.
    """
    categories = Counter(
        (item.get("category") or "uncategorized").strip().lower() for item in items
    )
    colors = sorted(
        {
            (item.get("color") or "").strip().lower()
            for item in items
            if item.get("color")
        }
    )
    canonical = json.dumps(
        {
            "count": len(items),
            "categories": dict(sorted(categories.items())),
            "colors": colors,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def generate_style_tips(items: list[dict[str, Any]]) -> list[StyleTip]:
    """Generate style tips from the user's wardrobe items.

    A pure function of ``items`` (no DB, weather, or date) so the result can be
    cached by wardrobe fingerprint. Raises ``HTTPException(502)`` if the model
    response cannot be parsed into at least one valid tip.
    """
    wardrobe_text = _format_wardrobe(items)

    messages = [
        ChatMessage(role="system", content=_SYSTEM_PROMPT),
        ChatMessage(
            role="user",
            content=f"{_INSTRUCTIONS}\n\nWardrobe:\n{wardrobe_text}",
        ),
    ]

    provider = deepseek_provider()
    body = build_body(
        provider.model,
        serialize_messages(messages, flatten=provider.flatten_content),
        temperature=0.7,
        max_tokens=400,
        response_format={"type": "json_object"},
    )

    payload = post_chat(provider, body)
    message = first_choice_message(payload)
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not generate style tips.",
        )

    tips = _parse_tips(content)
    if not tips:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not generate style tips.",
        )
    return tips


def _format_wardrobe(items: list[dict[str, Any]]) -> str:
    """Render the wardrobe as a compact bulleted list for the prompt."""
    lines: list[str] = []
    for item in items:
        parts = [str(item.get("name") or "Unnamed item")]
        attributes = [
            f"{label}: {value}"
            for label, key in (
                ("category", "category"),
                ("color", "color"),
                ("brand", "brand"),
            )
            if (value := item.get(key))
        ]
        if attributes:
            parts.append(f"({', '.join(attributes)})")
        lines.append(f"- {' '.join(parts)}")
    return "\n".join(lines)


def _parse_tips(content: str) -> list[StyleTip]:
    """Parse and validate tips from model output, tolerating markdown fences."""
    data = _load_json(content)
    raw = data.get("tips") if isinstance(data, dict) else data
    if not isinstance(raw, list):
        return []

    tips: list[StyleTip] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        title = _clean(entry.get("title"))
        description = _clean(entry.get("description"))
        if not title or not description:
            continue
        kind = _clean(entry.get("kind"))
        if kind is not None:
            kind = kind.lower()
            if kind not in STYLE_TIP_KINDS:
                kind = None
        try:
            tip = StyleTip(title=title, description=description, kind=kind)
        except ValidationError:
            continue
        tips.append(tip)
        if len(tips) >= MAX_TIPS:
            break

    return tips


def _clean(value: Any) -> str | None:
    """Normalize a model-provided field to a non-empty string or ``None``."""
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    return cleaned or None
