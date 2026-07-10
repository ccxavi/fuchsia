from __future__ import annotations

from uuid import uuid4

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AgentInvocation(TimestampMixin, Base):
    """Append-only audit row for a single stylist-agent chat invocation.

    One row is written per ``/chat`` request. Token counts are summed across
    every LLM call the tool loop made (not just the final round), so the totals
    reflect true usage/billing. Failed invocations are recorded too, with
    ``status="error"`` and ``error_detail`` set.
    """

    __tablename__ = "agent_invocations"

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
    provider: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    model: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    user_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    response_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    prompt_tokens: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    completion_tokens: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    total_tokens: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    llm_call_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    tool_call_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    temperature: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    max_tokens: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    error_detail: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
