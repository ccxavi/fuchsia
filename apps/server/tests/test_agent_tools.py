from __future__ import annotations

import json
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

import datetime

from app.db.base import Base
from app.models.calendar_outfit import CalendarOutfit
from app.models.clothing_item import ClothingItem
from app.models.outfit import Outfit
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

    def _tool_description(self, name: str) -> str:
        tool = next(t for t in STYLIST_TOOLS if t["function"]["name"] == name)
        return tool["function"]["description"]

    def test_suggest_outfits_has_no_opt_out_clause(self) -> None:
        # "if you cannot build one from their wardrobe, do not call it" is
        # vacuously true before get_clothing_items has run, and the model took
        # the out: 0/5 suggestions against the live API. See test_agent_prompt.
        description = self._tool_description("suggest_outfits")

        self.assertNotIn("do not call it", description)
        self.assertIn("only way the outfit reaches them", description)

    def test_suggest_outfits_triggers_on_the_users_ask(self) -> None:
        # Trigger on what the user does, not on the model's internal state:
        # "once you have decided" is a state it can satisfy by writing prose.
        description = self._tool_description("suggest_outfits")

        self.assertIn("build, create, or put one", description)
        self.assertNotIn("once you have decided", description)

    def test_suggest_outfits_keeps_its_id_fidelity_rules(self) -> None:
        # These are load-bearing and measured working (5/5 ids survived the
        # ownership filter); removing them would resurface as silent drops.
        description = self._tool_description("suggest_outfits")

        self.assertIn("Only use clothing items returned by get_clothing_items", description)
        self.assertIn("Never invent pieces", description)

    def test_suggest_calendar_entry_has_no_self_referential_trigger(self) -> None:
        description = self._tool_description("suggest_calendar_entry")

        self.assertNotIn("once you have decided", description)
        self.assertIn("only way the proposal reaches them", description)

    def test_suggest_memories_keeps_its_opt_out(self) -> None:
        # Already fires 4/4. Its opt-out is correct, unlike the other two.
        description = self._tool_description("suggest_memories")

        self.assertIn("if there is nothing new worth remembering, do not call it", description)

    def test_advertised_tools_cover_the_stylist_capabilities(self) -> None:
        names = {tool["function"]["name"] for tool in STYLIST_TOOLS}

        self.assertEqual(
            names,
            {
                "get_clothing_items",
                "get_wardrobes",
                "get_outfits",
                "get_calendar",
                "suggest_memories",
                "suggest_outfits",
                "suggest_calendar_entry",
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

    def _seed_outfit(self, *, user_id: str = "user-1", name: str = "Casual Friday") -> Outfit:
        outfit = Outfit(user_id=user_id, name=name)
        self.session.add(outfit)
        self.session.commit()
        self.session.refresh(outfit)
        return outfit

    def test_execute_tool_get_outfits_returns_users_outfits(self) -> None:
        self._seed_outfit()
        self._seed_outfit(user_id="user-2", name="Not yours")

        result = execute_tool("get_outfits", {}, db=self.session, user_id="user-1")

        parsed = json.loads(result)
        self.assertEqual(parsed["count"], 1)
        self.assertEqual(parsed["outfits"][0]["name"], "Casual Friday")

    def test_execute_tool_get_calendar_returns_scheduled_outfits(self) -> None:
        outfit = self._seed_outfit()
        self.session.add(
            CalendarOutfit(
                user_id="user-1",
                outfit_id=outfit.id,
                date=datetime.date(2026, 7, 11),
                notes="Brunch",
            )
        )
        self.session.commit()

        result = execute_tool("get_calendar", {}, db=self.session, user_id="user-1")

        parsed = json.loads(result)
        self.assertEqual(parsed["count"], 1)
        entry = parsed["entries"][0]
        self.assertEqual(entry["date"], "2026-07-11")
        self.assertEqual(entry["outfit_id"], outfit.id)
        self.assertEqual(entry["outfit_name"], "Casual Friday")
        self.assertEqual(entry["notes"], "Brunch")

    def test_execute_tool_get_calendar_month_filter(self) -> None:
        outfit = self._seed_outfit()
        self.session.add_all(
            [
                CalendarOutfit(
                    user_id="user-1", outfit_id=outfit.id, date=datetime.date(2026, 7, 11)
                ),
                CalendarOutfit(
                    user_id="user-1", outfit_id=outfit.id, date=datetime.date(2026, 8, 3)
                ),
            ]
        )
        self.session.commit()

        result = execute_tool(
            "get_calendar", {"year": 2026, "month": 7}, db=self.session, user_id="user-1"
        )

        parsed = json.loads(result)
        self.assertEqual(parsed["count"], 1)
        self.assertEqual(parsed["entries"][0]["date"], "2026-07-11")

    def test_get_weather_returns_conditions_for_coords(self) -> None:
        fake = AsyncMock(
            return_value={
                "temperature": 21.5,
                "description": "Light Rain",
                "icon_url": "https://example.test/icon.png",
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

    # --- get_weather with a date ---------------------------------------------

    def _forecast_mock(self) -> AsyncMock:
        return AsyncMock(
            return_value={
                "date": "2026-07-17",
                "temperature_min": 24.0,
                "temperature_max": 31.0,
                "description": "Slight Rain",
                "icon_url": "https://example.test/icon.png",
            }
        )

    def _run_get_weather(
        self,
        arguments: dict,
        *,
        forecast: AsyncMock | None = None,
        current: AsyncMock | None = None,
        today: datetime.date | None = datetime.date(2026, 7, 15),
    ) -> dict:
        """Dispatch get_weather with both service functions patched out."""
        forecast = forecast or self._forecast_mock()
        current = current or AsyncMock(
            return_value={"temperature": 21.5, "description": "Clear Sky"}
        )
        with (
            patch("app.services.agent.tools.get_daily_forecast", new=forecast),
            patch("app.services.agent.tools.get_current_weather", new=current),
        ):
            result = execute_tool(
                "get_weather",
                arguments,
                db=self.session,
                user_id="user-1",
                latitude=14.6,
                longitude=121.0,
                today=today,
            )
        self.forecast_mock = forecast
        self.current_mock = current
        return json.loads(result)

    def test_get_weather_schema_exposes_optional_date(self) -> None:
        tool = next(
            t for t in STYLIST_TOOLS if t["function"]["name"] == "get_weather"
        )
        parameters = tool["function"]["parameters"]

        self.assertIn("date", parameters["properties"])
        # Absent "required" is what keeps the no-argument call legal.
        self.assertNotIn("required", parameters)

    def test_get_weather_with_date_returns_daily_summary(self) -> None:
        parsed = self._run_get_weather({"date": "2026-07-17"})

        self.forecast_mock.assert_awaited_once_with(14.6, 121.0, datetime.date(2026, 7, 17))
        self.assertEqual(parsed["date"], "2026-07-17")
        self.assertEqual(parsed["temperature_min_c"], 24.0)
        self.assertEqual(parsed["temperature_max_c"], 31.0)
        self.assertEqual(parsed["description"], "Slight Rain")

    def test_get_weather_with_date_does_not_call_current_conditions(self) -> None:
        self._run_get_weather({"date": "2026-07-17"})

        self.current_mock.assert_not_awaited()

    def test_get_weather_for_today_returns_the_daily_summary(self) -> None:
        # Asking for a day gets a day; "right now" is expressed by omitting date.
        self._run_get_weather({"date": "2026-07-15"})

        self.forecast_mock.assert_awaited_once_with(14.6, 121.0, datetime.date(2026, 7, 15))
        self.current_mock.assert_not_awaited()

    def test_get_weather_rejects_unparseable_date(self) -> None:
        parsed = self._run_get_weather({"date": "Friday"})

        self.assertIn("error", parsed)
        self.forecast_mock.assert_not_awaited()

    def test_get_weather_rejects_non_string_date(self) -> None:
        parsed = self._run_get_weather({"date": 20260717})

        self.assertIn("error", parsed)
        self.forecast_mock.assert_not_awaited()

    def test_get_weather_rejects_date_beyond_horizon(self) -> None:
        parsed = self._run_get_weather({"date": "2026-12-25"})

        # Answerable without asking upstream, and the model needs the bounds.
        self.forecast_mock.assert_not_awaited()
        self.assertIn("2026-07-14", parsed["error"])
        self.assertIn("2026-07-29", parsed["error"])

    def test_get_weather_rejects_past_date(self) -> None:
        parsed = self._run_get_weather({"date": "2026-01-01"})

        self.assertIn("error", parsed)
        self.forecast_mock.assert_not_awaited()

    def test_get_weather_accepts_yesterday_for_timezone_skew(self) -> None:
        # The server's "today" can run ahead of a user further west.
        self._run_get_weather({"date": "2026-07-14"})

        self.forecast_mock.assert_awaited_once_with(14.6, 121.0, datetime.date(2026, 7, 14))

    def test_get_weather_accepts_the_far_edge_of_the_window(self) -> None:
        self._run_get_weather({"date": "2026-07-29"})

        self.forecast_mock.assert_awaited_once_with(14.6, 121.0, datetime.date(2026, 7, 29))

    def test_get_weather_swallows_forecast_service_errors(self) -> None:
        failing = AsyncMock(side_effect=HTTPException(status_code=503, detail="down"))

        parsed = self._run_get_weather({"date": "2026-07-17"}, forecast=failing)

        self.assertIn("error", parsed)
        self.assertIn("2026-07-17", parsed["error"])

    def test_get_weather_with_date_but_no_coords_returns_error(self) -> None:
        forecast = self._forecast_mock()
        with patch("app.services.agent.tools.get_daily_forecast", new=forecast):
            result = execute_tool(
                "get_weather",
                {"date": "2026-07-17"},
                db=self.session,
                user_id="user-1",
            )

        self.assertIn("error", json.loads(result))
        forecast.assert_not_awaited()

    def test_get_weather_falls_back_to_server_today_without_today_kwarg(self) -> None:
        # execute_tool's today defaults to None; the range still has to resolve.
        target = datetime.date.today() + datetime.timedelta(days=2)

        self._run_get_weather({"date": target.isoformat()}, today=None)

        self.forecast_mock.assert_awaited_once_with(14.6, 121.0, target)


if __name__ == "__main__":
    unittest.main()
