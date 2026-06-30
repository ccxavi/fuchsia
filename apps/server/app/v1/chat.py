from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import AuthenticatedUser, get_current_authenticated_user
from app.services.deepseek import create_chat_completion
from app.v1.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat")


@router.post("", response_model=ChatResponse, summary="Generate a DeepSeek chat completion")
def chat(
    payload: ChatRequest,
    authenticated_user: Annotated[
        AuthenticatedUser, Depends(get_current_authenticated_user)
    ],
) -> ChatResponse:
    return create_chat_completion(
        payload.messages,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
    )
