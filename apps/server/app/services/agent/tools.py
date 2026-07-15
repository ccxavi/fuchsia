from __future__ import annotations

import asyncio
import json
from datetime import date
from typing import Any

from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.models.calendar_outfit import CalendarOutfit
from app.models.clothing_item import ClothingItem
from app.models.outfit import Outfit
from app.models.wardrobe import Wardrobe
from app.services.weather import (
    forecast_window,
    get_current_weather,
    get_daily_forecast,
)

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
                "wardrobe_id": {
                    "type": "string",
                    "description": (
                        "Restrict to items in this wardrobe (a named collection). "
                        "Get the id from get_wardrobes."
                    ),
                },
            },
            "additionalProperties": False,
        },
    },
}

GET_WARDROBES_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "get_wardrobes",
        "description": (
            "List the user's wardrobes — their named collections of clothing items, "
            "such as 'Summer' or 'Work'. Use this to resolve a wardrobe the user "
            "names into its id, for example before building an outfit from a specific "
            "wardrobe. Takes no arguments."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
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
            "actually owns. Call this whenever you have chosen an outfit to show the "
            "user — for example when they ask you to build, create, or put one "
            "together. This is the only way the outfit reaches them: describing it in "
            "your reply does not show it, and they cannot save it. Only use clothing "
            "items returned by get_clothing_items, referencing each by its exact 'id'. "
            "Never invent pieces the user does not own. Reflect the user's remembered "
            "style preferences when choosing."
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
                            "wardrobe_ids": {
                                "type": "array",
                                "description": (
                                    "Optional. If the user asked for an outfit from a "
                                    "specific wardrobe, include that wardrobe's id here "
                                    "(from get_wardrobes) so the outfit is saved into "
                                    "it."
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
            "Get the weather at the user's location. Call this whenever "
            "weather-appropriate dressing advice would help — for example when the "
            "user asks what to wear today, or for an event later in the week. Omit "
            "'date' for conditions right now; pass 'date' for that day's forecast "
            "summary — its low, high, and dominant condition. The location comes "
            "from the user's device. Forecasts reach about two weeks ahead; past "
            "weather is not available. If the location is unavailable, ask the user "
            "to describe the weather instead."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": (
                        "Optional. The day to forecast, as YYYY-MM-DD. Resolve "
                        "relative days like 'Friday' using the current date you were "
                        "given. Omit for conditions right now."
                    ),
                },
            },
            "additionalProperties": False,
        },
    },
}

GET_OUTFITS_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "get_outfits",
        "description": (
            "List the user's saved outfits — curated sets of clothing items they have "
            "put together. Use this to resolve an outfit the user names into its id, "
            "for example before scheduling it on the calendar. Takes no arguments."
        ),
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
}

GET_CALENDAR_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "get_calendar",
        "description": (
            "List the outfits the user has scheduled on their calendar, with the date "
            "and any notes. Use it to see what they are already planning to wear. "
            "Optionally filter by year and/or month; omit both to list everything."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "year": {
                    "type": "integer",
                    "description": "Filter by year, e.g. 2026.",
                },
                "month": {
                    "type": "integer",
                    "description": "Filter by month (1-12).",
                },
            },
            "additionalProperties": False,
        },
    },
}

SUGGEST_CALENDAR_ENTRY_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "suggest_calendar_entry",
        "description": (
            "Propose scheduling one or more saved outfits on specific dates. Call "
            "this whenever the user asks you to put an outfit on their calendar, as "
            "soon as you know which outfit and which date. This is the only way the "
            "proposal reaches them: saying you scheduled it in your reply does "
            "nothing. Only schedule outfits that already exist — reference each by an "
            "'id' from get_outfits, never invent one. Use a concrete calendar date "
            "(YYYY-MM-DD); resolve relative dates like 'Saturday' using the current "
            "date you were given. The user confirms the proposal in the app."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "entries": {
                    "type": "array",
                    "description": "The calendar entries you are proposing.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "outfit_id": {
                                "type": "string",
                                "description": (
                                    "The exact 'id' of a saved outfit, from "
                                    "get_outfits."
                                ),
                            },
                            "date": {
                                "type": "string",
                                "description": (
                                    "The date to wear it, as YYYY-MM-DD."
                                ),
                            },
                            "notes": {
                                "type": "string",
                                "description": (
                                    "Optional short note, e.g. the occasion."
                                ),
                            },
                        },
                        "required": ["outfit_id", "date"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["entries"],
            "additionalProperties": False,
        },
    },
}

STYLIST_TOOLS: list[dict[str, Any]] = [
    CLOTHING_ITEMS_TOOL,
    GET_WARDROBES_TOOL,
    GET_OUTFITS_TOOL,
    GET_CALENDAR_TOOL,
    SUGGEST_MEMORIES_TOOL,
    SUGGEST_OUTFITS_TOOL,
    SUGGEST_CALENDAR_ENTRY_TOOL,
    GET_WEATHER_TOOL,
]


def get_clothing_items(
    db: Session,
    user_id: str,
    *,
    category: str | None = None,
    color: str | None = None,
    favorites_only: bool = False,
    wardrobe_id: str | None = None,
) -> list[dict[str, Any]]:
    """Return the user's clothing items, optionally filtered, capped at MAX_ITEMS."""
    query = select(ClothingItem).where(ClothingItem.user_id == user_id)

    if category:
        query = query.where(func.lower(ClothingItem.category) == category.strip().lower())
    if color:
        query = query.where(func.lower(ClothingItem.color) == color.strip().lower())
    if favorites_only:
        query = query.where(ClothingItem.is_favorite.is_(True))
    if wardrobe_id:
        query = (
            query.join(ClothingItem.wardrobes)
            .where(Wardrobe.id == wardrobe_id, Wardrobe.user_id == user_id)
            .distinct()
        )

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


def get_wardrobes(db: Session, user_id: str) -> list[dict[str, Any]]:
    """Return the user's wardrobes as {id, name, item_count} dicts."""
    wardrobes = db.scalars(
        select(Wardrobe).where(Wardrobe.user_id == user_id).limit(MAX_ITEMS)
    ).all()

    return [
        {
            "id": wardrobe.id,
            "name": wardrobe.name,
            "item_count": wardrobe.clothing_items_count,
        }
        for wardrobe in wardrobes
    ]


def get_outfits(db: Session, user_id: str) -> list[dict[str, Any]]:
    """Return the user's saved outfits as model-friendly dicts."""
    outfits = db.scalars(
        select(Outfit).where(Outfit.user_id == user_id).limit(MAX_ITEMS)
    ).all()

    return [
        {
            "id": outfit.id,
            "name": outfit.name,
            "is_ai_generated": outfit.is_ai_generated,
            "item_count": outfit.clothing_items_count,
        }
        for outfit in outfits
    ]


def get_calendar(
    db: Session,
    user_id: str,
    *,
    year: int | None = None,
    month: int | None = None,
) -> list[dict[str, Any]]:
    """Return the user's scheduled outfits, optionally filtered by year/month."""
    query = (
        select(CalendarOutfit)
        .join(CalendarOutfit.outfit)
        .where(CalendarOutfit.user_id == user_id)
        .order_by(CalendarOutfit.date)
    )

    if year is not None:
        query = query.where(extract("year", CalendarOutfit.date) == year)
    if month is not None:
        query = query.where(extract("month", CalendarOutfit.date) == month)

    entries = db.scalars(query.limit(MAX_ITEMS)).all()

    return [
        {
            "date": entry.date.isoformat(),
            "outfit_id": entry.outfit_id,
            "outfit_name": entry.outfit.name,
            "notes": entry.notes,
        }
        for entry in entries
    ]


def _weather_payload(
    latitude: float | None,
    longitude: float | None,
    *,
    date_arg: Any = None,
    today: date | None = None,
) -> dict[str, Any]:
    """Fetch weather for the injected coordinates as a model-friendly dict.

    Without ``date_arg`` this reports current conditions; with one it reports
    that day's forecast summary. ``today`` anchors the accepted date range and
    should be the same date the model was told it is (see the loop's
    ``_inject_current_date``), so the range we enforce matches the one it
    reasoned with.

    Bridges the async weather service into the synchronous tool loop. Never
    raises: a missing location, an unusable date, or an upstream failure becomes
    an ``{"error": ...}`` payload the model can read and recover from.
    """
    if latitude is None or longitude is None:
        return {"error": "Location not available; ask the user about current conditions."}

    if date_arg is None:
        try:
            weather = asyncio.run(get_current_weather(latitude, longitude))
        except Exception:  # noqa: BLE001 - any failure degrades to a readable error
            return {"error": "Could not fetch the weather right now."}

        return {
            "temperature_c": weather.get("temperature"),
            "description": weather.get("description"),
        }

    if not isinstance(date_arg, str):
        return {"error": "Invalid date; give a calendar date as YYYY-MM-DD."}

    try:
        target = date.fromisoformat(date_arg.strip())
    except ValueError:
        return {"error": f"Could not read the date {date_arg!r}; use YYYY-MM-DD."}

    # Checked before dispatch: an out-of-range date is answerable without asking
    # upstream, and the model needs the bounds to pick a different day.
    earliest, latest = forecast_window(today or date.today())
    if not earliest <= target <= latest:
        return {
            "error": (
                f"No forecast for {target.isoformat()}. Forecasts are only "
                f"available from {earliest.isoformat()} to {latest.isoformat()}."
            )
        }

    try:
        forecast = asyncio.run(get_daily_forecast(latitude, longitude, target))
    except Exception:  # noqa: BLE001 - any failure degrades to a readable error
        return {"error": f"Could not fetch the forecast for {target.isoformat()}."}

    return {
        "date": forecast.get("date"),
        "temperature_min_c": forecast.get("temperature_min"),
        "temperature_max_c": forecast.get("temperature_max"),
        "description": forecast.get("description"),
    }


def execute_tool(
    name: str,
    arguments: dict[str, Any],
    *,
    db: Session,
    user_id: str,
    latitude: float | None = None,
    longitude: float | None = None,
    today: date | None = None,
) -> str:
    """Execute a stylist tool by name and return a JSON string for the model.

    Never raises for a caller-recoverable problem (unknown tool, bad args); it
    returns a JSON error payload the model can read and recover from.
    """
    if name == "get_weather":
        return json.dumps(
            _weather_payload(
                latitude,
                longitude,
                date_arg=arguments.get("date"),
                today=today,
            )
        )

    if name == "get_wardrobes":
        wardrobes = get_wardrobes(db, user_id)
        return json.dumps({"count": len(wardrobes), "wardrobes": wardrobes})

    if name == "get_outfits":
        outfits = get_outfits(db, user_id)
        return json.dumps({"count": len(outfits), "outfits": outfits})

    if name == "get_calendar":
        year = arguments.get("year")
        month = arguments.get("month")
        entries = get_calendar(
            db,
            user_id,
            year=year if isinstance(year, int) else None,
            month=month if isinstance(month, int) else None,
        )
        return json.dumps({"count": len(entries), "entries": entries})

    if name != "get_clothing_items":
        return json.dumps({"error": f"Unknown tool: {name}"})

    category = arguments.get("category")
    color = arguments.get("color")
    favorites_only = bool(arguments.get("favorites_only", False))
    wardrobe_id = arguments.get("wardrobe_id")

    items = get_clothing_items(
        db,
        user_id,
        category=category if isinstance(category, str) else None,
        color=color if isinstance(color, str) else None,
        favorites_only=favorites_only,
        wardrobe_id=wardrobe_id if isinstance(wardrobe_id, str) else None,
    )

    return json.dumps({"count": len(items), "items": items})
