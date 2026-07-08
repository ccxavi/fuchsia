from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import AuthenticatedUser, get_current_authenticated_user
from app.services.deepseek import create_chat_completion
from app.services.gemini import create_gemini_completion
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
    summary="Generate a chat completion (DeepSeek text / Gemini vision)",
)
def chat(
    payload: ChatRequest,
    authenticated_user: Annotated[
        AuthenticatedUser, Depends(get_current_authenticated_user)
    ],
) -> ChatResponse:
    complete = (
        create_gemini_completion
        if _has_image(payload.messages)
        else create_chat_completion
    )
    return complete(
        payload.messages,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
    )
