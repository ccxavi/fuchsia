import httpx
from datetime import datetime, timedelta
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
