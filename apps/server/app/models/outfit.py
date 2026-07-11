from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

if TYPE_CHECKING:
    from app.models.clothing_item import ClothingItem
    from app.models.wardrobe import Wardrobe
    from app.models.calendar_outfit import CalendarOutfit
    from app.models.outfit_image import OutfitImage

from sqlalchemy import Boolean, ForeignKey, String, select, func
from sqlalchemy.orm import Mapped, mapped_column, relationship, column_property

from app.db.base import Base, TimestampMixin


class Outfit(TimestampMixin, Base):
    __tablename__ = "outfits"

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
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    is_ai_generated: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    
    clothing_items: Mapped[list["ClothingItem"]] = relationship(
        "ClothingItem",
        secondary="outfit_items",
        back_populates="outfits",
    )
    
    wardrobes: Mapped[list["Wardrobe"]] = relationship(
        "Wardrobe",
        secondary="outfit_wardrobes",
        back_populates="outfits",
    )
    
    calendar_outfits: Mapped[list["CalendarOutfit"]] = relationship(
        "CalendarOutfit",
        back_populates="outfit",
        cascade="all, delete-orphan",
    )
    
    images: Mapped[list["OutfitImage"]] = relationship(
        "OutfitImage",
        back_populates="outfit",
        cascade="all, delete-orphan",
        order_by="desc(OutfitImage.created_at)",
    )
    
    @property
    def clothing_items_count(self) -> int:
        return len(self.clothing_items)
        
    @property
    def wardrobes_count(self) -> int:
        return len(self.wardrobes)

# Late import to avoid circular dependencies when defining column_properties
from app.models.calendar_outfit import CalendarOutfit
import datetime

Outfit.times_worn = column_property(
    select(func.count(CalendarOutfit.id))
    .where(CalendarOutfit.outfit_id == Outfit.id)
    .where(CalendarOutfit.date <= datetime.date.today())
    .correlate_except(CalendarOutfit)
    .scalar_subquery(),
    deferred=False
)

Outfit.last_worn = column_property(
    select(func.max(CalendarOutfit.date))
    .where(CalendarOutfit.outfit_id == Outfit.id)
    .where(CalendarOutfit.date <= datetime.date.today())
    .correlate_except(CalendarOutfit)
    .scalar_subquery(),
    deferred=False
)
