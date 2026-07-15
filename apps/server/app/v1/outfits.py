from typing import Annotated
import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, Query
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.auth import AuthenticatedUser, bearer_scheme, get_current_authenticated_user
from app.db.session import get_db_session
from app.models.outfit import Outfit
from app.models.clothing_item import ClothingItem
from app.models.wardrobe import Wardrobe
from app.models.outfit_image import OutfitImage
from app.services.supabase_storage import upload_file_to_supabase
from app.v1.schemas import OutfitResponse, OutfitWithItemsResponse, OutfitWithWardrobesResponse, OutfitImageResponse, RecentLookResponse

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=OutfitResponse)
async def create_outfit(
    name: Annotated[str, Form(...)],
    is_ai_generated: Annotated[bool, Form()] = False,
    clothing_item_ids: Annotated[list[str], Form()] = [],
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
            bucket_name="outfits_img",
            file_path=file_path,
            file=image.file,
            content_type=image.content_type,
            access_token=credentials.credentials,
        )

    db_outfit = Outfit(
        user_id=user.user.id,
        name=name,
        is_ai_generated=is_ai_generated
    )
    
    # If clothing items were provided, link them
    clothes = []
    if clothing_item_ids:
        # Fetch the actual clothing items to ensure they exist and belong to the user
        clothes = db.scalars(
            select(ClothingItem).where(
                ClothingItem.id.in_(clothing_item_ids),
                ClothingItem.user_id == user.user.id
            )
        ).all()
        db_outfit.clothing_items.extend(clothes)

    if wardrobe_ids:
        wardrobes = db.scalars(
            select(Wardrobe)
            .options(selectinload(Wardrobe.clothing_items))
            .where(
                Wardrobe.id.in_(wardrobe_ids),
                Wardrobe.user_id == user.user.id
            )
        ).all()
        db_outfit.wardrobes.extend(wardrobes)
        
        for w in wardrobes:
            for c in clothes:
                if c not in w.clothing_items:
                    w.clothing_items.append(c)

    db.add(db_outfit)
    db.commit()
    
    if image_url:
        db_image = OutfitImage(
            outfit_id=db_outfit.id,
            image_url=image_url,
            date=datetime.date.today()
        )
        db.add(db_image)
        db.commit()
        
    db.refresh(db_outfit)
    return db_outfit


@router.get("/recent-looks", response_model=list[RecentLookResponse])
def get_recent_looks(
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
    limit: int = Query(3, ge=1, le=50),
    offset: int = Query(0, ge=0)
):
    recent_images = db.scalars(
        select(OutfitImage)
        .join(OutfitImage.outfit)
        .options(selectinload(OutfitImage.outfit))
        .where(Outfit.user_id == user.user.id)
        .order_by(OutfitImage.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    
    return recent_images


@router.get("/", response_model=list[OutfitWithItemsResponse])
def get_outfits(
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    outfits = db.scalars(
        select(Outfit)
        .options(
            selectinload(Outfit.clothing_items), 
            selectinload(Outfit.wardrobes),
            selectinload(Outfit.images)
        )
        .where(Outfit.user_id == user.user.id)
        .limit(limit)
        .offset(offset)
    ).all()
    return outfits


@router.get("/{outfit_id}", response_model=OutfitWithWardrobesResponse)
def get_outfit(
    outfit_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    # Use selectinload to eagerly load clothing_items, wardrobes, and images and avoid N+1 queries
    outfit = db.scalar(
        select(Outfit)
        .options(
            selectinload(Outfit.clothing_items), 
            selectinload(Outfit.wardrobes),
            selectinload(Outfit.images)
        )
        .where(Outfit.id == outfit_id, Outfit.user_id == user.user.id)
    )
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
    return outfit


@router.patch("/{outfit_id}", response_model=OutfitResponse)
async def update_outfit(
    outfit_id: str,
    name: Annotated[str | None, Form()] = None,
    is_ai_generated: Annotated[bool | None, Form()] = None,
    wardrobe_ids: Annotated[list[str] | None, Form()] = None,
    image: Annotated[UploadFile | None, File()] = None,
    user: AuthenticatedUser = Depends(get_current_authenticated_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db_session),
):
    outfit = db.scalar(
        select(Outfit)
        .options(selectinload(Outfit.clothing_items), selectinload(Outfit.wardrobes))
        .where(
            Outfit.id == outfit_id, Outfit.user_id == user.user.id
        )
    )
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    if name is not None:
        outfit.name = name
    if is_ai_generated is not None:
        outfit.is_ai_generated = is_ai_generated
        
    if wardrobe_ids is not None:
        if wardrobe_ids:
            wardrobes = db.scalars(
                select(Wardrobe)
                .options(selectinload(Wardrobe.clothing_items))
                .where(
                    Wardrobe.id.in_(wardrobe_ids),
                    Wardrobe.user_id == user.user.id
                )
            ).all()
            outfit.wardrobes = list(wardrobes)
            
            # Sync clothes to new wardrobes
            for w in wardrobes:
                for c in outfit.clothing_items:
                    if c not in w.clothing_items:
                        w.clothing_items.append(c)
        else:
            outfit.wardrobes = []
            
    if image:
        if not image.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")
            
        file_ext = image.filename.split(".")[-1] if image.filename and "." in image.filename else "jpg"
        file_path = f"{user.user.supabase_user_id}/{uuid4()}.{file_ext}"
        
        image_url = await upload_file_to_supabase(
            bucket_name="outfits_img",
            file_path=file_path,
            file=image.file,
            content_type=image.content_type,
            access_token=credentials.credentials,
        )
        db_image = OutfitImage(
            outfit_id=outfit.id,
            image_url=image_url,
            date=datetime.date.today()
        )
        db.add(db_image)

    db.commit()
    db.refresh(outfit)
    return outfit


@router.delete("/{outfit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_outfit(
    outfit_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    outfit = db.scalar(
        select(Outfit).where(
            Outfit.id == outfit_id, Outfit.user_id == user.user.id
        )
    )
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    db.delete(outfit)
    db.commit()


@router.post("/{outfit_id}/items", response_model=OutfitWithItemsResponse)
def add_clothing_item_to_outfit(
    outfit_id: str,
    clothing_item_id: Annotated[str, Form(...)],
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    outfit = db.scalar(
        select(Outfit)
        .options(selectinload(Outfit.clothing_items))
        .where(Outfit.id == outfit_id, Outfit.user_id == user.user.id)
    )
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    # Check if clothing item exists and belongs to user
    clothing_item = db.scalar(
        select(ClothingItem).where(
            ClothingItem.id == clothing_item_id, ClothingItem.user_id == user.user.id
        )
    )
    if not clothing_item:
        raise HTTPException(status_code=404, detail="Clothing item not found")

    # Check if already added
    if any(item.id == clothing_item_id for item in outfit.clothing_items):
        raise HTTPException(status_code=400, detail="Item already in outfit")

    outfit.clothing_items.append(clothing_item)
    db.commit()
    db.refresh(outfit)
    return outfit


@router.delete("/{outfit_id}/items/{clothing_item_id}", response_model=OutfitWithItemsResponse)
def remove_clothing_item_from_outfit(
    outfit_id: str,
    clothing_item_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    outfit = db.scalar(
        select(Outfit)
        .options(selectinload(Outfit.clothing_items))
        .where(Outfit.id == outfit_id, Outfit.user_id == user.user.id)
    )
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    # Filter out the item
    original_len = len(outfit.clothing_items)
    outfit.clothing_items = [item for item in outfit.clothing_items if item.id != clothing_item_id]
    
    if len(outfit.clothing_items) == original_len:
        raise HTTPException(status_code=404, detail="Item not in outfit")

    db.commit()
    db.refresh(outfit)
    return outfit


@router.post("/{outfit_id}/wardrobes/{wardrobe_id}", response_model=OutfitWithWardrobesResponse)
def add_outfit_to_wardrobe(
    outfit_id: str,
    wardrobe_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    outfit = db.scalar(
        select(Outfit)
        .options(selectinload(Outfit.clothing_items), selectinload(Outfit.wardrobes))
        .where(Outfit.id == outfit_id, Outfit.user_id == user.user.id)
    )
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    wardrobe = db.scalar(
        select(Wardrobe)
        .options(selectinload(Wardrobe.clothing_items))
        .where(Wardrobe.id == wardrobe_id, Wardrobe.user_id == user.user.id)
    )
    if not wardrobe:
        raise HTTPException(status_code=404, detail="Wardrobe not found")

    if wardrobe not in outfit.wardrobes:
        outfit.wardrobes.append(wardrobe)
        
    # Sync clothes
    for c in outfit.clothing_items:
        if c not in wardrobe.clothing_items:
            wardrobe.clothing_items.append(c)

    db.commit()
    db.refresh(outfit)
    return outfit


@router.delete("/{outfit_id}/wardrobes/{wardrobe_id}", response_model=OutfitWithWardrobesResponse)
def remove_outfit_from_wardrobe(
    outfit_id: str,
    wardrobe_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    outfit = db.scalar(
        select(Outfit)
        .options(selectinload(Outfit.clothing_items), selectinload(Outfit.wardrobes))
        .where(Outfit.id == outfit_id, Outfit.user_id == user.user.id)
    )
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    wardrobe = db.scalar(
        select(Wardrobe).where(Wardrobe.id == wardrobe_id, Wardrobe.user_id == user.user.id)
    )
    if not wardrobe:
        raise HTTPException(status_code=404, detail="Wardrobe not found")

    if wardrobe in outfit.wardrobes:
        outfit.wardrobes.remove(wardrobe)
        db.commit()
        db.refresh(outfit)
    else:
        raise HTTPException(status_code=404, detail="Outfit not in wardrobe")

    return outfit


@router.post("/{outfit_id}/images", status_code=status.HTTP_201_CREATED, response_model=OutfitImageResponse)
async def add_outfit_image(
    outfit_id: str,
    image: Annotated[UploadFile, File(...)],
    date: Annotated[datetime.date | None, Form()] = None,
    user: AuthenticatedUser = Depends(get_current_authenticated_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db_session),
):
    outfit = db.scalar(
        select(Outfit).where(Outfit.id == outfit_id, Outfit.user_id == user.user.id)
    )
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")

    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
        
    file_ext = image.filename.split(".")[-1] if image.filename and "." in image.filename else "jpg"
    file_path = f"{user.user.supabase_user_id}/{uuid4()}.{file_ext}"
    
    image_url = await upload_file_to_supabase(
        bucket_name="user_outfits_img",
        file_path=file_path,
        file=image.file,
        content_type=image.content_type,
        access_token=credentials.credentials,
    )

    db_image = OutfitImage(
        outfit_id=outfit.id,
        image_url=image_url,
        date=date
    )
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    return db_image


@router.delete("/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_outfit_image(
    image_id: str,
    user: Annotated[AuthenticatedUser, Depends(get_current_authenticated_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    outfit_image = db.scalar(
        select(OutfitImage)
        .join(Outfit)
        .where(
            OutfitImage.id == image_id,
            Outfit.user_id == user.user.id
        )
    )
    if not outfit_image:
        raise HTTPException(status_code=404, detail="Outfit image not found")

    db.delete(outfit_image)
    db.commit()
