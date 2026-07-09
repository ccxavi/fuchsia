from __future__ import annotations

import datetime
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.outfit import Outfit
from app.services.agent.calendar import (
    _parse_calendar_suggestions,
    filter_valid_calendar_suggestions,
)
from app.v1.schemas import CalendarSuggestion


class ParseCalendarSuggestionsTestCase(unittest.TestCase):
    def test_parses_plain_array(self) -> None:
        result = _parse_calendar_suggestions(
            '[{"outfit_id": "o1", "date": "2026-07-11", "notes": "Brunch"}]'
        )

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].outfit_id, "o1")
        self.assertEqual(result[0].date, datetime.date(2026, 7, 11))
        self.assertEqual(result[0].notes, "Brunch")

    def test_accepts_entries_object_wrapper(self) -> None:
        result = _parse_calendar_suggestions(
            '{"entries": [{"outfit_id": "o1", "date": "2026-07-11"}]}'
        )

        self.assertEqual(len(result), 1)
        self.assertIsNone(result[0].notes)

    def test_drops_malformed_dates(self) -> None:
        result = _parse_calendar_suggestions(
            '[{"outfit_id": "o1", "date": "not-a-date"},'
            ' {"outfit_id": "o2", "date": "2026-07-12"}]'
        )

        self.assertEqual([s.outfit_id for s in result], ["o2"])

    def test_deduplicates_by_outfit_and_date(self) -> None:
        result = _parse_calendar_suggestions(
            '[{"outfit_id": "o1", "date": "2026-07-11"},'
            ' {"outfit_id": "o1", "date": "2026-07-11"}]'
        )

        self.assertEqual(len(result), 1)

    def test_junk_returns_empty(self) -> None:
        self.assertEqual(_parse_calendar_suggestions("nothing scheduled"), [])
        self.assertEqual(_parse_calendar_suggestions("[]"), [])
        self.assertEqual(
            _parse_calendar_suggestions('[{"date": "2026-07-11"}]'), []
        )


_USER_ID = "user-123"


class FilterValidCalendarSuggestionsTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.outfit_id, self.other_outfit_id = self._seed()

    def tearDown(self) -> None:
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def _seed(self) -> tuple[str, str]:
        with self.session_factory() as session:
            mine = Outfit(user_id=_USER_ID, name="Casual Friday")
            theirs = Outfit(user_id="other-user", name="Not yours")
            session.add_all([mine, theirs])
            session.commit()
            return mine.id, theirs.id

    def _suggestion(self, outfit_id: str) -> CalendarSuggestion:
        return CalendarSuggestion(outfit_id=outfit_id, date=datetime.date(2026, 7, 11))

    def test_keeps_owned_outfit(self) -> None:
        with self.session_factory() as session:
            result = filter_valid_calendar_suggestions(
                session, _USER_ID, [self._suggestion(self.outfit_id)]
            )

        self.assertEqual([s.outfit_id for s in result], [self.outfit_id])

    def test_drops_unknown_or_foreign_outfit(self) -> None:
        with self.session_factory() as session:
            result = filter_valid_calendar_suggestions(
                session,
                _USER_ID,
                [
                    self._suggestion(self.other_outfit_id),
                    self._suggestion("made-up-outfit"),
                ],
            )

        self.assertEqual(result, [])

    def test_empty_input_returns_empty(self) -> None:
        with self.session_factory() as session:
            self.assertEqual(
                filter_valid_calendar_suggestions(session, _USER_ID, []), []
            )

    def test_passes_through_on_db_error(self) -> None:
        suggestion = self._suggestion("whatever")

        with self.session_factory() as session:
            with patch.object(
                session, "scalars", side_effect=SQLAlchemyError("boom")
            ):
                result = filter_valid_calendar_suggestions(
                    session, _USER_ID, [suggestion]
                )

        self.assertEqual(result, [suggestion])


if __name__ == "__main__":
    unittest.main()
