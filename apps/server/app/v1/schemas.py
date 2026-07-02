from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_CONTENT_LENGTH = 32768
MAX_CONTENT_PARTS = 32
MAX_IMAGE_URL_LENGTH = 2_000_000


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


class ChatResponse(BaseModel):
    message: ChatMessage
    model: str
    usage: dict[str, Any] | None = None
