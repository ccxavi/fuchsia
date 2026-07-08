from __future__ import annotations

from uuid import uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.services.embeddings import EMBEDDING_DIMENSIONS


class Memory(TimestampMixin, Base):
    __tablename__ = "memories"

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
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    category: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    # pgvector column in Postgres; JSON list fallback on SQLite (tests/dev) so
    # Base.metadata.create_all and the migration test keep working.
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(EMBEDDING_DIMENSIONS).with_variant(JSON(), "sqlite"),
        nullable=True,
    )
