from __future__ import annotations

import math

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.memory import Memory
from app.services.embeddings import embed_query

RECALL_TOP_K = 6
# Cosine distance cutoff (0 = identical, 2 = opposite). ~0.5 keeps reasonably
# related memories while dropping unrelated ones.
RECALL_MAX_DISTANCE = 0.5


def retrieve_relevant_memories(
    db: Session,
    user_id: str,
    query_text: str,
    *,
    limit: int = RECALL_TOP_K,
    max_distance: float = RECALL_MAX_DISTANCE,
) -> list[Memory]:
    """Return the user's memories most relevant to ``query_text`` (may be empty).

    Best-effort: embeds the query and runs a similarity search scoped to the
    user. Any missing query, embedding failure, or DB error yields an empty list
    so retrieval never fails the chat reply. The caller both injects these into
    the prompt and surfaces them on the response.
    """
    if not query_text or not query_text.strip():
        return []

    query_embedding = embed_query(query_text)
    if not query_embedding:
        return []

    try:
        return search_similar_memories(
            db,
            user_id,
            query_embedding,
            limit=limit,
            max_distance=max_distance,
        )
    except SQLAlchemyError:
        return []


def search_similar_memories(
    db: Session,
    user_id: str,
    query_embedding: list[float],
    *,
    limit: int,
    max_distance: float,
) -> list[Memory]:
    """Find a user's memories closest to ``query_embedding`` by cosine distance.

    On Postgres this uses the pgvector ``<=>`` operator (index-backed). On other
    dialects (SQLite in tests/dev) it falls back to an in-Python cosine scan over
    the user's embedded memories — correct but unindexed, so dev/test only.
    """
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        distance = Memory.embedding.cosine_distance(query_embedding)
        rows = db.execute(
            select(Memory, distance.label("distance"))
            .where(Memory.user_id == user_id, Memory.embedding.isnot(None))
            .order_by(distance)
            .limit(limit)
        ).all()
        return [memory for memory, dist in rows if dist is not None and dist <= max_distance]

    memories = db.scalars(
        select(Memory).where(
            Memory.user_id == user_id, Memory.embedding.isnot(None)
        )
    ).all()

    threshold = 1.0 - max_distance
    scored: list[tuple[float, Memory]] = []
    for memory in memories:
        similarity = _cosine_similarity(query_embedding, memory.embedding)
        if similarity is None:
            continue
        scored.append((similarity, memory))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [memory for similarity, memory in scored if similarity >= threshold][:limit]


def build_memory_context_block(memories: list[Memory]) -> str:
    """Format memories into a compact system-prompt block."""
    lines = []
    for memory in memories:
        if memory.category:
            lines.append(f"- {memory.content} ({memory.category})")
        else:
            lines.append(f"- {memory.content}")

    return (
        "Relevant things you remember about this user (use them when helpful; "
        "do not recite them back verbatim):\n" + "\n".join(lines)
    )


def _cosine_similarity(
    left: list[float] | None, right: list[float] | None
) -> float | None:
    if not left or not right or len(left) != len(right):
        return None

    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return None

    return dot / (left_norm * right_norm)
