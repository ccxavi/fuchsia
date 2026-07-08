from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.auth import (
    AuthenticatedUser,
    VerifiedTokenClaims,
    get_current_authenticated_user,
)
from app.db.base import Base
from app.db.session import get_db_session
from app.main import app
from app.models.memory import Memory
from app.models.user import User

_USER_ID = "user-123"


def _authenticated_user() -> AuthenticatedUser:
    claims = VerifiedTokenClaims(
        subject="supabase-user-123",
        issuer="https://demo-project.supabase.co/auth/v1",
        expires_at=1_900_000_000,
        audience=("authenticated",),
        email="user@example.com",
        role="authenticated",
    )
    user = User(
        id=_USER_ID,
        supabase_user_id="supabase-user-123",
        email="user@example.com",
    )
    return AuthenticatedUser(claims=claims, user=user)


class MemoryEndpointTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)

        self.client = TestClient(app)
        app.dependency_overrides[get_db_session] = self._get_db
        app.dependency_overrides[get_current_authenticated_user] = _authenticated_user

        # Ingest embeds new rows; default to "no embedding provider" so tests are
        # deterministic and never hit the network. Individual tests override this.
        embed_patcher = patch("app.v1.memories.embed_texts", return_value=None)
        self.mock_embed = embed_patcher.start()
        self.addCleanup(embed_patcher.stop)

    def tearDown(self) -> None:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def _get_db(self):
        session = self.session_factory()
        try:
            yield session
        finally:
            session.close()

    def _stored_memories(self) -> list[Memory]:
        with self.session_factory() as session:
            return list(session.scalars(select(Memory).order_by(Memory.content)).all())

    def _seed(self, content: str, category: str | None) -> None:
        with self.session_factory() as session:
            session.add(
                Memory(user_id=_USER_ID, content=content, category=category)
            )
            session.commit()

    def test_ingest_persists_and_returns_created(self) -> None:
        response = self.client.post(
            "/api/v1/memories",
            json={
                "memories": [
                    {"content": "Never wears heels", "category": "preference"},
                    {"content": "Wears size M tops", "category": "measurement"},
                ]
            },
        )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(len(body), 2)
        for item in body:
            self.assertIn("id", item)
            self.assertIn("created_at", item)
            self.assertIn("updated_at", item)
        self.assertEqual(len(self._stored_memories()), 2)

    def test_skips_duplicate_already_in_db(self) -> None:
        self._seed("Never wears heels", "preference")

        response = self.client.post(
            "/api/v1/memories",
            json={
                "memories": [
                    {"content": "Never wears heels", "category": "preference"},
                    {"content": "Loves linen", "category": "preference"},
                ]
            },
        )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(len(body), 1)
        self.assertEqual(body[0]["content"], "Loves linen")
        self.assertEqual(len(self._stored_memories()), 2)

    def test_collapses_duplicates_within_payload(self) -> None:
        response = self.client.post(
            "/api/v1/memories",
            json={
                "memories": [
                    {"content": "Never wears heels", "category": "preference"},
                    {"content": "never wears heels", "category": "preference"},
                ]
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(len(self._stored_memories()), 1)

    def test_unknown_category_coerced_to_null(self) -> None:
        response = self.client.post(
            "/api/v1/memories",
            json={"memories": [{"content": "Attends galas", "category": "random"}]},
        )

        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.json()[0]["category"])
        stored = self._stored_memories()
        self.assertEqual(len(stored), 1)
        self.assertIsNone(stored[0].category)

    def test_empty_list_returns_422(self) -> None:
        response = self.client.post("/api/v1/memories", json={"memories": []})

        self.assertEqual(response.status_code, 422)

    def test_ingest_stores_embeddings(self) -> None:
        self.mock_embed.return_value = [[0.1] * 768, [0.2] * 768]

        response = self.client.post(
            "/api/v1/memories",
            json={
                "memories": [
                    {"content": "Never wears heels", "category": "preference"},
                    {"content": "Wears size M tops", "category": "measurement"},
                ]
            },
        )

        self.assertEqual(response.status_code, 201)
        stored = self._stored_memories()
        self.assertEqual(len(stored), 2)
        self.assertTrue(all(memory.embedding is not None for memory in stored))
        # Embedding is requested for exactly the created rows' contents.
        (contents,), _ = self.mock_embed.call_args
        self.assertEqual(len(contents), 2)

    def test_ingest_persists_without_embedding_when_unavailable(self) -> None:
        self.mock_embed.return_value = None

        response = self.client.post(
            "/api/v1/memories",
            json={"memories": [{"content": "Loves linen", "category": "preference"}]},
        )

        self.assertEqual(response.status_code, 201)
        stored = self._stored_memories()
        self.assertEqual(len(stored), 1)
        self.assertIsNone(stored[0].embedding)

    def test_requires_auth(self) -> None:
        app.dependency_overrides.pop(get_current_authenticated_user, None)

        response = self.client.post(
            "/api/v1/memories",
            json={"memories": [{"content": "Never wears heels"}]},
        )

        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
