import httpx
from datetime import datetime, timedelta
from fastapi import HTTPException
from app.core.config import settings

WEATHER_CACHE = {}
CACHE_TTL = timedelta(minutes=15)

async def get_current_weather(lat: float, lon: float) -> dict:
    if not settings.openweathermap_api_key:
        raise HTTPException(status_code=500, detail="OpenWeatherMap API key is not configured")

    # Round coordinates to 2 decimal places to cluster requests (~1.1km accuracy)
    cache_key = f"{round(lat, 2)},{round(lon, 2)}"
    now = datetime.now()
    
    if cache_key in WEATHER_CACHE:
        cached_data, timestamp = WEATHER_CACHE[cache_key]
        if now - timestamp < CACHE_TTL:
            return cached_data

    url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={settings.openweathermap_api_key}&units=metric"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Weather service unavailable: {str(e)}")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail="Failed to fetch weather data")
            
        data = response.json()
        
        # Check if the expected fields are in the response
        if "main" not in data or "weather" not in data or not data["weather"]:
            raise HTTPException(status_code=500, detail="Unexpected response format from weather service")
        
        result = {
            "temperature": data["main"]["temp"],
            "description": data["weather"][0]["description"].title(),
            "icon_url": f"https://openweathermap.org/img/wn/{data['weather'][0]['icon']}@2x.png",
            "city": data.get("name", "Unknown Location")
        }
        
        WEATHER_CACHE[cache_key] = (result, now)
        return result
