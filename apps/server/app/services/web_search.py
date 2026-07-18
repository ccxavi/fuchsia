import httpx
from fastapi import HTTPException

from app.core.config import settings

# Tavily caps max_results at 20; we ask for a small, model-digestible slice.
DEFAULT_MAX_RESULTS = 5
MAX_RESULTS_CEILING = 10
SEARCH_TIMEOUT = 10.0


async def search(query: str, *, max_results: int = DEFAULT_MAX_RESULTS) -> dict:
    """Search the live web via the Tavily Search API.

    Returns a trimmed, model-friendly shape: a list of ``{title, url, content}``
    results, plus Tavily's synthesized ``answer`` when it provides one. Mirrors
    the weather service's contract: raises HTTPException on any request, status,
    or format failure and never returns a partial result. The agent tool wrapper
    converts those failures into a readable ``{"error": ...}`` payload.
    """
    key = settings.require_tavily_api_key()
    url = f"{settings.tavily_base_url.rstrip('/')}/search"
    bounded = max(1, min(max_results, MAX_RESULTS_CEILING))
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    body = {
        "query": query,
        "max_results": bounded,
        "search_depth": "basic",
        "include_answer": True,
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                url, headers=headers, json=body, timeout=SEARCH_TIMEOUT
            )
            response.raise_for_status()
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503, detail=f"Web search service unavailable: {str(e)}"
            )
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code, detail="Failed to fetch search results"
            )

        data = response.json()

    if not isinstance(data, dict) or "results" not in data:
        raise HTTPException(
            status_code=500, detail="Unexpected response format from web search service"
        )

    results = [
        {
            "title": item.get("title"),
            "url": item.get("url"),
            "content": item.get("content"),
        }
        for item in data.get("results", [])
        if isinstance(item, dict)
    ]

    payload: dict = {"query": query, "results": results}
    answer = data.get("answer")
    if answer:
        payload["answer"] = answer
    return payload
