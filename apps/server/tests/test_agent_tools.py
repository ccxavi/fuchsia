from __future__ import annotations

import json
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.clothing_item import ClothingItem
from app.models.wardrobe import Wardrobe
from app.services.agent.tools import (
    STYLIST_TOOLS,
    execute_tool,
    get_clothing_items,
    get_wardrobes,
)


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

    def test_advertised_tools_cover_the_stylist_capabilities(self) -> None:
        names = {tool["function"]["name"] for tool in STYLIST_TOOLS}

        self.assertEqual(
            names,
            {
                "get_clothing_items",
                "get_wardrobes",
                "suggest_memories",
                "suggest_outfits",
                "get_weather",
            },
        )

    def test_items_include_id_so_outfits_can_reference_them(self) -> None:
        items = get_clothing_items(self.session, "user-1")

        self.assertTrue(all(isinstance(item["id"], str) and item["id"] for item in items))

    def test_empty_wardrobe_returns_empty(self) -> None:
        result = execute_tool(
            "get_clothing_items", {}, db=self.session, user_id="user-nobody"
        )

        parsed = json.loads(result)
        self.assertEqual(parsed["count"], 0)
        self.assertEqual(parsed["items"], [])

    def _seed_wardrobe(self) -> Wardrobe:
        """Create a 'Summer' wardrobe for user-1 holding only the white tee."""
        tee = self.session.scalar(
            select(ClothingItem).where(ClothingItem.name == "White tee")
        )
        wardrobe = Wardrobe(user_id="user-1", name="Summer")
        wardrobe.clothing_items.append(tee)
        self.session.add(wardrobe)
        self.session.commit()
        self.session.refresh(wardrobe)
        return wardrobe

    def test_wardrobe_filter_returns_only_that_wardrobes_items(self) -> None:
        wardrobe = self._seed_wardrobe()

        items = get_clothing_items(self.session, "user-1", wardrobe_id=wardrobe.id)

        self.assertEqual([item["name"] for item in items], ["White tee"])

    def test_wardrobe_filter_is_scoped_to_the_user(self) -> None:
        wardrobe = self._seed_wardrobe()

        # Another user cannot read items via someone else's wardrobe id.
        items = get_clothing_items(self.session, "user-2", wardrobe_id=wardrobe.id)

        self.assertEqual(items, [])

    def test_get_wardrobes_lists_users_wardrobes_with_counts(self) -> None:
        self._seed_wardrobe()

        wardrobes = get_wardrobes(self.session, "user-1")

        self.assertEqual(len(wardrobes), 1)
        self.assertEqual(wardrobes[0]["name"], "Summer")
        self.assertEqual(wardrobes[0]["item_count"], 1)
        self.assertIsInstance(wardrobes[0]["id"], str)

    def test_execute_tool_get_wardrobes_returns_json_payload(self) -> None:
        self._seed_wardrobe()

        result = execute_tool(
            "get_wardrobes", {}, db=self.session, user_id="user-1"
        )

        parsed = json.loads(result)
        self.assertEqual(parsed["count"], 1)
        self.assertEqual(parsed["wardrobes"][0]["name"], "Summer")

    def test_execute_tool_clothing_items_forwards_wardrobe_id(self) -> None:
        wardrobe = self._seed_wardrobe()

        result = execute_tool(
            "get_clothing_items",
            {"wardrobe_id": wardrobe.id},
            db=self.session,
            user_id="user-1",
        )

        parsed = json.loads(result)
        self.assertEqual(parsed["count"], 1)
        self.assertEqual(parsed["items"][0]["name"], "White tee")

    def test_get_weather_returns_conditions_for_coords(self) -> None:
        fake = AsyncMock(
            return_value={
                "temperature": 21.5,
                "description": "Light Rain",
                "icon_url": "https://example.test/icon.png",
                "city": "Manila",
            }
        )
        with patch("app.services.agent.tools.get_current_weather", new=fake):
            result = execute_tool(
                "get_weather",
                {},
                db=self.session,
                user_id="user-1",
                latitude=14.6,
                longitude=121.0,
            )

        fake.assert_awaited_once_with(14.6, 121.0)
        parsed = json.loads(result)
        self.assertEqual(parsed["temperature_c"], 21.5)
        self.assertEqual(parsed["description"], "Light Rain")
        self.assertEqual(parsed["city"], "Manila")

    def test_get_weather_without_coords_returns_error(self) -> None:
        result = execute_tool(
            "get_weather", {}, db=self.session, user_id="user-1"
        )

        parsed = json.loads(result)
        self.assertIn("error", parsed)

    def test_get_weather_swallows_service_errors(self) -> None:
        fake = AsyncMock(
            side_effect=HTTPException(status_code=503, detail="down")
        )
        with patch("app.services.agent.tools.get_current_weather", new=fake):
            result = execute_tool(
                "get_weather",
                {},
                db=self.session,
                user_id="user-1",
                latitude=14.6,
                longitude=121.0,
            )

        # Never raises; the failure is a readable error payload for the model.
        parsed = json.loads(result)
        self.assertIn("error", parsed)


if __name__ == "__main__":
    unittest.main()
