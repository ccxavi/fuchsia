from __future__ import annotations

from uuid import uuid4

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ClothingItemWardrobe(Base):
    __tablename__ = "clothing_item_wardrobes"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    clothing_item_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("clothing_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    wardrobe_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("wardrobes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
