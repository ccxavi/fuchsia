from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "fuchsia-api"
    env: str = "dev"
    log_level: str = "INFO"
    database_url: str | None = None
    supabase_url: str | None = None
    supabase_publishable_key: str | None = None
    supabase_anon_key: str | None = None
    supabase_issuer: str | None = None
    supabase_jwks_url: str | None = None
    supabase_audience: str | None = None
    deepseek_api_key: str | None = None
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    gemini_api_key: str | None = None
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    gemini_model: str = "gemini-2.5-flash"
    gemini_embedding_model: str = "gemini-embedding-001"
    # Memory recall (RAG) tuning. gemini-embedding-001 has a high similarity
    # floor for short text, so the max cosine distance is kept tight to avoid
    # injecting loosely-related memories (e.g. on a bare greeting). Calibrated:
    # real matches land ~0.23-0.30, unrelated/greeting noise ~0.42+.
    memory_recall_top_k: int = 6
    memory_recall_max_distance: float = 0.38
    openweathermap_api_key: str | None = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def require_database_url(self) -> str:
        if not self.database_url:
            raise ValueError("DATABASE_URL is not configured.")

        return self.database_url

    def require_supabase_issuer(self) -> str:
        if self.supabase_issuer:
            return self.supabase_issuer.rstrip("/")

        if not self.supabase_url:
            raise ValueError(
                "SUPABASE_ISSUER is not configured and SUPABASE_URL is unavailable for derivation."
            )

        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    def require_supabase_jwks_url(self) -> str:
        if self.supabase_jwks_url:
            return self.supabase_jwks_url

        return f"{self.require_supabase_issuer()}/.well-known/jwks.json"

    def require_supabase_url(self) -> str:
        if not self.supabase_url:
            raise ValueError("SUPABASE_URL is not configured.")

        return self.supabase_url.rstrip("/")

    def require_supabase_api_key(self) -> str:
        if self.supabase_publishable_key:
            return self.supabase_publishable_key
        if self.supabase_anon_key:
            return self.supabase_anon_key

        raise ValueError(
            "Neither SUPABASE_PUBLISHABLE_KEY nor SUPABASE_ANON_KEY is configured."
        )

    def require_deepseek_api_key(self) -> str:
        if not self.deepseek_api_key:
            raise ValueError("DEEPSEEK_API_KEY is not configured.")

        return self.deepseek_api_key

    def require_deepseek_base_url(self) -> str:
        if not self.deepseek_base_url:
            raise ValueError("DEEPSEEK_BASE_URL is not configured.")

        return self.deepseek_base_url.rstrip("/")

    def require_gemini_api_key(self) -> str:
        if not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is not configured.")

        return self.gemini_api_key

    def require_gemini_base_url(self) -> str:
        if not self.gemini_base_url:
            raise ValueError("GEMINI_BASE_URL is not configured.")

        return self.gemini_base_url.rstrip("/")


settings = Settings()
