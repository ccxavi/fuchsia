from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.auth import (
    AuthenticatedUser,
    VerifiedTokenClaims,
    get_current_authenticated_user,
)
from app.db.base import Base
from app.db.session import get_db_session
from app.main import app
from app.models.clothing_item import ClothingItem
from app.models.style_tips import StyleTips
from app.models.user import User
from app.v1.schemas import StyleTip

_USER_ID = "user-123"

_FAKE_TIPS = [
    StyleTip(title="Layer it up", description="Blazer over tee.", kind="pairing"),
]


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


class StyleTipsEndpointTestCase(unittest.TestCase):
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

        # Deterministic generator so tests never hit the network; the call count
        # is what proves the cache is (or isn't) short-circuiting.
        generate_patcher = patch(
            "app.v1.style_tips.generate_style_tips", return_value=_FAKE_TIPS
        )
        self.mock_generate = generate_patcher.start()
        self.addCleanup(generate_patcher.stop)

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

    def _override_auth(self) -> None:
        app.dependency_overrides[get_current_authenticated_user] = _authenticated_user

    def _seed_item(
        self,
        item_id: str,
        name: str,
        category: str | None = None,
        color: str | None = None,
    ) -> None:
        with self.session_factory() as session:
            session.add(
                ClothingItem(
                    id=item_id,
                    user_id=_USER_ID,
                    name=name,
                    category=category,
                    color=color,
                )
            )
            session.commit()

    def _stored_rows(self) -> list[StyleTips]:
        with self.session_factory() as session:
            return list(session.scalars(select(StyleTips)).all())

    def _get(self, **params) -> dict:
        response = self.client.get("/api/v1/style-tips", params=params)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_returns_401_without_auth(self) -> None:
        response = self.client.get("/api/v1/style-tips")
        self.assertEqual(response.status_code, 401)

    def test_first_call_generates_and_persists(self) -> None:
        self._override_auth()
        self._seed_item("1", "Navy Blazer", "Outerwear", "navy")

        body = self._get()

        self.assertFalse(body["cached"])
        self.assertEqual(len(body["tips"]), 1)
        self.assertEqual(body["tips"][0]["title"], "Layer it up")
        self.assertEqual(self.mock_generate.call_count, 1)
        self.assertEqual(len(self._stored_rows()), 1)

    def test_second_call_unchanged_wardrobe_is_cached(self) -> None:
        self._override_auth()
        self._seed_item("1", "Navy Blazer", "Outerwear", "navy")

        self._get()
        body = self._get()

        self.assertTrue(body["cached"])
        # Generator ran only for the first (miss) call.
        self.assertEqual(self.mock_generate.call_count, 1)
        self.assertEqual(len(self._stored_rows()), 1)

    def test_rename_keeps_cache_with_coarse_fingerprint(self) -> None:
        self._override_auth()
        self._seed_item("1", "Navy Blazer", "Outerwear", "navy")
        self._get()

        # Rename only — category/color unchanged, so the coarse fingerprint holds.
        with self.session_factory() as session:
            item = session.get(ClothingItem, "1")
            item.name = "Midnight Blazer"
            session.commit()

        body = self._get()

        self.assertTrue(body["cached"])
        self.assertEqual(self.mock_generate.call_count, 1)

    def test_adding_item_regenerates(self) -> None:
        self._override_auth()
        self._seed_item("1", "Navy Blazer", "Outerwear", "navy")
        self._get()

        self._seed_item("2", "Loafers", "Shoes", "brown")
        body = self._get()

        self.assertFalse(body["cached"])
        self.assertEqual(self.mock_generate.call_count, 2)

    def test_refresh_forces_regeneration(self) -> None:
        self._override_auth()
        self._seed_item("1", "Navy Blazer", "Outerwear", "navy")
        self._get()

        body = self._get(refresh="true")

        self.assertFalse(body["cached"])
        self.assertEqual(self.mock_generate.call_count, 2)

    def test_empty_wardrobe_returns_empty_without_llm(self) -> None:
        self._override_auth()

        body = self._get()

        self.assertFalse(body["cached"])
        self.assertEqual(body["tips"], [])
        self.mock_generate.assert_not_called()
        # A row is still written so the next unchanged call is a cache hit.
        self.assertEqual(len(self._stored_rows()), 1)

        cached = self._get()
        self.assertTrue(cached["cached"])
        self.mock_generate.assert_not_called()


if __name__ == "__main__":
    unittest.main()
