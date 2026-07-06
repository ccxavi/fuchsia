from __future__ import annotations

from typing import TYPE_CHECKING
import datetime
from uuid import uuid4

if TYPE_CHECKING:
    from app.models.outfit import Outfit

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class OutfitImage(TimestampMixin, Base):
    __tablename__ = "outfit_images"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    outfit_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("outfits.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    image_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    date: Mapped[datetime.date | None] = mapped_column(
        Date,
        nullable=True,
        index=True,
    )

    outfit: Mapped["Outfit"] = relationship(
        "Outfit",
        back_populates="images",
    )
