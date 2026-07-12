from fastapi import FastAPI

from app.core.logging import setup_logging
from app.v1.router import router as v1_router

setup_logging()

# Tag order + descriptions drive the grouping and copy shown in Swagger UI.
# "AI" is surfaced first so the AI-backed endpoints are easy to find.
tags_metadata = [
    {
        "name": "AI",
        "description": (
            "AI-powered endpoints backed by LLMs, vision, and embeddings "
            "(DeepSeek & Gemini): stylist chat, clothing image analysis, and "
            "memory embedding."
        ),
    },
    {"name": "auth", "description": "Signup, login, token refresh, and the current user."},
    {"name": "clothing-items", "description": "Manage individual clothing items."},
    {"name": "wardrobes", "description": "Group clothing items into wardrobes."},
    {"name": "outfits", "description": "Create and track outfits."},
    {"name": "calendar", "description": "Plan and log outfits by date."},
    {"name": "weather", "description": "Weather lookups used for outfit context."},
    {"name": "memories", "description": "User style preferences remembered across chats."},
    {"name": "health", "description": "Service liveness checks."},
]

app = FastAPI(title="Fuchsia API", openapi_tags=tags_metadata)

app.include_router(v1_router, prefix="/api/v1")
