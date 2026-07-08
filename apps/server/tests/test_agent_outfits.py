from __future__ import annotations

import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.clothing_item import ClothingItem
from app.services.agent.outfits import (
    _parse_outfit_suggestions,
    filter_valid_outfit_suggestions,
)
from app.v1.schemas import OutfitSuggestion


class ParseOutfitSuggestionsTestCase(unittest.TestCase):
    def test_parses_plain_array(self) -> None:
        result = _parse_outfit_suggestions(
            '[{"name": "Casual Friday", "clothing_item_ids": ["a", "b"],'
            ' "rationale": "Relaxed but put-together."}]'
        )

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].name, "Casual Friday")
        self.assertEqual(result[0].clothing_item_ids, ["a", "b"])
        self.assertEqual(result[0].rationale, "Relaxed but put-together.")

    def test_accepts_outfits_object_wrapper(self) -> None:
        result = _parse_outfit_suggestions(
            '{"outfits": [{"name": "Date Night", "clothing_item_ids": ["x"]}]}'
        )

        self.assertEqual(len(result), 1)
        self.assertIsNone(result[0].rationale)

    def test_parses_code_fenced_array(self) -> None:
        text = (
            '```json\n[{"name": "Office", "clothing_item_ids": ["a"]}]\n```'
        )

        result = _parse_outfit_suggestions(text)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].name, "Office")

    def test_deduplicates_by_name_and_ids(self) -> None:
        result = _parse_outfit_suggestions(
            '[{"name": "Look", "clothing_item_ids": ["a", "b"]},'
            ' {"name": "look", "clothing_item_ids": ["a", "b"]}]'
        )

        self.assertEqual(len(result), 1)

    def test_junk_returns_empty(self) -> None:
        self.assertEqual(_parse_outfit_suggestions("no outfit for you"), [])
        self.assertEqual(_parse_outfit_suggestions("[]"), [])
        # Missing name and missing/empty ids are both dropped.
        self.assertEqual(
            _parse_outfit_suggestions('[{"clothing_item_ids": ["a"]}]'), []
        )
        self.assertEqual(
            _parse_outfit_suggestions('[{"name": "X", "clothing_item_ids": []}]'), []
        )


_USER_ID = "user-123"


class FilterValidOutfitSuggestionsTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.owned_ids = self._seed()

    def tearDown(self) -> None:
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def _seed(self) -> list[str]:
        with self.session_factory() as session:
            jeans = ClothingItem(user_id=_USER_ID, name="Blue jeans")
            tee = ClothingItem(user_id=_USER_ID, name="White tee")
            other = ClothingItem(user_id="other-user", name="Not yours")
            session.add_all([jeans, tee, other])
            session.commit()
            return [jeans.id, tee.id]

    def test_drops_unknown_and_foreign_ids(self) -> None:
        suggestion = OutfitSuggestion(
            name="Weekend",
            clothing_item_ids=[self.owned_ids[0], "made-up-id"],
        )

        with self.session_factory() as session:
            result = filter_valid_outfit_suggestions(session, _USER_ID, [suggestion])

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].clothing_item_ids, [self.owned_ids[0]])

    def test_drops_outfit_when_no_valid_items_remain(self) -> None:
        suggestion = OutfitSuggestion(
            name="Ghost fit", clothing_item_ids=["nope-1", "nope-2"]
        )

        with self.session_factory() as session:
            result = filter_valid_outfit_suggestions(session, _USER_ID, [suggestion])

        self.assertEqual(result, [])

    def test_empty_input_returns_empty(self) -> None:
        with self.session_factory() as session:
            self.assertEqual(filter_valid_outfit_suggestions(session, _USER_ID, []), [])

    def test_passes_through_on_db_error(self) -> None:
        suggestion = OutfitSuggestion(name="Look", clothing_item_ids=["nope"])

        with self.session_factory() as session:
            with patch.object(
                session, "scalars", side_effect=SQLAlchemyError("boom")
            ):
                result = filter_valid_outfit_suggestions(
                    session, _USER_ID, [suggestion]
                )

        self.assertEqual(result, [suggestion])


if __name__ == "__main__":
    unittest.main()
