from __future__ import annotations

import json
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.clothing_item import ClothingItem

MAX_ITEMS = 100

CLOTHING_ITEMS_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "get_clothing_items",
        "description": (
            "Look up the current user's saved clothing items from their Fuchsia "
            "wardrobe. Use this whenever specific, personalized styling advice would "
            "help — for example to suggest outfits from pieces they actually own. "
            "All arguments are optional filters; omit them to list everything."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": (
                        "Filter by category, e.g. 'tops', 'bottoms', 'shoes'. "
                        "Case-insensitive."
                    ),
                },
                "color": {
                    "type": "string",
                    "description": "Filter by color, e.g. 'blue'. Case-insensitive.",
                },
                "favorites_only": {
                    "type": "boolean",
                    "description": "When true, only return items marked as favorite.",
                },
            },
            "additionalProperties": False,
        },
    },
}

STYLIST_TOOLS: list[dict[str, Any]] = [CLOTHING_ITEMS_TOOL]


def get_clothing_items(
    db: Session,
    user_id: str,
    *,
    category: str | None = None,
    color: str | None = None,
    favorites_only: bool = False,
) -> list[dict[str, Any]]:
    """Return the user's clothing items, optionally filtered, capped at MAX_ITEMS."""
    query = select(ClothingItem).where(ClothingItem.user_id == user_id)

    if category:
        query = query.where(func.lower(ClothingItem.category) == category.strip().lower())
    if color:
        query = query.where(func.lower(ClothingItem.color) == color.strip().lower())
    if favorites_only:
        query = query.where(ClothingItem.is_favorite.is_(True))

    items = db.scalars(query.limit(MAX_ITEMS)).all()

    return [
        {
            "name": item.name,
            "category": item.category,
            "color": item.color,
            "brand": item.brand,
            "is_favorite": item.is_favorite,
        }
        for item in items
    ]


def execute_tool(
    name: str,
    arguments: dict[str, Any],
    *,
    db: Session,
    user_id: str,
) -> str:
    """Execute a stylist tool by name and return a JSON string for the model.

    Never raises for a caller-recoverable problem (unknown tool, bad args); it
    returns a JSON error payload the model can read and recover from.
    """
    if name != "get_clothing_items":
        return json.dumps({"error": f"Unknown tool: {name}"})

    category = arguments.get("category")
    color = arguments.get("color")
    favorites_only = bool(arguments.get("favorites_only", False))

    items = get_clothing_items(
        db,
        user_id,
        category=category if isinstance(category, str) else None,
        color=color if isinstance(color, str) else None,
        favorites_only=favorites_only,
    )

    return json.dumps({"count": len(items), "items": items})
