from __future__ import annotations

import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.clothing_item import ClothingItem
from app.models.wardrobe import Wardrobe
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
        self.assertEqual(result[0].wardrobe_ids, [])

    def test_parses_wardrobe_ids_when_present(self) -> None:
        result = _parse_outfit_suggestions(
            '[{"name": "Summer Brunch", "clothing_item_ids": ["a"],'
            ' "wardrobe_ids": ["w1", "w2"]}]'
        )

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].wardrobe_ids, ["w1", "w2"])

    def test_parses_code_fenced_array(self) -> None:
        text = (
            '```json\n[{"name": "Office", "clothing_item_ids": ["a"]}]\n```'
        )

        result = _parse_outfit_suggestions(text)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].name, "Office")

    def test_discarding_a_malformed_suggestion_is_logged(self) -> None:
        # A blank name fails the schema and the outfit vanishes; say so.
        with self.assertLogs("app.services.agent.outfits", level="WARNING") as logs:
            result = _parse_outfit_suggestions(
                '[{"name": "", "clothing_item_ids": ["a"]}]'
            )

        self.assertEqual(result, [])
        self.assertIn("Discarding a malformed outfit suggestion", logs.output[0])

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
        self._seed()

    def tearDown(self) -> None:
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def _seed(self) -> None:
        with self.session_factory() as session:
            jeans = ClothingItem(user_id=_USER_ID, name="Blue jeans")
            tee = ClothingItem(user_id=_USER_ID, name="White tee")
            other = ClothingItem(user_id="other-user", name="Not yours")
            wardrobe = Wardrobe(user_id=_USER_ID, name="Summer")
            other_wardrobe = Wardrobe(user_id="other-user", name="Theirs")
            session.add_all([jeans, tee, other, wardrobe, other_wardrobe])
            session.commit()
            self.owned_ids = [jeans.id, tee.id]
            self.wardrobe_id = wardrobe.id
            self.other_wardrobe_id = other_wardrobe.id

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

    def test_dropping_an_outfit_is_logged(self) -> None:
        # A dropped outfit is invisible in the UI and indistinguishable in the
        # audit table from the model never calling the tool. It must not also
        # be invisible in the logs.
        suggestion = OutfitSuggestion(
            name="Ghost fit", clothing_item_ids=["nope-1", "nope-2"]
        )

        with self.session_factory() as session:
            with self.assertLogs("app.services.agent.outfits", level="WARNING") as logs:
                filter_valid_outfit_suggestions(session, _USER_ID, [suggestion])

        self.assertIn("Dropping outfit suggestion", logs.output[0])
        self.assertIn(_USER_ID, logs.output[0])

    def test_stripping_unowned_ids_is_logged(self) -> None:
        # A 4-piece outfit silently becoming a 1-piece outfit is its own bug.
        suggestion = OutfitSuggestion(
            name="Weekend",
            clothing_item_ids=[self.owned_ids[0], "made-up-id"],
        )

        with self.session_factory() as session:
            with self.assertLogs("app.services.agent.outfits", level="WARNING") as logs:
                result = filter_valid_outfit_suggestions(session, _USER_ID, [suggestion])

        self.assertEqual(result[0].clothing_item_ids, [self.owned_ids[0]])
        self.assertIn("Stripping 1 unowned item id", logs.output[0])

    def test_valid_outfit_logs_nothing(self) -> None:
        suggestion = OutfitSuggestion(name="Fine", clothing_item_ids=self.owned_ids)

        with self.session_factory() as session:
            with self.assertNoLogs("app.services.agent.outfits", level="WARNING"):
                result = filter_valid_outfit_suggestions(session, _USER_ID, [suggestion])

        self.assertEqual(len(result), 1)

    def test_keeps_owned_wardrobe_ids(self) -> None:
        suggestion = OutfitSuggestion(
            name="Summer Brunch",
            clothing_item_ids=[self.owned_ids[0]],
            wardrobe_ids=[self.wardrobe_id],
        )

        with self.session_factory() as session:
            result = filter_valid_outfit_suggestions(session, _USER_ID, [suggestion])

        self.assertEqual(result[0].wardrobe_ids, [self.wardrobe_id])

    def test_drops_unknown_or_foreign_wardrobe_ids_but_keeps_outfit(self) -> None:
        suggestion = OutfitSuggestion(
            name="Weekend",
            clothing_item_ids=[self.owned_ids[0]],
            wardrobe_ids=[self.other_wardrobe_id, "made-up-wardrobe"],
        )

        with self.session_factory() as session:
            result = filter_valid_outfit_suggestions(session, _USER_ID, [suggestion])

        # The outfit survives (items are valid); only the bad wardrobe ids drop.
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].wardrobe_ids, [])

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
