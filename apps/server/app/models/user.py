from __future__ import annotations

from uuid import uuid4

from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    supabase_user_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )
    email: Mapped[str | None] = mapped_column(
        String(320),
        nullable=True,
        index=True,
    )
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    push_token: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    daily_reminders: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    fit_pic_reminders: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    weekly_stats_reminders: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
