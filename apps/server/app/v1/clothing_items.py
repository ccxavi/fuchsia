from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import AuthenticatedUser, bearer_scheme, get_current_authenticated_user
from app.db.session import get_db_session
from app.models.clothing_item import ClothingItem
from app.models.wardrobe import Wardrobe
from app.services.supabase_storage import upload_file_to_supabase
from app.v1.schemas import ClothingItemResponse, ClothingItemWithWardrobesResponse
from sqlalchemy.orm import selectinload

router = APIRouter()

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=ClothingItemResponse)
async def create_clothing_item(
    name: Annotated[str, Form(...)],
    category: Annotated[str | None, Form()] = None,
    color: Annotated[str | None, Form()] = None,
    brand: Annotated[str | None, Form()] = None,
    wardrobe_ids: Annotated[list[str], Form()] = [],
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
    
    if wardrobe_ids:
        wardrobes = db.scalars(
            select(Wardrobe).where(
                Wardrobe.id.in_(wardrobe_ids),
                Wardrobe.user_id == user.user.id
            )
        ).all()
        db_item.wardrobes = list(wardrobes)

    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    return db_item


@router.post("/{item_id}/wardrobes/{wardrobe_id}", status_code=status.HTTP_200_OK, response_model=ClothingItemResponse)
def add_item_to_wardrobe(
    item_id: str,
    wardrobe_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    item = db.scalar(select(ClothingItem).where(ClothingItem.id == item_id, ClothingItem.user_id == user.user.id))
    wardrobe = db.scalar(select(Wardrobe).where(Wardrobe.id == wardrobe_id, Wardrobe.user_id == user.user.id))
    
    if not item or not wardrobe:
        raise HTTPException(status_code=404, detail="Clothing item or Wardrobe not found")
        
    if wardrobe not in item.wardrobes:
        item.wardrobes.append(wardrobe)
        db.commit()
        db.refresh(item)
        
    return item


@router.delete("/{item_id}/wardrobes/{wardrobe_id}", status_code=status.HTTP_200_OK, response_model=ClothingItemResponse)
def remove_item_from_wardrobe(
    item_id: str,
    wardrobe_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    item = db.scalar(select(ClothingItem).where(ClothingItem.id == item_id, ClothingItem.user_id == user.user.id))
    wardrobe = db.scalar(select(Wardrobe).where(Wardrobe.id == wardrobe_id, Wardrobe.user_id == user.user.id))
    
    if not item or not wardrobe:
        raise HTTPException(status_code=404, detail="Clothing item or Wardrobe not found")
        
    if wardrobe in item.wardrobes:
        item.wardrobes.remove(wardrobe)
        db.commit()
        db.refresh(item)
        
    return item


@router.get("/", response_model=list[ClothingItemResponse])
def get_clothing_items(
    user: AuthenticatedUser = Depends(get_current_authenticated_user),
    db: Session = Depends(get_db_session),
):
    items = db.scalars(
        select(ClothingItem).where(ClothingItem.user_id == user.user.id)
    ).all()
    return items


@router.get("/{item_id}", response_model=ClothingItemWithWardrobesResponse)
def get_clothing_item(
    item_id: str,
    user: AuthenticatedUser = Depends(get_current_authenticated_user),
    db: Session = Depends(get_db_session),
):
    item = db.scalar(
        select(ClothingItem)
        .options(selectinload(ClothingItem.wardrobes))
        .where(
            ClothingItem.id == item_id, ClothingItem.user_id == user.user.id
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Clothing item not found")
    return item


@router.patch("/{item_id}", response_model=ClothingItemResponse)
async def update_clothing_item(
    item_id: str,
    name: Annotated[str | None, Form()] = None,
    category: Annotated[str | None, Form()] = None,
    color: Annotated[str | None, Form()] = None,
    brand: Annotated[str | None, Form()] = None,
    is_favorite: Annotated[bool | None, Form()] = None,
    wardrobe_ids: Annotated[list[str] | None, Form()] = None,
    image: Annotated[UploadFile | None, File()] = None,
    user: AuthenticatedUser = Depends(get_current_authenticated_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db_session),
):
    item = db.scalar(
        select(ClothingItem)
        .options(selectinload(ClothingItem.wardrobes))
        .where(
            ClothingItem.id == item_id, ClothingItem.user_id == user.user.id
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Clothing item not found")

    if name is not None:
        item.name = name
    if category is not None:
        item.category = category
    if color is not None:
        item.color = color
    if brand is not None:
        item.brand = brand
    if is_favorite is not None:
        item.is_favorite = is_favorite
        
    if wardrobe_ids is not None:
        if wardrobe_ids:
            wardrobes = db.scalars(
                select(Wardrobe).where(
                    Wardrobe.id.in_(wardrobe_ids),
                    Wardrobe.user_id == user.user.id
                )
            ).all()
            item.wardrobes = list(wardrobes)
        else:
            item.wardrobes = []
        
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
        item.image_url = image_url

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clothing_item(
    item_id: str,
    user: AuthenticatedUser = Depends(get_current_authenticated_user),
    db: Session = Depends(get_db_session),
):
    item = db.scalar(
        select(ClothingItem).where(
            ClothingItem.id == item_id, ClothingItem.user_id == user.user.id
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Clothing item not found")

    db.delete(item)
    db.commit()
