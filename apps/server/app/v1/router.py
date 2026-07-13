from fastapi import APIRouter

from app.v1 import auth, chat, clothing_items, health, wardrobes, outfits, calendar, weather, memories, style_tips

router = APIRouter()

router.include_router(
    health.router,
    tags=["health"],
)
router.include_router(
    auth.router,
    tags=["auth"],
)
router.include_router(
    chat.router,
    tags=["AI"],
)
router.include_router(
    clothing_items.router,
    prefix="/clothing-items",
    tags=["clothing-items"],
)
router.include_router(
    wardrobes.router,
    prefix="/wardrobes",
    tags=["wardrobes"],
)
router.include_router(
    outfits.router,
    prefix="/outfits",
    tags=["outfits"],
)
router.include_router(
    calendar.router,
    prefix="/calendar",
    tags=["calendar"],
)
router.include_router(
    weather.router,
    prefix="/weather",
    tags=["weather"],
)
router.include_router(
    memories.router,
    prefix="/memories",
    tags=["memories"],
)
router.include_router(
    style_tips.router,
    prefix="/style-tips",
    tags=["AI"],
)
