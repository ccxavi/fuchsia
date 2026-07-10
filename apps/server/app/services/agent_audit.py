from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.agent_invocation import AgentInvocation

logger = logging.getLogger(__name__)


def _coerce_int(value: Any) -> int:
    """Return ``value`` as a non-negative int, or 0 if it isn't usable."""
    if isinstance(value, bool):
        return 0
    if isinstance(value, int):
        return value if value >= 0 else 0
    return 0


@dataclass
class InvocationStats:
    """Mutable accumulator threaded through the agent loop.

    Token counts are summed across every LLM call (the loop can make several per
    request); ``llm_calls`` and ``tool_calls`` count round-trips and dispatched
    tool calls respectively. The object is updated in place after each call so
    partial totals survive even when the loop raises mid-flight.
    """

    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    llm_calls: int = 0
    tool_calls: int = 0

    def add_usage(self, usage: dict[str, Any] | None) -> None:
        """Fold one response's OpenAI ``usage`` block into the running totals."""
        if not isinstance(usage, dict):
            return
        self.prompt_tokens += _coerce_int(usage.get("prompt_tokens"))
        self.completion_tokens += _coerce_int(usage.get("completion_tokens"))
        self.total_tokens += _coerce_int(usage.get("total_tokens"))


def record_agent_invocation(
    db_session: Session,
    *,
    user_id: str,
    provider: str,
    model: str,
    user_message: str | None,
    response_message: str | None,
    stats: InvocationStats,
    status: str,
    error_detail: str | None,
    temperature: float | None,
    max_tokens: int | None,
) -> None:
    """Persist one audit row for an agent invocation.

    Best-effort: auditing must never break the chat, so a DB failure is rolled
    back and logged rather than raised. Callers on the error path should record
    first, then re-raise the original error.
    """
    invocation = AgentInvocation(
        user_id=user_id,
        provider=provider,
        model=model,
        user_message=user_message,
        response_message=response_message,
        prompt_tokens=stats.prompt_tokens,
        completion_tokens=stats.completion_tokens,
        total_tokens=stats.total_tokens,
        llm_call_count=stats.llm_calls,
        tool_call_count=stats.tool_calls,
        temperature=temperature,
        max_tokens=max_tokens,
        status=status,
        error_detail=error_detail,
    )
    try:
        db_session.add(invocation)
        db_session.commit()
    except SQLAlchemyError:
        db_session.rollback()
        logger.exception("Failed to record agent invocation audit row")
