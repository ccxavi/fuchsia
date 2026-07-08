from __future__ import annotations

import asyncio
import json
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.clothing_item import ClothingItem
from app.services.weather import get_current_weather

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

SUGGEST_MEMORIES_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "suggest_memories",
        "description": (
            "Propose durable, styling-relevant facts about the user that are worth "
            "remembering for future conversations — style preferences and dislikes, "
            "body measurements or sizes, lifestyle facts, or upcoming events they "
            "will dress for. Only propose facts the USER stated about themselves. "
            "Do NOT propose anything already listed in the 'Relevant things you "
            "remember about this user' block, one-off requests, small talk, or "
            "details you merely inferred. Call this in the same turn you answer; if "
            "there is nothing new worth remembering, do not call it."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "memories": {
                    "type": "array",
                    "description": "The new facts worth remembering.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "content": {
                                "type": "string",
                                "description": (
                                    "A short neutral statement, e.g. 'Never wears "
                                    "heels' or 'Wears size M tops'."
                                ),
                            },
                            "category": {
                                "type": "string",
                                "enum": [
                                    "preference",
                                    "fact",
                                    "event",
                                    "measurement",
                                ],
                            },
                        },
                        "required": ["content"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["memories"],
            "additionalProperties": False,
        },
    },
}

SUGGEST_OUTFITS_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "suggest_outfits",
        "description": (
            "Propose one or more complete outfits assembled from pieces the user "
            "actually owns. Only use clothing items returned by get_clothing_items, "
            "referencing each by its exact 'id'. Never invent pieces the user does "
            "not own. Reflect the user's remembered style preferences when choosing. "
            "Call this in the same turn you answer once you have decided on an outfit; "
            "if you cannot build one from their wardrobe, do not call it."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "outfits": {
                    "type": "array",
                    "description": "The outfits you are proposing.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": (
                                    "A short descriptive name, e.g. 'Casual Friday' "
                                    "or 'Wedding Guest Look'."
                                ),
                            },
                            "clothing_item_ids": {
                                "type": "array",
                                "description": (
                                    "The exact 'id' values of the chosen clothing "
                                    "items, taken from get_clothing_items results."
                                ),
                                "items": {"type": "string"},
                            },
                            "rationale": {
                                "type": "string",
                                "description": (
                                    "One short sentence on why these pieces work "
                                    "together for the request."
                                ),
                            },
                        },
                        "required": ["name", "clothing_item_ids"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["outfits"],
            "additionalProperties": False,
        },
    },
}

GET_WEATHER_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": (
            "Get the current weather at the user's location. Call this whenever "
            "weather-appropriate dressing advice would help — for example when the "
            "user asks what to wear today or for an outing. Takes no arguments; the "
            "location comes from the user's device. Returns current conditions only, "
            "not a multi-day forecast. If the location is unavailable, ask the user "
            "to describe the weather instead."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
}

STYLIST_TOOLS: list[dict[str, Any]] = [
    CLOTHING_ITEMS_TOOL,
    SUGGEST_MEMORIES_TOOL,
    SUGGEST_OUTFITS_TOOL,
    GET_WEATHER_TOOL,
]


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
            "id": item.id,
            "name": item.name,
            "category": item.category,
            "color": item.color,
            "brand": item.brand,
            "is_favorite": item.is_favorite,
        }
        for item in items
    ]


def _weather_payload(latitude: float | None, longitude: float | None) -> dict[str, Any]:
    """Fetch current weather for the injected coordinates as a model-friendly dict.

    Bridges the async weather service into the synchronous tool loop. Never
    raises: a missing location or upstream failure becomes an ``{"error": ...}``
    payload the model can read and recover from.
    """
    if latitude is None or longitude is None:
        return {"error": "Location not available; ask the user about current conditions."}

    try:
        weather = asyncio.run(get_current_weather(latitude, longitude))
    except Exception:  # noqa: BLE001 - any failure degrades to a readable error
        return {"error": "Could not fetch the weather right now."}

    return {
        "temperature_c": weather.get("temperature"),
        "description": weather.get("description"),
        "city": weather.get("city"),
    }


def execute_tool(
    name: str,
    arguments: dict[str, Any],
    *,
    db: Session,
    user_id: str,
    latitude: float | None = None,
    longitude: float | None = None,
) -> str:
    """Execute a stylist tool by name and return a JSON string for the model.

    Never raises for a caller-recoverable problem (unknown tool, bad args); it
    returns a JSON error payload the model can read and recover from.
    """
    if name == "get_weather":
        return json.dumps(_weather_payload(latitude, longitude))

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
