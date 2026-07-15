from __future__ import annotations

import logging

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.outfit import Outfit
from app.services.agent.memory import _load_json
from app.v1.schemas import CalendarSuggestion

logger = logging.getLogger(__name__)


def filter_valid_calendar_suggestions(
    db: Session, user_id: str, suggestions: list[CalendarSuggestion]
) -> list[CalendarSuggestion]:
    """Drop entries whose outfit the user does not own.

    Best-effort backstop against the model scheduling an outfit that does not
    exist or belongs to someone else. On any DB error the suggestions pass
    through unfiltered rather than failing the reply, consistent with
    :func:`app.services.agent.outfits.filter_valid_outfit_suggestions`.
    """
    if not suggestions:
        return suggestions

    try:
        owned = set(
            db.scalars(
                select(Outfit.id).where(Outfit.user_id == user_id)
            ).all()
        )
    except SQLAlchemyError:
        return suggestions

    valid: list[CalendarSuggestion] = []
    for suggestion in suggestions:
        if suggestion.outfit_id not in owned:
            # As in outfits.py: a dropped proposal is invisible to the user and
            # looks exactly like the model never having called the tool.
            logger.warning(
                "Dropping calendar suggestion for user %s: outfit %s is not theirs",
                user_id,
                suggestion.outfit_id,
            )
            continue
        valid.append(suggestion)

    return valid


def _parse_calendar_suggestions(text: str) -> list[CalendarSuggestion]:
    """Parse calendar proposals from a tool call's arguments, tolerantly.

    Accepts a bare JSON array or an ``{"entries": [...]}`` wrapper, skips entries
    that fail validation (e.g. a malformed date), and dedupes by (outfit id, date).
    Reuses the shared JSON-tolerant loader.
    """
    data = _load_json(text)
    items = data.get("entries") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return []

    suggestions: list[CalendarSuggestion] = []
    seen: set[tuple[str, str]] = set()
    for item in items:
        if not isinstance(item, dict):
            continue

        outfit_id = item.get("outfit_id")
        if not isinstance(outfit_id, str) or not outfit_id.strip():
            continue

        notes = item.get("notes")
        try:
            suggestion = CalendarSuggestion(
                outfit_id=outfit_id.strip(),
                date=item.get("date"),
                notes=notes if isinstance(notes, str) else None,
            )
        except ValidationError:
            continue

        key = (suggestion.outfit_id, suggestion.date.isoformat())
        if key in seen:
            continue
        seen.add(key)
        suggestions.append(suggestion)

    return suggestions


__all__ = [
    "filter_valid_calendar_suggestions",
    "_parse_calendar_suggestions",
]
