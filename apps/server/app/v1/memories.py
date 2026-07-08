from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import AuthenticatedUser, get_current_authenticated_user
from app.db.session import get_db_session
from app.models.memory import Memory
from app.services.agent.memory import MEMORY_CATEGORIES
from app.services.embeddings import embed_texts
from app.v1.schemas import MemoryIngestRequest, MemoryResponse, MemoryUpdateRequest

router = APIRouter()


def _get_owned_memory(db: Session, memory_id: str, user_id: str) -> Memory | None:
    return db.scalar(
        select(Memory).where(Memory.id == memory_id, Memory.user_id == user_id)
    )


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


@router.get(
    "",
    response_model=list[MemoryResponse],
    summary="List the current user's memories (newest first)",
)
def list_memories(
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
    category: Annotated[str | None, Query(description="Filter by category")] = None,
) -> list[Memory]:
    stmt = select(Memory).where(Memory.user_id == user.user.id)
    if category is not None:
        stmt = stmt.where(Memory.category == category)
    return list(db.scalars(stmt.order_by(Memory.created_at.desc())).all())


@router.get(
    "/{memory_id}",
    response_model=MemoryResponse,
    summary="Get a single memory",
)
def get_memory(
    memory_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
) -> Memory:
    memory = _get_owned_memory(db, memory_id, user.user.id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@router.patch(
    "/{memory_id}",
    response_model=MemoryResponse,
    summary="Update a memory's content or category",
)
def update_memory(
    memory_id: str,
    data: MemoryUpdateRequest,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
) -> Memory:
    memory = _get_owned_memory(db, memory_id, user.user.id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    if data.content is not None and data.content != memory.content:
        memory.content = data.content
        # Re-embed so retrieval matches the new text. Best-effort: drop the stale
        # vector on failure (a null embedding is excluded from retrieval until the
        # backfill script refills it — better than matching the old content).
        vectors = embed_texts([data.content])
        memory.embedding = vectors[0] if vectors else None

    if data.category is not None:
        memory.category = (
            data.category if data.category in MEMORY_CATEGORIES else None
        )

    db.commit()
    db.refresh(memory)
    return memory


@router.delete(
    "/{memory_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a memory",
)
def delete_memory(
    memory_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
) -> None:
    memory = _get_owned_memory(db, memory_id, user.user.id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    db.delete(memory)
    db.commit()
