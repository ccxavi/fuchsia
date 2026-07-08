from __future__ import annotations

import json
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.clothing_item import ClothingItem
from app.services.agent.tools import execute_tool, get_clothing_items


class StylistToolsTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.session = Session(bind=self.engine)
        self._seed()

    def tearDown(self) -> None:
        self.session.close()
        self.engine.dispose()

    def _seed(self) -> None:
        self.session.add_all(
            [
                ClothingItem(
                    user_id="user-1",
                    name="Blue jeans",
                    category="Bottoms",
                    color="Blue",
                    brand="Levi's",
                    is_favorite=True,
                ),
                ClothingItem(
                    user_id="user-1",
                    name="White tee",
                    category="Tops",
                    color="White",
                    brand="Nike",
                    is_favorite=False,
                ),
                ClothingItem(
                    user_id="user-2",
                    name="Someone else's coat",
                    category="Outerwear",
                    color="Black",
                    brand="Zara",
                    is_favorite=True,
                ),
            ]
        )
        self.session.commit()

    def test_returns_only_the_users_items(self) -> None:
        items = get_clothing_items(self.session, "user-1")

        names = {item["name"] for item in items}
        self.assertEqual(names, {"Blue jeans", "White tee"})

    def test_category_filter_is_case_insensitive(self) -> None:
        items = get_clothing_items(self.session, "user-1", category="tops")

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["name"], "White tee")

    def test_color_filter_is_case_insensitive(self) -> None:
        items = get_clothing_items(self.session, "user-1", color="BLUE")

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["name"], "Blue jeans")

    def test_favorites_only(self) -> None:
        items = get_clothing_items(self.session, "user-1", favorites_only=True)

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["name"], "Blue jeans")

    def test_execute_tool_returns_json_payload(self) -> None:
        result = execute_tool(
            "get_clothing_items", {"category": "tops"}, db=self.session, user_id="user-1"
        )

        parsed = json.loads(result)
        self.assertEqual(parsed["count"], 1)
        self.assertEqual(parsed["items"][0]["name"], "White tee")

    def test_execute_tool_unknown_name(self) -> None:
        result = execute_tool("do_something", {}, db=self.session, user_id="user-1")

        parsed = json.loads(result)
        self.assertIn("error", parsed)

    def test_execute_tool_ignores_bad_argument_types(self) -> None:
        result = execute_tool(
            "get_clothing_items",
            {"category": 123, "favorites_only": "yes"},
            db=self.session,
            user_id="user-1",
        )

        parsed = json.loads(result)
        # Non-string category is ignored; truthy favorites_only keeps only favorites.
        self.assertEqual(parsed["count"], 1)
        self.assertEqual(parsed["items"][0]["name"], "Blue jeans")

    def test_empty_wardrobe_returns_empty(self) -> None:
        result = execute_tool(
            "get_clothing_items", {}, db=self.session, user_id="user-nobody"
        )

        parsed = json.loads(result)
        self.assertEqual(parsed["count"], 0)
        self.assertEqual(parsed["items"], [])


if __name__ == "__main__":
    unittest.main()
