from typing import Annotated
from sqlalchemy import select, extract
from sqlalchemy.orm import Session, selectinload
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel

from app.core.auth import AuthenticatedUser, get_current_authenticated_user
from app.db.session import get_db_session
from app.models.calendar_outfit import CalendarOutfit
from app.models.outfit import Outfit
from app.v1.schemas import (
    CalendarOutfitResponse,
    CalendarOutfitWithOutfitResponse,
    CalendarOutfitCreateRequest,
    CalendarOutfitUpdateRequest
)

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=CalendarOutfitResponse)
def create_calendar_outfit(
    data: CalendarOutfitCreateRequest,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    # Verify outfit exists and belongs to user
    outfit = db.scalar(
        select(Outfit).where(
            Outfit.id == data.outfit_id, 
            Outfit.user_id == user.user.id
        )
    )
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    db_calendar_outfit = CalendarOutfit(
        user_id=user.user.id,
        outfit_id=data.outfit_id,
        date=data.date,
        notes=data.notes,
    )
    db.add(db_calendar_outfit)
    db.commit()
    db.refresh(db_calendar_outfit)
    return db_calendar_outfit


@router.get("/", response_model=list[CalendarOutfitWithOutfitResponse])
def get_calendar_outfits(
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
    year: Annotated[int | None, Query(description="Filter by year (e.g. 2026)")] = None,
    month: Annotated[int | None, Query(description="Filter by month (1-12)")] = None,
):
    stmt = select(CalendarOutfit).options(selectinload(CalendarOutfit.outfit)).where(
        CalendarOutfit.user_id == user.user.id
    )

    if year is not None:
        stmt = stmt.where(extract('year', CalendarOutfit.date) == year)
    if month is not None:
        stmt = stmt.where(extract('month', CalendarOutfit.date) == month)

    calendar_outfits = db.scalars(stmt).all()
    return calendar_outfits


@router.patch("/{calendar_outfit_id}", response_model=CalendarOutfitResponse)
def update_calendar_outfit(
    calendar_outfit_id: str,
    data: CalendarOutfitUpdateRequest,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    calendar_outfit = db.scalar(
        select(CalendarOutfit).where(
            CalendarOutfit.id == calendar_outfit_id,
            CalendarOutfit.user_id == user.user.id,
        )
    )
    if not calendar_outfit:
        raise HTTPException(status_code=404, detail="Calendar outfit entry not found")

    if data.date is not None:
        calendar_outfit.date = data.date
    if data.notes is not None:
        calendar_outfit.notes = data.notes

    db.commit()
    db.refresh(calendar_outfit)
    return calendar_outfit


@router.delete("/{calendar_outfit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_calendar_outfit(
    calendar_outfit_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    calendar_outfit = db.scalar(
        select(CalendarOutfit).where(
            CalendarOutfit.id == calendar_outfit_id,
            CalendarOutfit.user_id == user.user.id,
        )
    )
    if not calendar_outfit:
        raise HTTPException(status_code=404, detail="Calendar outfit entry not found")

    db.delete(calendar_outfit)
    db.commit()
