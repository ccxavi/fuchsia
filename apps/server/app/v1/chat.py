from __future__ import annotations

import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.auth import AuthenticatedUser, get_current_authenticated_user
from app.db.session import get_db_session
from app.services.agent import (
    build_stylist_messages,
    deepseek_provider,
    gemini_provider,
    run_stylist_chat,
    stream_stylist_chat,
)
from app.v1.schemas import ChatMessage, ChatRequest, ChatResponse, ImagePart

router = APIRouter(prefix="/chat")


def _has_image(messages: list[ChatMessage]) -> bool:
    return any(
        isinstance(message.content, list)
        and any(isinstance(part, ImagePart) for part in message.content)
        for message in messages
    )


@router.post(
    "",
    response_model=ChatResponse,
    summary="Generate a stylist chat completion (DeepSeek text / Gemini vision)",
)
def chat(
    payload: ChatRequest,
    authenticated_user: Annotated[
        AuthenticatedUser, Depends(get_current_authenticated_user)
    ],
    db: Annotated[Session, Depends(get_db_session)],
) -> ChatResponse:
    provider = (
        gemini_provider()
        if _has_image(payload.messages)
        else deepseek_provider()
    )
    messages = build_stylist_messages(payload.messages)
    return run_stylist_chat(
        messages,
        provider=provider,
        db=db,
        user_id=authenticated_user.user.id,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
        latitude=payload.latitude,
        longitude=payload.longitude,
        today=datetime.date.today(),
    )


@router.post(
    "/stream",
    summary="Stream a stylist chat completion over SSE (status, token, done)",
)
def chat_stream(
    payload: ChatRequest,
    authenticated_user: Annotated[
        AuthenticatedUser, Depends(get_current_authenticated_user)
    ],
    db: Annotated[Session, Depends(get_db_session)],
) -> StreamingResponse:
    provider = (
        gemini_provider()
        if _has_image(payload.messages)
        else deepseek_provider()
    )
    messages = build_stylist_messages(payload.messages)
    generator = stream_stylist_chat(
        messages,
        provider=provider,
        db=db,
        user_id=authenticated_user.user.id,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
        latitude=payload.latitude,
        longitude=payload.longitude,
        today=datetime.date.today(),
    )
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            # Declaring an encoding makes GZipMiddleware pass the stream through
            # untouched, so SSE frames flush in real time instead of being
            # buffered/compressed by the global gzip middleware.
            "Content-Encoding": "identity",
        },
    )
