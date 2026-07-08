from __future__ import annotations

import datetime
from uuid import uuid4

from sqlalchemy import Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.outfit import Outfit
    from app.models.outfit_image import OutfitImage

from app.db.base import Base, TimestampMixin


class CalendarOutfit(TimestampMixin, Base):
    __tablename__ = "calendar_outfits"
    __table_args__ = (
        UniqueConstraint("outfit_id", "date", name="uq_calendar_outfit_date"),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    outfit_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("outfits.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[datetime.date] = mapped_column(
        Date,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    
    outfit: Mapped["Outfit"] = relationship(
        "Outfit",
        back_populates="calendar_outfits",
    )
    
    day_images: Mapped[list["OutfitImage"]] = relationship(
        "OutfitImage",
        primaryjoin="and_(CalendarOutfit.outfit_id == OutfitImage.outfit_id, CalendarOutfit.date == OutfitImage.date)",
        foreign_keys="[OutfitImage.outfit_id]",
        viewonly=True,
        order_by="desc(OutfitImage.created_at)"
    )
