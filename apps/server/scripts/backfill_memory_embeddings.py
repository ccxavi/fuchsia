"""Backfill embeddings for memories that don't have one yet.

Run once after deploying the embedding column so memories created before this
feature (or persisted during a Gemini outage) become retrievable in chat:

    uv run python -m scripts.backfill_memory_embeddings

Idempotent: only touches rows where ``embedding IS NULL``, so it is safe to
re-run. Requires DATABASE_URL and the Gemini settings to be configured.
"""

from __future__ import annotations

from sqlalchemy import select

from app.db.session import get_session_factory
from app.models.memory import Memory
from app.services.embeddings import embed_texts

BATCH_SIZE = 50


def main() -> None:
    session_factory = get_session_factory()
    with session_factory() as session:
        pending = session.scalars(
            select(Memory).where(Memory.embedding.is_(None))
        ).all()

        if not pending:
            print("No memories need embedding.")
            return

        total = len(pending)
        embedded = 0
        for start in range(0, total, BATCH_SIZE):
            batch = pending[start : start + BATCH_SIZE]
            vectors = embed_texts([memory.content for memory in batch])
            if not vectors or len(vectors) != len(batch):
                print(f"Embedding failed for batch at offset {start}; skipping.")
                continue

            for memory, vector in zip(batch, vectors):
                memory.embedding = vector
                embedded += 1
            session.commit()

        print(f"Embedded {embedded}/{total} memories.")


if __name__ == "__main__":
    main()
