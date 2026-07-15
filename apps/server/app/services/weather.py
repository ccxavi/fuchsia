import httpx
from datetime import date, datetime, timedelta
from fastapi import HTTPException

from app.core.config import settings

WEATHER_CACHE = {}
CACHE_TTL = timedelta(minutes=15)

# Map WMO codes to human-readable descriptions and equivalent OpenWeatherMap icon IDs
WMO_CODE_MAP = {
    0: ("Clear Sky", "01d"),
    1: ("Mainly Clear", "02d"),
    2: ("Partly Cloudy", "03d"),
    3: ("Overcast", "04d"),
    45: ("Fog", "50d"),
    48: ("Depositing Rime Fog", "50d"),
    51: ("Light Drizzle", "09d"),
    53: ("Moderate Drizzle", "09d"),
    55: ("Dense Drizzle", "09d"),
    56: ("Light Freezing Drizzle", "09d"),
    57: ("Dense Freezing Drizzle", "09d"),
    61: ("Slight Rain", "10d"),
    63: ("Moderate Rain", "10d"),
    65: ("Heavy Rain", "10d"),
    66: ("Light Freezing Rain", "10d"),
    67: ("Heavy Freezing Rain", "10d"),
    71: ("Slight Snow Fall", "13d"),
    73: ("Moderate Snow Fall", "13d"),
    75: ("Heavy Snow Fall", "13d"),
    77: ("Snow Grains", "13d"),
    80: ("Slight Rain Showers", "09d"),
    81: ("Moderate Rain Showers", "09d"),
    82: ("Violent Rain Showers", "09d"),
    85: ("Slight Snow Showers", "13d"),
    86: ("Heavy Snow Showers", "13d"),
    95: ("Thunderstorm", "11d"),
    96: ("Thunderstorm with Slight Hail", "11d"),
    99: ("Thunderstorm with Heavy Hail", "11d"),
}

# The slice of Open-Meteo's forecast window we accept, as offsets from today.
# Open-Meteo itself serves today-93..today+15. We stay a day inside the ceiling
# because it computes those bounds off UTC while this server runs Asia/Manila,
# and we allow yesterday because a user west of us can still be on that date.
# Older dates are refused on purpose: the caller wants weather to dress for, so
# a date in the past means something upstream is wrong and should say so loudly
# rather than return plausible history.
FORECAST_MIN_OFFSET = -1
FORECAST_MAX_OFFSET = 14


def forecast_window(today: date) -> tuple[date, date]:
    """Return the (earliest, latest) dates get_daily_forecast will accept."""
    return (
        today + timedelta(days=FORECAST_MIN_OFFSET),
        today + timedelta(days=FORECAST_MAX_OFFSET),
    )


async def get_current_weather(lat: float, lon: float) -> dict:
    # Round coordinates to 2 decimal places to cluster requests (~1.1km accuracy)
    cache_key = f"{round(lat, 2)},{round(lon, 2)}"
    now = datetime.now()
    
    if cache_key in WEATHER_CACHE:
        cached_data, timestamp = WEATHER_CACHE[cache_key]
        if now - timestamp < CACHE_TTL:
            return cached_data

    # Open-Meteo API endpoint
    url = f"{settings.weather_api_url}?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Weather service unavailable: {str(e)}")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail="Failed to fetch weather data")
            
        data = response.json()
        
        if "current" not in data or "temperature_2m" not in data["current"]:
            raise HTTPException(status_code=500, detail="Unexpected response format from weather service")
        
        weather_code = data["current"].get("weather_code", 0)
        description, icon_id = WMO_CODE_MAP.get(weather_code, ("Unknown", "01d"))
        
        result = {
            "temperature": data["current"]["temperature_2m"],
            "description": description,
            "icon_url": f"https://openweathermap.org/img/wn/{icon_id}@2x.png",
        }

        WEATHER_CACHE[cache_key] = (result, now)
        return result


async def get_daily_forecast(lat: float, lon: float, target: date) -> dict:
    """Return the forecast summary for a single day at the given coordinates.

    ``target`` is read in the coordinates' own timezone (``timezone=auto``),
    which is what a day means to the user standing there — not a UTC day. Callers
    should keep ``target`` inside :func:`forecast_window`; outside it Open-Meteo
    answers 400 and this raises. Mirrors get_current_weather's contract: raises
    HTTPException on any failure, never returns a partial result.
    """
    # Namespaced with "@" so forecast entries cannot collide with the
    # current-conditions keys above, which never contain one.
    cache_key = f"{round(lat, 2)},{round(lon, 2)}@{target.isoformat()}"
    now = datetime.now()

    if cache_key in WEATHER_CACHE:
        cached_data, timestamp = WEATHER_CACHE[cache_key]
        if now - timestamp < CACHE_TTL:
            return cached_data

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&daily=temperature_2m_max,temperature_2m_min,weather_code"
        f"&start_date={target.isoformat()}&end_date={target.isoformat()}"
        "&timezone=auto"
    )

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Weather service unavailable: {str(e)}")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail="Failed to fetch forecast data")

        data = response.json()
        daily = data.get("daily") or {}

        try:
            temp_max = daily["temperature_2m_max"][0]
            temp_min = daily["temperature_2m_min"][0]
            weather_code = daily["weather_code"][0]
        except (KeyError, IndexError, TypeError):
            raise HTTPException(status_code=500, detail="Unexpected response format from weather service")

        # A date inside the accepted window can still come back 200-with-nulls at
        # the edge of Open-Meteo's rolling buffer. Refuse it rather than report a
        # null temperature and an "Unknown" sky as if they were a real forecast.
        if temp_max is None or temp_min is None or weather_code is None:
            raise HTTPException(
                status_code=404, detail=f"No forecast available for {target.isoformat()}"
            )

        description, icon_id = WMO_CODE_MAP.get(weather_code, ("Unknown", "01d"))

        result = {
            "date": target.isoformat(),
            "temperature_min": temp_min,
            "temperature_max": temp_max,
            "description": description,
            "icon_url": f"https://openweathermap.org/img/wn/{icon_id}@2x.png",
        }

        WEATHER_CACHE[cache_key] = (result, now)
        return result
