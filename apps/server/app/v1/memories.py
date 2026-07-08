from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import AuthenticatedUser, get_current_authenticated_user
from app.db.session import get_db_session
from app.models.memory import Memory
from app.services.agent.memory import MEMORY_CATEGORIES
from app.services.embeddings import embed_texts
from app.v1.schemas import MemoryIngestRequest, MemoryResponse

router = APIRouter()


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=list[MemoryResponse],
    summary="Persist approved memory suggestions for the current user",
)
def ingest_memories(
    payload: MemoryIngestRequest,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
) -> list[Memory]:
    existing = db.scalars(
        select(Memory).where(Memory.user_id == user.user.id)
    ).all()
    seen = {(memory.content.lower(), memory.category) for memory in existing}

    created: list[Memory] = []
    for suggestion in payload.memories:
        # Keep the persisted category aligned with the extraction whitelist;
        # anything outside the known set is stored as None.
        category = suggestion.category if suggestion.category in MEMORY_CATEGORIES else None
        key = (suggestion.content.lower(), category)
        if key in seen:
            continue
        seen.add(key)
        memory = Memory(
            user_id=user.user.id,
            content=suggestion.content,
            category=category,
        )
        db.add(memory)
        created.append(memory)

    # Embed the new memories so they are retrievable in chat. Best-effort:
    # if embedding is unavailable, the rows are still persisted with a null
    # embedding (and can be filled later via the backfill script) rather than
    # failing the user's approval action.
    if created:
        vectors = embed_texts([memory.content for memory in created])
        if vectors and len(vectors) == len(created):
            for memory, vector in zip(created, vectors):
                memory.embedding = vector

    db.commit()
    for memory in created:
        db.refresh(memory)
    return created
