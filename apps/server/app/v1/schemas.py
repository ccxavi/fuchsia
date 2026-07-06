from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AuthenticatedUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    supabase_user_id: str
    email: str | None
    display_name: str | None = None
    created_at: datetime
    updated_at: datetime


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
    created_at: datetime | None


class AuthSessionResponse(BaseModel):
    access_token: str | None
    refresh_token: str | None
    token_type: str | None
    expires_in: int | None
    user: SupabaseAuthUserResponse | None


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
    created_at: datetime
    updated_at: datetime


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
    created_at: datetime
    updated_at: datetime


class OutfitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    is_ai_generated: bool
    image_url: str | None
    clothing_items_count: int
    wardrobes_count: int
    created_at: datetime
    updated_at: datetime


class OutfitWithItemsResponse(OutfitResponse):
    clothing_items: list[ClothingItemResponse] = []


class OutfitWithWardrobesResponse(OutfitWithItemsResponse):
    wardrobes: list[WardrobeResponse] = []


class WardrobeWithDetailsResponse(WardrobeResponse):
    clothing_items: list[ClothingItemResponse] = []
    outfits: list[OutfitResponse] = []


class ClothingItemWithWardrobesResponse(ClothingItemResponse):
    wardrobes: list[WardrobeResponse] = []
