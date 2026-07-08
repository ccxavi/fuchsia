from __future__ import annotations

import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.memory import Memory
from app.services.agent.recall import (
    build_memory_context_block,
    retrieve_relevant_memories,
    search_similar_memories,
)

_USER_ID = "user-123"


class RecallTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)

    def tearDown(self) -> None:
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def _seed(self, content: str, embedding: list[float], *, category: str | None = None,
              user_id: str = _USER_ID) -> None:
        with self.session_factory() as session:
            session.add(
                Memory(
                    user_id=user_id,
                    content=content,
                    category=category,
                    embedding=embedding,
                )
            )
            session.commit()

    def test_search_ranks_by_cosine_and_applies_cutoff(self) -> None:
        # Query points along [1, 0]. "near" is aligned, "far" is orthogonal.
        self._seed("near", [1.0, 0.05], category="preference")
        self._seed("far", [0.0, 1.0])
        # A memory without an embedding must be ignored.
        self._seed("unembedded", [], category="fact")

        with self.session_factory() as session:
            results = search_similar_memories(
                session, _USER_ID, [1.0, 0.0], limit=6, max_distance=0.5
            )

        contents = [memory.content for memory in results]
        self.assertEqual(contents, ["near"])

    def test_search_is_scoped_to_user(self) -> None:
        self._seed("mine", [1.0, 0.0])
        self._seed("theirs", [1.0, 0.0], user_id="other-user")

        with self.session_factory() as session:
            results = search_similar_memories(
                session, _USER_ID, [1.0, 0.0], limit=6, max_distance=0.5
            )

        self.assertEqual([memory.content for memory in results], ["mine"])

    def test_search_respects_limit(self) -> None:
        for i in range(4):
            self._seed(f"m{i}", [1.0, 0.0])

        with self.session_factory() as session:
            results = search_similar_memories(
                session, _USER_ID, [1.0, 0.0], limit=2, max_distance=0.5
            )

        self.assertEqual(len(results), 2)

    def test_build_context_block_formats_categories(self) -> None:
        memories = [
            Memory(user_id=_USER_ID, content="Never wears heels", category="preference"),
            Memory(user_id=_USER_ID, content="Attends galas", category=None),
        ]

        block = build_memory_context_block(memories)

        self.assertIn("- Never wears heels (preference)", block)
        self.assertIn("- Attends galas", block)
        self.assertNotIn("Attends galas (", block)

    def test_retrieve_returns_relevant_memory(self) -> None:
        self._seed("Never wears heels", [1.0, 0.0], category="preference")

        with self.session_factory() as session, patch(
            "app.services.agent.recall.embed_query", return_value=[1.0, 0.0]
        ):
            memories = retrieve_relevant_memories(
                session, _USER_ID, "what shoes suit me?"
            )

        self.assertEqual([memory.content for memory in memories], ["Never wears heels"])

    def test_retrieve_returns_empty_when_query_blank(self) -> None:
        with self.session_factory() as session, patch(
            "app.services.agent.recall.embed_query"
        ) as embed_mock:
            self.assertEqual(retrieve_relevant_memories(session, _USER_ID, "   "), [])

        embed_mock.assert_not_called()

    def test_retrieve_returns_empty_when_embedding_unavailable(self) -> None:
        self._seed("Never wears heels", [1.0, 0.0])

        with self.session_factory() as session, patch(
            "app.services.agent.recall.embed_query", return_value=None
        ):
            self.assertEqual(retrieve_relevant_memories(session, _USER_ID, "shoes?"), [])

    def test_retrieve_returns_empty_when_no_hits(self) -> None:
        self._seed("Loves neon colors", [0.0, 1.0])

        with self.session_factory() as session, patch(
            "app.services.agent.recall.embed_query", return_value=[1.0, 0.0]
        ):
            self.assertEqual(retrieve_relevant_memories(session, _USER_ID, "shoes?"), [])


if __name__ == "__main__":
    unittest.main()
