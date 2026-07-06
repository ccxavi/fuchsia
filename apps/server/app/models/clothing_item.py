from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

if TYPE_CHECKING:
    from app.models.wardrobe import Wardrobe
    from app.models.outfit import Outfit

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class ClothingItem(TimestampMixin, Base):
    __tablename__ = "clothing_items"

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
    category: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    color: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    brand: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    image_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    is_favorite: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    
    wardrobes: Mapped[list["Wardrobe"]] = relationship(
        "Wardrobe",
        secondary="clothing_item_wardrobes",
        back_populates="clothing_items",
    )
    
    outfits: Mapped[list["Outfit"]] = relationship(
        "Outfit",
        secondary="outfit_items",
        back_populates="clothing_items",
    )
    
    @property
    def wardrobes_count(self) -> int:
        return len(self.wardrobes)
        
    @property
    def outfits_count(self) -> int:
        return len(self.outfits)
