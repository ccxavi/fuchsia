from __future__ import annotations

from app.core.config import settings
from app.services.agent.openai_compat import Provider


def deepseek_provider() -> Provider:
    """DeepSeek (text) provider config. Content is flattened to plain strings."""
    return Provider(
        name="DeepSeek",
        base_url=settings.require_deepseek_base_url(),
        api_key=settings.require_deepseek_api_key(),
        model=settings.deepseek_model,
        flatten_content=True,
    )


def gemini_provider() -> Provider:
    """Gemini (vision) provider config. Multimodal content parts are preserved."""
    return Provider(
        name="Gemini",
        base_url=settings.require_gemini_base_url(),
        api_key=settings.require_gemini_api_key(),
        model=settings.gemini_model,
        flatten_content=False,
    )
