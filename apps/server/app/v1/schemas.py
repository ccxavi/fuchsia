import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_CONTENT_LENGTH = 32768
MAX_CONTENT_PARTS = 32
MAX_IMAGE_URL_LENGTH = 2_000_000


class AuthenticatedUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    supabase_user_id: str
    email: str | None
    display_name: str | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class AuthMeResponse(BaseModel):
    user: AuthenticatedUserResponse


class UserPreferencesUpdateRequest(BaseModel):
    display_name: str | None = None

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("display_name must not be empty")
        if len(cleaned) > 120:
            raise ValueError("display_name must be at most 120 characters")
        return cleaned


class AuthPasswordRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=8, max_length=1024)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        cleaned_value = value.strip().lower()
        if not cleaned_value:
            raise ValueError("email must not be empty")
        return cleaned_value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("password must not be empty")
        return value


class AuthRefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1, max_length=4096)

    @field_validator("refresh_token")
    @classmethod
    def validate_refresh_token(cls, value: str) -> str:
        cleaned_value = value.strip()
        if not cleaned_value:
            raise ValueError("refresh_token must not be empty")
        return cleaned_value


class SupabaseAuthUserResponse(BaseModel):
    id: str
    email: str | None
    role: str | None
    aud: str | None
    created_at: datetime.datetime | None


class AuthSessionResponse(BaseModel):
    access_token: str | None
    refresh_token: str | None
    token_type: str | None
    expires_in: int | None
    user: SupabaseAuthUserResponse | None


class TextPart(BaseModel):
    type: Literal["text"]
    text: str = Field(..., min_length=1, max_length=MAX_CONTENT_LENGTH)

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text must not be empty")
        return value


class ImageUrl(BaseModel):
    url: str = Field(..., min_length=1, max_length=MAX_IMAGE_URL_LENGTH)


class ImagePart(BaseModel):
    type: Literal["image_url"]
    image_url: ImageUrl


ContentPart = Annotated[TextPart | ImagePart, Field(discriminator="type")]


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str | list[ContentPart] = Field(
        ..., min_length=1, max_length=MAX_CONTENT_LENGTH
    )

    @field_validator("content")
    @classmethod
    def validate_content(
        cls, value: str | list[ContentPart]
    ) -> str | list[ContentPart]:
        if isinstance(value, str):
            if not value.strip():
                raise ValueError("content must not be empty")
            return value

        if not value:
            raise ValueError("content must not be empty")
        if len(value) > MAX_CONTENT_PARTS:
            raise ValueError(
                f"content must not exceed {MAX_CONTENT_PARTS} parts"
            )
        return value


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=128)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1024, ge=16, le=8192)
    latitude: float | None = Field(default=None, ge=-90.0, le=90.0)
    longitude: float | None = Field(default=None, ge=-180.0, le=180.0)

    @model_validator(mode="after")
    def validate_coordinates(self) -> "ChatRequest":
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError(
                "latitude and longitude must be provided together"
            )
        return self


class MemorySuggestion(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)
    category: str | None = Field(default=None, max_length=50)

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("content must not be empty")
        return cleaned

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class MemoryIngestRequest(BaseModel):
    memories: list[MemorySuggestion] = Field(..., min_length=1, max_length=50)


class MemoryUpdateRequest(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=500)
    category: str | None = Field(default=None, max_length=50)

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("content must not be empty")
        return cleaned

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class MemoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    content: str
    category: str | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class OutfitSuggestion(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    clothing_item_ids: list[str] = Field(..., min_length=1)
    wardrobe_ids: list[str] = []
    rationale: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("name must not be empty")
        return cleaned

    @field_validator("rationale")
    @classmethod
    def validate_rationale(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class CalendarSuggestion(BaseModel):
    outfit_id: str = Field(..., min_length=1)
    date: datetime.date
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class ChatResponse(BaseModel):
    message: ChatMessage
    model: str
    usage: dict[str, Any] | None = None
    memory_suggestions: list[MemorySuggestion] = []
    memories_used: list[MemoryResponse] = []
    outfit_suggestions: list[OutfitSuggestion] = []
    calendar_suggestions: list[CalendarSuggestion] = []

class ClothingItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    category: str | None
    color: str | None
    brand: str | None
    image_url: str | None
    is_favorite: bool
    wardrobes_count: int
    outfits_count: int
    created_at: datetime.datetime
    updated_at: datetime.datetime


class WardrobeCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class WardrobeUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)


class WardrobeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    clothing_items_count: int
    outfits_count: int
    image_url: str | None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class OutfitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    is_ai_generated: bool
    clothing_items_count: int
    wardrobes_count: int
    times_worn: int = 0
    last_worn: datetime.date | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class OutfitImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    outfit_id: str
    image_url: str
    date: datetime.date | None
    created_at: datetime.datetime


class OutfitWithItemsResponse(OutfitResponse):
    clothing_items: list[ClothingItemResponse] = []
    images: list[OutfitImageResponse] = []


class RecentLookResponse(OutfitImageResponse):
    outfit: OutfitResponse


class OutfitWithWardrobesResponse(OutfitWithItemsResponse):
    wardrobes: list[WardrobeResponse] = []


class WardrobeWithDetailsResponse(WardrobeResponse):
    clothing_items: list[ClothingItemResponse] = []
    outfits: list[OutfitWithItemsResponse] = []


class ClothingItemWithDetailsResponse(ClothingItemResponse):
    wardrobes: list[WardrobeResponse] = []
    outfits: list[OutfitWithItemsResponse] = []


class CalendarOutfitCreateRequest(BaseModel):
    outfit_id: str
    date: datetime.date
    notes: str | None = None


class CalendarOutfitUpdateRequest(BaseModel):
    date: datetime.date | None = None
    notes: str | None = None


class CalendarOutfitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    outfit_id: str
    date: datetime.date
    notes: str | None
    created_at: datetime.datetime
    updated_at: datetime.datetime


class CalendarOutfitWithOutfitResponse(CalendarOutfitResponse):
    outfit: OutfitWithItemsResponse
    day_images: list[OutfitImageResponse] = []


class WeatherResponse(BaseModel):
    temperature: float
    description: str
    icon_url: str
    city: str
