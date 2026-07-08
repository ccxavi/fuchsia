from __future__ import annotations

import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.memory import Memory
from app.services.agent.memory import (
    _parse_suggestions,
    drop_stored_suggestions,
)
from app.v1.schemas import MemorySuggestion


class ParseSuggestionsTestCase(unittest.TestCase):
    def test_parses_plain_array(self) -> None:
        result = _parse_suggestions(
            '[{"content": "Never wears heels", "category": "preference"}]'
        )

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].content, "Never wears heels")
        self.assertEqual(result[0].category, "preference")

    def test_parses_code_fenced_array(self) -> None:
        text = '```json\n[{"content": "Wears size M tops", "category": "measurement"}]\n```'

        result = _parse_suggestions(text)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].category, "measurement")

    def test_accepts_memories_object_wrapper(self) -> None:
        result = _parse_suggestions('{"memories": [{"content": "Loves linen"}]}')

        self.assertEqual(len(result), 1)
        self.assertIsNone(result[0].category)

    def test_unknown_category_becomes_none(self) -> None:
        result = _parse_suggestions('[{"content": "X", "category": "vibe"}]')

        self.assertEqual(len(result), 1)
        self.assertIsNone(result[0].category)

    def test_deduplicates(self) -> None:
        result = _parse_suggestions(
            '[{"content": "Never wears heels", "category": "preference"},'
            ' {"content": "never wears heels", "category": "preference"}]'
        )

        self.assertEqual(len(result), 1)

    def test_junk_returns_empty(self) -> None:
        self.assertEqual(_parse_suggestions("sorry, nothing to remember"), [])
        self.assertEqual(_parse_suggestions("[]"), [])
        self.assertEqual(_parse_suggestions('[{"category": "fact"}]'), [])


_USER_ID = "user-123"


class DropStoredSuggestionsTestCase(unittest.TestCase):
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

    def _store(self, content: str, *, user_id: str = _USER_ID) -> None:
        with self.session_factory() as session:
            session.add(Memory(user_id=user_id, content=content, category=None))
            session.commit()

    @staticmethod
    def _suggestions(*contents: str) -> list[MemorySuggestion]:
        return [MemorySuggestion(content=content) for content in contents]

    def test_drops_already_stored_content(self) -> None:
        self._store("Never wears heels")

        with self.session_factory() as session:
            result = drop_stored_suggestions(
                session,
                _USER_ID,
                self._suggestions("Never wears heels", "Loves linen"),
            )

        self.assertEqual([s.content for s in result], ["Loves linen"])

    def test_match_is_case_insensitive(self) -> None:
        self._store("Never Wears Heels")

        with self.session_factory() as session:
            result = drop_stored_suggestions(
                session, _USER_ID, self._suggestions("never wears heels")
            )

        self.assertEqual(result, [])

    def test_is_scoped_to_user(self) -> None:
        self._store("Never wears heels", user_id="other-user")

        with self.session_factory() as session:
            result = drop_stored_suggestions(
                session, _USER_ID, self._suggestions("Never wears heels")
            )

        self.assertEqual([s.content for s in result], ["Never wears heels"])

    def test_empty_input_returns_empty(self) -> None:
        with self.session_factory() as session:
            self.assertEqual(drop_stored_suggestions(session, _USER_ID, []), [])


if __name__ == "__main__":
    unittest.main()
