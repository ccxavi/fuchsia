from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import uuid4

if TYPE_CHECKING:
    from app.models.clothing_item import ClothingItem
    from app.models.outfit import Outfit

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Wardrobe(TimestampMixin, Base):
    __tablename__ = "wardrobes"

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
    image_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    
    clothing_items: Mapped[list["ClothingItem"]] = relationship(
        "ClothingItem",
        secondary="clothing_item_wardrobes",
        back_populates="wardrobes",
    )
    
    outfits: Mapped[list["Outfit"]] = relationship(
        "Outfit",
        secondary="outfit_wardrobes",
        back_populates="wardrobes",
    )
    
    @property
    def clothing_items_count(self) -> int:
        return len(self.clothing_items)
        
    @property
    def outfits_count(self) -> int:
        return len(self.outfits)
