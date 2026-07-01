from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.auth import AuthenticatedUser, bearer_scheme, get_current_authenticated_user
from app.db.session import get_db_session
from app.models.clothing_item import ClothingItem
from app.services.supabase_storage import upload_file_to_supabase
from app.v1.schemas import ClothingItemResponse

router = APIRouter()

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=ClothingItemResponse)
async def create_clothing_item(
    name: Annotated[str, Form(...)],
    category: Annotated[str | None, Form()] = None,
    color: Annotated[str | None, Form()] = None,
    brand: Annotated[str | None, Form()] = None,
    image: Annotated[UploadFile | None, File()] = None,
    user: AuthenticatedUser = Depends(get_current_authenticated_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db_session),
):
    image_url = None
    if image:
        if not image.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")
            
        file_ext = image.filename.split(".")[-1] if image.filename and "." in image.filename else "jpg"
        file_path = f"{user.user.supabase_user_id}/{uuid4()}.{file_ext}"
        
        image_url = await upload_file_to_supabase(
            bucket_name="clothing_items_img",
            file_path=file_path,
            file=image.file,
            content_type=image.content_type,
            access_token=credentials.credentials,
        )

    db_item = ClothingItem(
        user_id=user.user.id,
        name=name,
        category=category,
        color=color,
        brand=brand,
        image_url=image_url
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    return db_item
