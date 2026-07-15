from __future__ import annotations

import logging

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.clothing_item import ClothingItem
from app.models.wardrobe import Wardrobe
from app.services.agent.memory import _load_json
from app.v1.schemas import OutfitSuggestion

logger = logging.getLogger(__name__)


def filter_valid_outfit_suggestions(
    db: Session, user_id: str, suggestions: list[OutfitSuggestion]
) -> list[OutfitSuggestion]:
    """Drop ids the user does not own; drop outfits left with no items.

    Best-effort backstop against the model citing pieces or wardrobes that do
    not exist or belong to someone else. Item ids are required (an outfit with
    none left is dropped); wardrobe ids are optional (an emptied set just means
    the outfit is not filed under a wardrobe). On any DB error the suggestions
    pass through unfiltered rather than failing the reply, consistent with
    :func:`app.services.agent.memory.drop_stored_suggestions`.
    """
    if not suggestions:
        return suggestions

    try:
        owned_items = set(
            db.scalars(
                select(ClothingItem.id).where(ClothingItem.user_id == user_id)
            ).all()
        )
        owned_wardrobes = set(
            db.scalars(
                select(Wardrobe.id).where(Wardrobe.user_id == user_id)
            ).all()
        )
    except SQLAlchemyError:
        return suggestions

    valid: list[OutfitSuggestion] = []
    for suggestion in suggestions:
        kept_items = [
            item_id
            for item_id in suggestion.clothing_item_ids
            if item_id in owned_items
        ]
        if not kept_items:
            # The model proposed an outfit and the user will see none of it.
            # Logged because this is otherwise indistinguishable, from both the
            # UI and the audit table, from the model never calling the tool.
            logger.warning(
                "Dropping outfit suggestion for user %s: none of its %d item ids "
                "are owned",
                user_id,
                len(suggestion.clothing_item_ids),
            )
            continue
        dropped_items = len(suggestion.clothing_item_ids) - len(kept_items)
        if dropped_items:
            logger.warning(
                "Stripping %d unowned item id(s) from an outfit suggestion for "
                "user %s; %d kept",
                dropped_items,
                user_id,
                len(kept_items),
            )
        kept_wardrobes = [
            wardrobe_id
            for wardrobe_id in suggestion.wardrobe_ids
            if wardrobe_id in owned_wardrobes
        ]
        valid.append(
            suggestion.model_copy(
                update={
                    "clothing_item_ids": kept_items,
                    "wardrobe_ids": kept_wardrobes,
                }
            )
        )

    return valid


def _parse_outfit_suggestions(text: str) -> list[OutfitSuggestion]:
    """Parse outfit proposals from a tool call's arguments, tolerantly.

    Accepts a bare JSON array or a ``{"outfits": [...]}`` wrapper, ignores
    malformed entries, and dedupes by (name, item ids). Reuses the shared
    JSON-tolerant loader so code fences and stray prose are handled the same way
    as memory suggestions.
    """
    data = _load_json(text)
    items = data.get("outfits") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return []

    suggestions: list[OutfitSuggestion] = []
    seen: set[tuple[str, tuple[str, ...]]] = set()
    for item in items:
        if not isinstance(item, dict):
            continue

        name = item.get("name")
        raw_ids = item.get("clothing_item_ids")
        if not isinstance(raw_ids, list):
            continue

        clothing_item_ids = [
            value.strip()
            for value in raw_ids
            if isinstance(value, str) and value.strip()
        ]
        if not clothing_item_ids:
            continue

        raw_wardrobe_ids = item.get("wardrobe_ids")
        wardrobe_ids = (
            [
                value.strip()
                for value in raw_wardrobe_ids
                if isinstance(value, str) and value.strip()
            ]
            if isinstance(raw_wardrobe_ids, list)
            else []
        )

        rationale = item.get("rationale")
        try:
            suggestion = OutfitSuggestion(
                name=name if isinstance(name, str) else "",
                clothing_item_ids=clothing_item_ids,
                wardrobe_ids=wardrobe_ids,
                rationale=rationale if isinstance(rationale, str) else None,
            )
        except ValidationError as error:
            # Most often a missing or blank name, which the schema requires.
            logger.warning("Discarding a malformed outfit suggestion: %s", error)
            continue

        key = (suggestion.name.lower(), tuple(suggestion.clothing_item_ids))
        if key in seen:
            continue
        seen.add(key)
        suggestions.append(suggestion)

    return suggestions


__all__ = [
    "filter_valid_outfit_suggestions",
    "_parse_outfit_suggestions",
]
