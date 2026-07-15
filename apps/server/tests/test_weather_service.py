from __future__ import annotations

import asyncio
import datetime
import unittest
from typing import Any
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import HTTPException

from app.services import weather
from app.services.weather import (
    WEATHER_CACHE,
    forecast_window,
    get_current_weather,
    get_daily_forecast,
)


def _response(payload: dict[str, Any], *, status_code: int = 200) -> httpx.Response:
    """Build a real httpx.Response so raise_for_status behaves as in production."""
    return httpx.Response(
        status_code=status_code,
        json=payload,
        request=httpx.Request("GET", "https://api.open-meteo.com/v1/forecast"),
    )


def _current_payload(*, temperature: float = 21.5, weather_code: int = 61) -> dict[str, Any]:
    return {"current": {"temperature_2m": temperature, "weather_code": weather_code}}


def _daily_payload(
    *,
    temp_max: float | None = 31.0,
    temp_min: float | None = 24.0,
    weather_code: int | None = 61,
    day: str = "2026-07-18",
) -> dict[str, Any]:
    return {
        "daily": {
            "time": [day],
            "temperature_2m_max": [temp_max],
            "temperature_2m_min": [temp_min],
            "weather_code": [weather_code],
        }
    }


class WeatherServiceTestCase(unittest.TestCase):
    """Covers the Open-Meteo client directly; the agent tests all mock it out."""

    def setUp(self) -> None:
        # Module-level cache: leaking entries across tests would mask real calls.
        WEATHER_CACHE.clear()
        self.addCleanup(WEATHER_CACHE.clear)

    def _patch_get(self, *responses: Any) -> AsyncMock:
        """Patch httpx.AsyncClient.get to return/raise the given responses in order."""
        fake = AsyncMock(side_effect=responses)
        patcher = patch.object(httpx.AsyncClient, "get", new=fake)
        patcher.start()
        self.addCleanup(patcher.stop)
        return fake

    # --- get_current_weather -------------------------------------------------

    def test_current_weather_maps_wmo_code_to_description_and_icon(self) -> None:
        self._patch_get(_response(_current_payload(temperature=21.5, weather_code=61)))

        result = asyncio.run(get_current_weather(14.6, 121.0))

        self.assertEqual(result["temperature"], 21.5)
        self.assertEqual(result["description"], "Slight Rain")
        self.assertEqual(result["icon_url"], "https://openweathermap.org/img/wn/10d@2x.png")

    def test_current_weather_unknown_code_falls_back_to_unknown(self) -> None:
        self._patch_get(_response(_current_payload(weather_code=1234)))

        result = asyncio.run(get_current_weather(14.6, 121.0))

        self.assertEqual(result["description"], "Unknown")
        self.assertEqual(result["icon_url"], "https://openweathermap.org/img/wn/01d@2x.png")

    def test_current_weather_caches_by_rounded_coordinates(self) -> None:
        fake = self._patch_get(_response(_current_payload()))

        first = asyncio.run(get_current_weather(14.601, 121.004))
        # ~30m away: rounds into the same 2dp bucket, so it must not re-request.
        second = asyncio.run(get_current_weather(14.604, 121.001))

        fake.assert_awaited_once()
        self.assertEqual(first, second)

    def test_current_weather_distinct_coordinates_are_fetched_separately(self) -> None:
        fake = self._patch_get(
            _response(_current_payload(temperature=21.5)),
            _response(_current_payload(temperature=8.0)),
        )

        manila = asyncio.run(get_current_weather(14.6, 121.0))
        london = asyncio.run(get_current_weather(51.5, -0.13))

        self.assertEqual(fake.await_count, 2)
        self.assertEqual(manila["temperature"], 21.5)
        self.assertEqual(london["temperature"], 8.0)

    def test_current_weather_request_error_becomes_503(self) -> None:
        self._patch_get(httpx.ConnectError("no route to host"))

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(get_current_weather(14.6, 121.0))

        self.assertEqual(ctx.exception.status_code, 503)

    def test_current_weather_upstream_status_propagates(self) -> None:
        self._patch_get(_response({"error": True}, status_code=429))

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(get_current_weather(14.6, 121.0))

        self.assertEqual(ctx.exception.status_code, 429)

    def test_current_weather_malformed_body_becomes_500(self) -> None:
        self._patch_get(_response({"current": {"humidity": 80}}))

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(get_current_weather(14.6, 121.0))

        self.assertEqual(ctx.exception.status_code, 500)

    def test_current_weather_failure_is_not_cached(self) -> None:
        fake = self._patch_get(
            httpx.ConnectError("down"),
            _response(_current_payload(temperature=21.5)),
        )

        with self.assertRaises(HTTPException):
            asyncio.run(get_current_weather(14.6, 121.0))
        recovered = asyncio.run(get_current_weather(14.6, 121.0))

        self.assertEqual(fake.await_count, 2)
        self.assertEqual(recovered["temperature"], 21.5)

    # --- forecast_window -----------------------------------------------------

    def test_forecast_window_spans_yesterday_to_two_weeks_out(self) -> None:
        earliest, latest = forecast_window(datetime.date(2026, 7, 15))

        self.assertEqual(earliest, datetime.date(2026, 7, 14))
        self.assertEqual(latest, datetime.date(2026, 7, 29))

    # --- get_daily_forecast --------------------------------------------------

    def test_daily_forecast_requests_daily_variables_and_local_timezone(self) -> None:
        fake = self._patch_get(_response(_daily_payload()))

        asyncio.run(get_daily_forecast(14.6, 121.0, datetime.date(2026, 7, 18)))

        url = fake.await_args.args[0]
        self.assertIn("daily=temperature_2m_max,temperature_2m_min,weather_code", url)
        self.assertIn("start_date=2026-07-18", url)
        self.assertIn("end_date=2026-07-18", url)
        # Without timezone=auto a "date" would be a UTC day, not the user's day.
        self.assertIn("timezone=auto", url)

    def test_daily_forecast_returns_min_max_and_description(self) -> None:
        self._patch_get(
            _response(_daily_payload(temp_max=31.0, temp_min=24.0, weather_code=61))
        )

        result = asyncio.run(get_daily_forecast(14.6, 121.0, datetime.date(2026, 7, 18)))

        self.assertEqual(result["date"], "2026-07-18")
        self.assertEqual(result["temperature_max"], 31.0)
        self.assertEqual(result["temperature_min"], 24.0)
        self.assertEqual(result["description"], "Slight Rain")
        self.assertEqual(result["icon_url"], "https://openweathermap.org/img/wn/10d@2x.png")

    def test_daily_forecast_null_values_raise_404(self) -> None:
        # Open-Meteo answers 200-with-nulls at the edge of its rolling buffer.
        # Reporting that as 0C under an "Unknown" sky would be a fabricated forecast.
        self._patch_get(
            _response(_daily_payload(temp_max=None, temp_min=None, weather_code=None))
        )

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(get_daily_forecast(14.6, 121.0, datetime.date(2026, 7, 18)))

        self.assertEqual(ctx.exception.status_code, 404)
        self.assertIn("2026-07-18", ctx.exception.detail)

    def test_daily_forecast_null_temperature_alone_raises_404(self) -> None:
        self._patch_get(_response(_daily_payload(temp_max=None, weather_code=61)))

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(get_daily_forecast(14.6, 121.0, datetime.date(2026, 7, 18)))

        self.assertEqual(ctx.exception.status_code, 404)

    def test_daily_forecast_unknown_code_falls_back_to_unknown(self) -> None:
        self._patch_get(_response(_daily_payload(weather_code=1234)))

        result = asyncio.run(get_daily_forecast(14.6, 121.0, datetime.date(2026, 7, 18)))

        self.assertEqual(result["description"], "Unknown")

    def test_daily_forecast_cache_key_includes_date(self) -> None:
        fake = self._patch_get(
            _response(_daily_payload(temp_max=31.0, day="2026-07-18")),
            _response(_daily_payload(temp_max=27.0, day="2026-07-19")),
        )

        first = asyncio.run(get_daily_forecast(14.6, 121.0, datetime.date(2026, 7, 18)))
        second = asyncio.run(get_daily_forecast(14.6, 121.0, datetime.date(2026, 7, 19)))

        self.assertEqual(fake.await_count, 2)
        self.assertEqual(first["temperature_max"], 31.0)
        self.assertEqual(second["temperature_max"], 27.0)

    def test_daily_forecast_repeats_are_served_from_cache(self) -> None:
        fake = self._patch_get(_response(_daily_payload()))

        first = asyncio.run(get_daily_forecast(14.6, 121.0, datetime.date(2026, 7, 18)))
        second = asyncio.run(get_daily_forecast(14.6, 121.0, datetime.date(2026, 7, 18)))

        fake.assert_awaited_once()
        self.assertEqual(first, second)

    def test_daily_forecast_cache_does_not_collide_with_current_weather(self) -> None:
        fake = self._patch_get(
            _response(_current_payload(temperature=21.5)),
            _response(_daily_payload(temp_max=31.0, temp_min=24.0)),
        )

        current = asyncio.run(get_current_weather(14.6, 121.0))
        forecast = asyncio.run(get_daily_forecast(14.6, 121.0, datetime.date(2026, 7, 18)))

        # Same coordinates, different questions: neither may serve the other.
        self.assertEqual(fake.await_count, 2)
        self.assertEqual(current["temperature"], 21.5)
        self.assertEqual(forecast["temperature_max"], 31.0)

    def test_daily_forecast_request_error_becomes_503(self) -> None:
        self._patch_get(httpx.ConnectError("no route to host"))

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(get_daily_forecast(14.6, 121.0, datetime.date(2026, 7, 18)))

        self.assertEqual(ctx.exception.status_code, 503)

    def test_daily_forecast_out_of_range_status_propagates(self) -> None:
        # What Open-Meteo really answers for a date outside its window.
        self._patch_get(
            _response(
                {"error": True, "reason": "Parameter 'start_date' is out of allowed range"},
                status_code=400,
            )
        )

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(get_daily_forecast(14.6, 121.0, datetime.date(2030, 1, 1)))

        self.assertEqual(ctx.exception.status_code, 400)

    def test_daily_forecast_malformed_body_becomes_500(self) -> None:
        self._patch_get(_response({"daily": {"time": ["2026-07-18"]}}))

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(get_daily_forecast(14.6, 121.0, datetime.date(2026, 7, 18)))

        self.assertEqual(ctx.exception.status_code, 500)

    def test_daily_forecast_missing_daily_block_becomes_500(self) -> None:
        self._patch_get(_response({"latitude": 14.6, "longitude": 121.0}))

        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(get_daily_forecast(14.6, 121.0, datetime.date(2026, 7, 18)))

        self.assertEqual(ctx.exception.status_code, 500)

    def test_daily_forecast_expired_entry_is_refetched(self) -> None:
        fake = self._patch_get(
            _response(_daily_payload(temp_max=31.0)),
            _response(_daily_payload(temp_max=27.0)),
        )
        target = datetime.date(2026, 7, 18)

        asyncio.run(get_daily_forecast(14.6, 121.0, target))
        # Age the entry past the TTL rather than sleeping through it.
        cached, timestamp = WEATHER_CACHE[f"14.6,121.0@{target.isoformat()}"]
        WEATHER_CACHE[f"14.6,121.0@{target.isoformat()}"] = (
            cached,
            timestamp - weather.CACHE_TTL - datetime.timedelta(seconds=1),
        )
        refreshed = asyncio.run(get_daily_forecast(14.6, 121.0, target))

        self.assertEqual(fake.await_count, 2)
        self.assertEqual(refreshed["temperature_max"], 27.0)


if __name__ == "__main__":
    unittest.main()
