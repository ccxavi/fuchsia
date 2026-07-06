from fastapi import APIRouter

from app.v1 import auth, clothing_items, health, wardrobes, outfits, calendar

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
