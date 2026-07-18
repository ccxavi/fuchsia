from __future__ import annotations

import datetime
import json
from typing import Any, Iterator

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.memory import Memory
from app.services.agent.loop import (
    MAX_TOOL_ROUNDS,
    _inject_current_date,
    _inject_memory_context,
    _latest_user_text,
    _run_tool_call,
    finalize_response,
)
from app.services.agent.openai_compat import (
    Provider,
    build_body,
    serialize_messages,
    stream_chat,
)
from app.services.agent.tools import STYLIST_TOOLS
from app.services.agent_audit import InvocationStats, record_agent_invocation
from app.v1.schemas import (
    CalendarSuggestion,
    ChatMessage,
    ChatResponse,
    MemorySuggestion,
    OutfitSuggestion,
)

# Human-readable status shown while a tool runs. Keyed by tool name; anything
# unmapped falls back to a generic label rather than leaking the raw name.
TOOL_STATUS_LABELS: dict[str, str] = {
    "web_search": "Searching the web",
    "get_clothing_items": "Looking through your wardrobe",
    "get_wardrobes": "Looking through your wardrobe",
    "get_outfits": "Looking into your outfits",
    "get_calendar": "Checking your calendar",
    "get_weather": "Checking the weather",
    "suggest_memories": "Remembering",
    "suggest_outfits": "Putting together an outfit",
    "suggest_calendar_entry": "Adding to your calendar",
}
DEFAULT_STATUS_LABEL = "Working on it"


def _sse(event: str, data: dict[str, Any]) -> str:
    """Frame one Server-Sent Event: an ``event:`` line and a JSON ``data:`` line."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _merge_tool_call_deltas(
    slots: dict[int, dict[str, Any]], deltas: list[dict[str, Any]]
) -> None:
    """Fold streamed tool_call fragments into ``slots`` in place, keyed by index.

    OpenAI-compatible streams split each tool call across chunks — the ``id`` and
    function ``name`` arrive first, then ``arguments`` in pieces. We reassemble by
    the stable ``index`` each fragment carries.
    """
    for delta in deltas:
        index = delta.get("index")
        if not isinstance(index, int):
            continue
        slot = slots.setdefault(
            index,
            {"id": "", "type": "function", "function": {"name": "", "arguments": ""}},
        )
        if delta.get("id"):
            slot["id"] = delta["id"]
        function = delta.get("function") or {}
        if function.get("name"):
            slot["function"]["name"] += function["name"]
        if function.get("arguments"):
            slot["function"]["arguments"] += function["arguments"]


def _stream_answer(
    serialized: list[dict[str, Any]],
    *,
    provider: Provider,
    db: Session,
    user_id: str,
    temperature: float | None,
    max_tokens: int | None,
    suggestions: list[MemorySuggestion],
    outfit_suggestions: list[OutfitSuggestion],
    calendar_suggestions: list[CalendarSuggestion],
    latitude: float | None,
    longitude: float | None,
    today: datetime.date | None,
    stats: InvocationStats,
) -> Iterator[str]:
    """Stream the tool loop, yielding ``token`` and ``status`` SSE frames.

    Returns (via ``StopIteration.value``) the final answer text and model name so
    the caller can build the terminal ``done`` frame. Mirrors ``_generate_answer``
    but streams: content deltas are forwarded as they arrive, tool-call rounds
    emit a status frame per call and dispatch through the shared ``_run_tool_call``
    (synchronous, so the tools' internal ``asyncio.run`` stays safe).
    """
    last_model: str | None = None

    def _consume_round(*, tools: list[dict[str, Any]] | None) -> Iterator[str]:
        """Stream one LLM round: yield ``token`` frames live, return its result.

        Returns ``(content, tool_calls)`` via ``StopIteration.value``. Content
        deltas are forwarded the moment they arrive (true token streaming); a
        round that turns out to be a tool round carries empty content in practice,
        so nothing spurious reaches the client.
        """
        nonlocal last_model
        body = build_body(
            provider.model,
            serialized,
            temperature=temperature,
            max_tokens=max_tokens,
            tools=tools,
            stream=True,
        )
        stats.llm_calls += 1
        content = ""
        tool_call_slots: dict[int, dict[str, Any]] = {}
        for chunk in stream_chat(provider, body):
            model = chunk.get("model")
            if isinstance(model, str) and model:
                last_model = model
            usage = chunk.get("usage")
            if isinstance(usage, dict):
                stats.add_usage(usage)
            choices = chunk.get("choices") or []
            if not choices:
                continue
            delta = choices[0].get("delta") or {}
            piece = delta.get("content")
            if isinstance(piece, str) and piece:
                content += piece
                yield _sse("token", {"text": piece})
            tool_deltas = delta.get("tool_calls")
            if isinstance(tool_deltas, list):
                _merge_tool_call_deltas(tool_call_slots, tool_deltas)
        tool_calls = [tool_call_slots[i] for i in sorted(tool_call_slots)]
        return content, tool_calls

    for _ in range(MAX_TOOL_ROUNDS):
        content, tool_calls = yield from _consume_round(tools=STYLIST_TOOLS)
        if not tool_calls:
            return content, last_model

        stats.tool_calls += len(tool_calls)
        serialized.append(
            {"role": "assistant", "content": content or "", "tool_calls": tool_calls}
        )
        for tool_call in tool_calls:
            name = (tool_call.get("function") or {}).get("name") or ""
            yield _sse(
                "status",
                {"tool": name, "label": TOOL_STATUS_LABELS.get(name, DEFAULT_STATUS_LABEL)},
            )
            serialized.append(
                _run_tool_call(
                    tool_call,
                    db=db,
                    user_id=user_id,
                    suggestions=suggestions,
                    outfit_suggestions=outfit_suggestions,
                    calendar_suggestions=calendar_suggestions,
                    latitude=latitude,
                    longitude=longitude,
                    today=today,
                )
            )

    # Tools were requested every round; force a final text answer without tools.
    content, _ = yield from _consume_round(tools=None)
    return content, last_model


def stream_stylist_chat(
    messages: list[ChatMessage],
    *,
    provider: Provider,
    db: Session,
    user_id: str,
    temperature: float | None = None,
    max_tokens: int | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    today: datetime.date | None = None,
) -> Iterator[str]:
    """Stream the stylist's answer as SSE frames: status, token, then done.

    The SSE counterpart to :func:`run_stylist_chat`. It shares that function's
    setup (memory + date injection), tool dispatch, and — via
    :func:`finalize_response` — its audit and suggestion reconciliation, so the
    buffered and streaming endpoints stay in lockstep. Emits ``status`` frames as
    the agent uses tools, ``token`` frames as the answer streams, a terminal
    ``done`` frame carrying the reconciled ``ChatResponse``, or an ``error`` frame
    (with an audited failure) if the upstream call fails mid-stream.
    """
    serialized = serialize_messages(messages, flatten=provider.flatten_content)
    used_memories: list[Memory] = _inject_memory_context(
        serialized, messages, db=db, user_id=user_id
    )
    _inject_current_date(serialized, today)
    suggestions: list[MemorySuggestion] = []
    outfit_suggestions: list[OutfitSuggestion] = []
    calendar_suggestions: list[CalendarSuggestion] = []
    stats = InvocationStats()

    try:
        answer_text, model_name = yield from _stream_answer(
            serialized,
            provider=provider,
            db=db,
            user_id=user_id,
            temperature=temperature,
            max_tokens=max_tokens,
            suggestions=suggestions,
            outfit_suggestions=outfit_suggestions,
            calendar_suggestions=calendar_suggestions,
            latitude=latitude,
            longitude=longitude,
            today=today,
            stats=stats,
        )
        if not answer_text:
            raise HTTPException(
                status_code=502, detail="Upstream returned an empty message."
            )
        response = ChatResponse(
            message=ChatMessage(role="assistant", content=answer_text),
            model=model_name or provider.model,
        )
        final = finalize_response(
            response,
            db=db,
            user_id=user_id,
            provider=provider,
            messages=messages,
            stats=stats,
            used_memories=used_memories,
            suggestions=suggestions,
            outfit_suggestions=outfit_suggestions,
            calendar_suggestions=calendar_suggestions,
            temperature=temperature,
            max_tokens=max_tokens,
        )
    except HTTPException as exc:
        # Audit the failed invocation (with whatever usage accrued) before the
        # error reaches the client — same contract as run_stylist_chat.
        record_agent_invocation(
            db,
            user_id=user_id,
            provider=provider.name,
            model=provider.model,
            user_message=_latest_user_text(messages),
            response_message=None,
            stats=stats,
            status="error",
            error_detail=str(exc.detail),
            temperature=temperature,
            max_tokens=max_tokens,
        )
        yield _sse("error", {"detail": str(exc.detail)})
        return

    yield _sse("done", final.model_dump(mode="json"))
