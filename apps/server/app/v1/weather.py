from typing import Annotated
from fastapi import APIRouter, Depends, Query

from app.core.auth import AuthenticatedUser, get_current_authenticated_user
from app.services.weather import get_current_weather
from app.v1.schemas import WeatherResponse

router = APIRouter()

@router.get("/", response_model=WeatherResponse)
async def get_weather(
    lat: Annotated[float, Query(description="Latitude of the location")],
    lon: Annotated[float, Query(description="Longitude of the location")],
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)]
):
    """
    Get the current weather for the given latitude and longitude.
    """
    result = await get_current_weather(lat, lon)
    return result
