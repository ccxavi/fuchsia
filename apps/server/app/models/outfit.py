from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

if TYPE_CHECKING:
    from app.models.clothing_item import ClothingItem
    from app.models.wardrobe import Wardrobe
    from app.models.calendar_outfit import CalendarOutfit
    from app.models.outfit_image import OutfitImage

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
    image_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
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
