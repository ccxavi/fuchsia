from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import AuthenticatedUser, get_current_authenticated_user
from app.db.session import get_db_session
from app.models.wardrobe import Wardrobe
from app.v1.schemas import WardrobeCreateRequest, WardrobeResponse, WardrobeUpdateRequest

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=WardrobeResponse)
def create_wardrobe(
    payload: WardrobeCreateRequest,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    db_wardrobe = Wardrobe(
        user_id=user.user.id,
        name=payload.name,
        quantity=payload.quantity,
    )
    db.add(db_wardrobe)
    db.commit()
    db.refresh(db_wardrobe)
    return db_wardrobe


@router.get("/", response_model=list[WardrobeResponse])
def get_wardrobes(
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    wardrobes = db.scalars(
        select(Wardrobe).where(Wardrobe.user_id == user.user.id)
    ).all()
    return wardrobes


@router.get("/{wardrobe_id}", response_model=WardrobeResponse)
def get_wardrobe(
    wardrobe_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    wardrobe = db.scalar(
        select(Wardrobe).where(
            Wardrobe.id == wardrobe_id, Wardrobe.user_id == user.user.id
        )
    )
    if not wardrobe:
        raise HTTPException(status_code=404, detail="Wardrobe not found")
    return wardrobe


@router.patch("/{wardrobe_id}", response_model=WardrobeResponse)
def update_wardrobe(
    wardrobe_id: str,
    payload: WardrobeUpdateRequest,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    wardrobe = db.scalar(
        select(Wardrobe).where(
            Wardrobe.id == wardrobe_id, Wardrobe.user_id == user.user.id
        )
    )
    if not wardrobe:
        raise HTTPException(status_code=404, detail="Wardrobe not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(wardrobe, field, value)

    db.commit()
    db.refresh(wardrobe)
    return wardrobe


@router.delete("/{wardrobe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wardrobe(
    wardrobe_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    wardrobe = db.scalar(
        select(Wardrobe).where(
            Wardrobe.id == wardrobe_id, Wardrobe.user_id == user.user.id
        )
    )
    if not wardrobe:
        raise HTTPException(status_code=404, detail="Wardrobe not found")

    db.delete(wardrobe)
    db.commit()
