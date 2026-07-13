from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import AuthenticatedUser, get_current_authenticated_user
from app.db.session import get_db_session
from app.models.style_tips import StyleTips
from app.services.agent import generate_style_tips, wardrobe_fingerprint
from app.services.agent.tools import get_clothing_items
from app.v1.schemas import StyleTipsResponse

router = APIRouter()


@router.get(
    "",
    response_model=StyleTipsResponse,
    summary="AI wardrobe style tips (cached by wardrobe fingerprint)",
)
def get_style_tips(
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
    refresh: bool = False,
) -> StyleTipsResponse:
    """Return AI style tips for the user's wardrobe, cached until it changes.

    A coarse fingerprint of the wardrobe is compared against the stored one: on a
    match the cached tips are returned without calling the model. Only a mismatch
    (or ``refresh=true``) regenerates. An empty wardrobe yields an empty list and
    never calls the model. Run as a plain ``def`` handler so FastAPI offloads the
    blocking LLM call to a threadpool (mirrors ``chat``).
    """
    user_id = user.user.id
    items = get_clothing_items(db, user_id)
    fingerprint = wardrobe_fingerprint(items)

    record = db.scalar(select(StyleTips).where(StyleTips.user_id == user_id))
    if not refresh and record is not None and record.fingerprint == fingerprint:
        return StyleTipsResponse(
            tips=record.tips, updated_at=record.updated_at, cached=True
        )

    tips = generate_style_tips(items) if items else []
    tips_json = [tip.model_dump() for tip in tips]

    record = _store_tips(db, user_id, fingerprint, tips_json)
    return StyleTipsResponse(
        tips=record.tips, updated_at=record.updated_at, cached=False
    )


def _store_tips(
    db: Session, user_id: str, fingerprint: str, tips_json: list[dict]
) -> StyleTips:
    """Upsert the single per-user tips row and return it refreshed.

    Reassigns ``tips`` wholesale (the JSON column is not mutation-tracked). The
    ``IntegrityError`` guard handles the rare race where two concurrent requests
    both miss the cache and try to insert; the loser reloads and overwrites
    (last write wins, which is fine for a cache).
    """
    record = db.scalar(select(StyleTips).where(StyleTips.user_id == user_id))
    if record is None:
        record = StyleTips(
            user_id=user_id, fingerprint=fingerprint, tips=tips_json
        )
        db.add(record)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            record = db.scalar(
                select(StyleTips).where(StyleTips.user_id == user_id)
            )
            record.fingerprint = fingerprint
            record.tips = tips_json
            db.commit()
    else:
        record.fingerprint = fingerprint
        record.tips = tips_json
        db.commit()

    db.refresh(record)
    return record
