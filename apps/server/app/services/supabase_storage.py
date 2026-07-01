import mimetypes
from typing import BinaryIO

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

def _build_storage_headers(content_type: str, access_token: str) -> dict[str, str]:
    api_key = settings.require_supabase_api_key()
    return {
        "apikey": api_key,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": content_type,
    }

async def upload_file_to_supabase(bucket_name: str, file_path: str, file: BinaryIO, content_type: str, access_token: str) -> str:
    url = f"{settings.require_supabase_url()}/storage/v1/object/{bucket_name}/{file_path}"
    
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                url, 
                headers=_build_storage_headers(content_type, access_token), 
                content=file.read()
            )
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to reach Supabase Storage.",
        ) from error

    if response.is_error:
        detail = f"Supabase storage request failed: {response.text}"
        raise HTTPException(status_code=response.status_code, detail=detail)

    # Return the public URL
    return f"{settings.require_supabase_url()}/storage/v1/object/public/{bucket_name}/{file_path}"
