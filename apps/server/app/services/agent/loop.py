from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.services.agent.openai_compat import (
    Provider,
    build_body,
    first_choice_message,
    parse_chat_response,
    post_chat,
    serialize_messages,
)
from app.services.agent.tools import STYLIST_TOOLS, execute_tool
from app.v1.schemas import ChatMessage, ChatResponse

MAX_TOOL_ROUNDS = 4


def _parse_arguments(raw_arguments: Any) -> dict[str, Any]:
    if not isinstance(raw_arguments, str) or not raw_arguments.strip():
        return {}
    try:
        parsed = json.loads(raw_arguments)
    except ValueError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _run_tool_call(
    tool_call: dict[str, Any], *, db: Session, user_id: str
) -> dict[str, Any]:
    function = tool_call.get("function") or {}
    name = function.get("name") or ""
    arguments = _parse_arguments(function.get("arguments"))
    content = execute_tool(name, arguments, db=db, user_id=user_id)
    return {
        "role": "tool",
        "tool_call_id": tool_call.get("id"),
        "content": content,
    }


def run_stylist_chat(
    messages: list[ChatMessage],
    *,
    provider: Provider,
    db: Session,
    user_id: str,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> ChatResponse:
    """Drive a chat completion, resolving any tool calls the model makes.

    Loops up to ``MAX_TOOL_ROUNDS`` while the model requests tools; once it
    returns a plain answer that answer is returned. If the model never stops
    requesting tools, a final request without tools forces a text answer.
    """
    serialized = serialize_messages(
        messages, flatten=provider.flatten_content
    )

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
            serialized.append(_run_tool_call(tool_call, db=db, user_id=user_id))

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
