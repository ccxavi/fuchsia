from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException
from pydantic import ValidationError

from app.services.agent.openai_compat import (
    Provider,
    build_body,
    first_choice_message,
    post_chat,
    serialize_messages,
)
from app.v1.schemas import ChatMessage, MemorySuggestion

MEMORY_CATEGORIES = {"preference", "fact", "event", "measurement"}
MAX_MEMORY_TOKENS = 512

MEMORY_EXTRACTION_PROMPT = (
    "You extract durable facts worth remembering about the user from a styling "
    "conversation in a fashion wardrobe app.\n"
    "\n"
    "Return ONLY a JSON array (no prose, no code fences). Each element is an object "
    '{"content": string, "category": one of "preference", "fact", "event", '
    '"measurement"}.\n'
    "\n"
    "Include only lasting, styling-relevant facts that the USER stated about "
    "themselves: style preferences and dislikes, body measurements or sizes, "
    "lifestyle facts, or upcoming events they will dress for. Exclude one-off "
    "requests, anything the assistant merely suggested, greetings, small talk, and "
    "anything sensitive that is not needed for styling.\n"
    "\n"
    "Write each content as a short neutral statement, e.g. \"Never wears heels\" or "
    '"Wears size M tops". If there is nothing worth remembering, return [].'
)


def extract_memory_suggestions(
    messages: list[ChatMessage], *, provider: Provider
) -> list[MemorySuggestion]:
    """Extract durable memory suggestions from a conversation.

    Best-effort and secondary to the chat answer: any upstream or parsing failure
    yields an empty list rather than raising, so a memory hiccup never fails the
    user's reply.
    """
    conversation = [message for message in messages if message.role != "system"]
    if not conversation:
        return []

    request_messages: list[dict[str, Any]] = [
        {"role": "system", "content": MEMORY_EXTRACTION_PROMPT},
        *serialize_messages(conversation, flatten=True),
    ]
    body = build_body(
        provider.model,
        request_messages,
        temperature=0,
        max_tokens=MAX_MEMORY_TOKENS,
        tools=None,
    )

    try:
        payload = post_chat(provider, body)
        content = first_choice_message(payload).get("content")
    except HTTPException:
        return []

    if not isinstance(content, str):
        return []

    return _parse_suggestions(content)


def _load_json(text: str) -> Any:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned[:4].lower() == "json":
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except ValueError:
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        if start != -1 and end > start:
            try:
                return json.loads(cleaned[start : end + 1])
            except ValueError:
                return None
    return None


def _parse_suggestions(text: str) -> list[MemorySuggestion]:
    data = _load_json(text)
    items = data.get("memories") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return []

    suggestions: list[MemorySuggestion] = []
    seen: set[tuple[str, str | None]] = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if not isinstance(content, str) or not content.strip():
            continue

        raw_category = item.get("category")
        category = None
        if isinstance(raw_category, str) and raw_category.strip().lower() in MEMORY_CATEGORIES:
            category = raw_category.strip().lower()

        try:
            suggestion = MemorySuggestion(content=content, category=category)
        except ValidationError:
            continue

        key = (suggestion.content.lower(), suggestion.category)
        if key in seen:
            continue
        seen.add(key)
        suggestions.append(suggestion)

    return suggestions
