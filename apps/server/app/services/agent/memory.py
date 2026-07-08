from __future__ import annotations

import json
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.memory import Memory
from app.v1.schemas import MemorySuggestion

MEMORY_CATEGORIES = {"preference", "fact", "event", "measurement"}


def drop_stored_suggestions(
    db: Session, user_id: str, suggestions: list[MemorySuggestion]
) -> list[MemorySuggestion]:
    """Drop suggestions whose content the user already has stored.

    Matches on content case-insensitively so a fact the user already saved is not
    re-suggested. Best-effort: on any DB error the suggestions pass through
    unfiltered rather than failing the reply, consistent with the extraction pass.
    """
    if not suggestions:
        return suggestions

    try:
        stored = db.scalars(
            select(Memory.content).where(Memory.user_id == user_id)
        ).all()
    except SQLAlchemyError:
        return suggestions

    seen = {content.lower() for content in stored}
    return [
        suggestion
        for suggestion in suggestions
        if suggestion.content.lower() not in seen
    ]


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
