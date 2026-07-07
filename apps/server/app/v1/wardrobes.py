from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import AuthenticatedUser, bearer_scheme, get_current_authenticated_user
from app.db.session import get_db_session
from app.models.wardrobe import Wardrobe
from app.models.outfit import Outfit
from app.services.supabase_storage import upload_file_to_supabase
from app.v1.schemas import ClothingItemResponse, WardrobeResponse, WardrobeWithDetailsResponse, OutfitResponse
from sqlalchemy.orm import selectinload

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=WardrobeResponse)
async def create_wardrobe(
    name: Annotated[str, Form(...)],
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
            bucket_name="wardrobe_img",
            file_path=file_path,
            file=image.file,
            content_type=image.content_type,
            access_token=credentials.credentials,
        )

    db_wardrobe = Wardrobe(
        user_id=user.user.id,
        name=name,
        image_url=image_url
    )
    db.add(db_wardrobe)
    db.commit()
    db.refresh(db_wardrobe)
    return db_wardrobe


@router.get("/", response_model=list[WardrobeResponse])
def get_wardrobes(
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    wardrobes = db.scalars(
        select(Wardrobe)
        .options(selectinload(Wardrobe.clothing_items), selectinload(Wardrobe.outfits))
        .where(Wardrobe.user_id == user.user.id)
    ).all()
    return wardrobes


@router.get("/{wardrobe_id}", response_model=WardrobeWithDetailsResponse)
def get_wardrobe(
    wardrobe_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    wardrobe = db.scalar(
        select(Wardrobe)
        .options(
            selectinload(Wardrobe.clothing_items), 
            selectinload(Wardrobe.outfits).selectinload(Outfit.clothing_items),
            selectinload(Wardrobe.outfits).selectinload(Outfit.images)
        )
        .where(
            Wardrobe.id == wardrobe_id, Wardrobe.user_id == user.user.id
        )
    )
    if not wardrobe:
        raise HTTPException(status_code=404, detail="Wardrobe not found")
    return wardrobe


@router.patch("/{wardrobe_id}", response_model=WardrobeResponse)
async def update_wardrobe(
    wardrobe_id: str,
    name: Annotated[str | None, Form()] = None,
    image: Annotated[UploadFile | None, File()] = None,
    user: AuthenticatedUser = Depends(get_current_authenticated_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db_session),
):
    wardrobe = db.scalar(
        select(Wardrobe).where(
            Wardrobe.id == wardrobe_id, Wardrobe.user_id == user.user.id
        )
    )
    if not wardrobe:
        raise HTTPException(status_code=404, detail="Wardrobe not found")

    if name is not None:
        wardrobe.name = name
        
    if image:
        if not image.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")
            
        file_ext = image.filename.split(".")[-1] if image.filename and "." in image.filename else "jpg"
        file_path = f"{user.user.supabase_user_id}/{uuid4()}.{file_ext}"
        
        image_url = await upload_file_to_supabase(
            bucket_name="wardrobe_img",
            file_path=file_path,
            file=image.file,
            content_type=image.content_type,
            access_token=credentials.credentials,
        )
        wardrobe.image_url = image_url

    db.commit()
    db.refresh(wardrobe)
    return wardrobe


@router.delete("/{wardrobe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wardrobe(
    wardrobe_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    wardrobe = db.scalar(
        select(Wardrobe).where(
            Wardrobe.id == wardrobe_id, Wardrobe.user_id == user.user.id
        )
    )
    if not wardrobe:
        raise HTTPException(status_code=404, detail="Wardrobe not found")

    db.delete(wardrobe)
    db.commit()


@router.get("/{wardrobe_id}/clothing-items", response_model=list[ClothingItemResponse])
def get_wardrobe_clothing_items(
    wardrobe_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    wardrobe = db.scalar(
        select(Wardrobe).where(
            Wardrobe.id == wardrobe_id, Wardrobe.user_id == user.user.id
        )
    )
    if not wardrobe:
        raise HTTPException(status_code=404, detail="Wardrobe not found")
        
    return wardrobe.clothing_items


@router.get("/{wardrobe_id}/outfits", response_model=list[OutfitResponse])
def get_wardrobe_outfits(
    wardrobe_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    wardrobe = db.scalar(
        select(Wardrobe)
        .options(selectinload(Wardrobe.outfits))
        .where(
            Wardrobe.id == wardrobe_id, Wardrobe.user_id == user.user.id
        )
    )
    if not wardrobe:
        raise HTTPException(status_code=404, detail="Wardrobe not found")
        
    return wardrobe.outfits

