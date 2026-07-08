from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.services.agent.memory import (
    _parse_suggestions,
    drop_stored_suggestions,
)
from app.services.agent.outfits import (
    _parse_outfit_suggestions,
    filter_valid_outfit_suggestions,
)
from app.services.agent.openai_compat import (
    Provider,
    build_body,
    first_choice_message,
    flatten_text_content,
    parse_chat_response,
    post_chat,
    serialize_messages,
)
from app.services.agent.recall import (
    build_memory_context_block,
    retrieve_relevant_memories,
)
from app.services.agent.tools import STYLIST_TOOLS, execute_tool
from app.models.memory import Memory
from app.v1.schemas import (
    ChatMessage,
    ChatResponse,
    MemoryResponse,
    MemorySuggestion,
    OutfitSuggestion,
)

MAX_TOOL_ROUNDS = 4


def _latest_user_text(messages: list[ChatMessage]) -> str:
    """Return the flattened text of the most recent user message ("" if none)."""
    for message in reversed(messages):
        if message.role == "user":
            return flatten_text_content(message.content)
    return ""


def _inject_memory_context(
    serialized: list[dict[str, Any]],
    messages: list[ChatMessage],
    *,
    db: Session,
    user_id: str,
) -> list[Memory]:
    """Fold relevant remembered facts into the system prompt, in place.

    Best-effort RAG step: retrieves memories similar to the user's latest
    message and appends them to the leading system message so the model treats
    them as background. Returns exactly the memories that were injected (so the
    caller can surface them on the response); a miss, failure, or missing system
    message leaves ``serialized`` unchanged and returns an empty list.
    """
    if not serialized or serialized[0].get("role") != "system":
        return []

    memories = retrieve_relevant_memories(db, user_id, _latest_user_text(messages))
    if not memories:
        return []

    block = build_memory_context_block(memories)
    serialized[0]["content"] = f"{serialized[0]['content']}\n\n{block}"
    return memories


def _dedupe_suggestions(
    suggestions: list[MemorySuggestion],
) -> list[MemorySuggestion]:
    """Drop duplicate suggestions (by content + category) across tool calls."""
    seen: set[tuple[str, str | None]] = set()
    unique: list[MemorySuggestion] = []
    for suggestion in suggestions:
        key = (suggestion.content.lower(), suggestion.category)
        if key in seen:
            continue
        seen.add(key)
        unique.append(suggestion)
    return unique


def _parse_arguments(raw_arguments: Any) -> dict[str, Any]:
    if not isinstance(raw_arguments, str) or not raw_arguments.strip():
        return {}
    try:
        parsed = json.loads(raw_arguments)
    except ValueError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _run_tool_call(
    tool_call: dict[str, Any],
    *,
    db: Session,
    user_id: str,
    suggestions: list[MemorySuggestion],
    outfit_suggestions: list[OutfitSuggestion],
) -> dict[str, Any]:
    function = tool_call.get("function") or {}
    name = function.get("name") or ""

    if name == "suggest_memories":
        # Output-only tool: record the proposed memories and acknowledge. Reuses
        # the shared parser for JSON tolerance, category coercion, and dedup.
        raw = function.get("arguments")
        parsed = _parse_suggestions(raw if isinstance(raw, str) else "")
        suggestions.extend(parsed)
        content = json.dumps({"status": "noted", "count": len(parsed)})
    elif name == "suggest_outfits":
        # Output-only tool: record the proposed outfits and acknowledge. Item ids
        # are validated against the user's wardrobe after the loop finishes.
        raw = function.get("arguments")
        parsed_outfits = _parse_outfit_suggestions(raw if isinstance(raw, str) else "")
        outfit_suggestions.extend(parsed_outfits)
        content = json.dumps({"status": "noted", "count": len(parsed_outfits)})
    else:
        arguments = _parse_arguments(function.get("arguments"))
        content = execute_tool(name, arguments, db=db, user_id=user_id)

    return {
        "role": "tool",
        "tool_call_id": tool_call.get("id"),
        "content": content,
    }


def _generate_answer(
    serialized: list[dict[str, Any]],
    *,
    provider: Provider,
    db: Session,
    user_id: str,
    temperature: float | None,
    max_tokens: int | None,
    suggestions: list[MemorySuggestion],
    outfit_suggestions: list[OutfitSuggestion],
) -> ChatResponse:
    """Run the tool loop and return the model's final text answer.

    Loops up to ``MAX_TOOL_ROUNDS`` while the model requests tools; once it
    returns a plain answer that answer is returned. If the model never stops
    requesting tools, a final request without tools forces a text answer.
    """
    for _ in range(MAX_TOOL_ROUNDS):
        body = build_body(
            provider.model,
            serialized,
            temperature=temperature,
            max_tokens=max_tokens,
            tools=STYLIST_TOOLS,
        )
        payload = post_chat(provider, body)
        message = first_choice_message(payload)

        tool_calls = message.get("tool_calls")
        if not tool_calls:
            return parse_chat_response(payload, fallback_model=provider.model)

        serialized.append(
            {
                "role": "assistant",
                "content": message.get("content") or "",
                "tool_calls": tool_calls,
            }
        )
        for tool_call in tool_calls:
            serialized.append(
                _run_tool_call(
                    tool_call,
                    db=db,
                    user_id=user_id,
                    suggestions=suggestions,
                    outfit_suggestions=outfit_suggestions,
                )
            )

    # Tools were requested every round; force a final text answer without tools.
    body = build_body(
        provider.model,
        serialized,
        temperature=temperature,
        max_tokens=max_tokens,
        tools=None,
    )
    payload = post_chat(provider, body)
    return parse_chat_response(payload, fallback_model=provider.model)


def run_stylist_chat(
    messages: list[ChatMessage],
    *,
    provider: Provider,
    db: Session,
    user_id: str,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> ChatResponse:
    """Generate the stylist's answer, collecting any memory suggestions it makes.

    The answer is produced by the tool loop; within that same loop the model may
    call the ``suggest_memories`` tool to propose durable facts worth remembering.
    Because the loop's context already includes the user's relevant remembered
    facts (see :func:`_inject_memory_context`), the model avoids re-proposing what
    it already knows; ``drop_stored_suggestions`` is a final exact-match backstop.
    """
    serialized = serialize_messages(messages, flatten=provider.flatten_content)
    used_memories = _inject_memory_context(
        serialized, messages, db=db, user_id=user_id
    )
    suggestions: list[MemorySuggestion] = []
    outfit_suggestions: list[OutfitSuggestion] = []
    response = _generate_answer(
        serialized,
        provider=provider,
        db=db,
        user_id=user_id,
        temperature=temperature,
        max_tokens=max_tokens,
        suggestions=suggestions,
        outfit_suggestions=outfit_suggestions,
    )
    suggestions = drop_stored_suggestions(
        db, user_id, _dedupe_suggestions(suggestions)
    )
    outfit_suggestions = filter_valid_outfit_suggestions(
        db, user_id, outfit_suggestions
    )
    return response.model_copy(
        update={
            "memory_suggestions": suggestions,
            "memories_used": [
                MemoryResponse.model_validate(memory) for memory in used_memories
            ],
            "outfit_suggestions": outfit_suggestions,
        }
    )
