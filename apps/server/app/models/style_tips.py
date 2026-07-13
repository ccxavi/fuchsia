from __future__ import annotations

from uuid import uuid4

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class StyleTips(TimestampMixin, Base):
    """Cached AI style tips for a user, keyed by a wardrobe fingerprint.

    One row per user (``user_id`` is unique). The tips are regenerated only when
    the current wardrobe fingerprint no longer matches ``fingerprint``; otherwise
    the stored ``tips`` are returned as-is. ``tips`` is a JSON list of
    ``{"title", "description", "kind"}`` objects — plain ``JSON`` works on both
    Postgres and the SQLite test database.
    """

    __tablename__ = "style_tips"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    # sha256 hex digest of the wardrobe fingerprint (64 chars).
    fingerprint: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    tips: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
