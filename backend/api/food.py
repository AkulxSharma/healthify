import base64

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from api.events import get_authenticated_user_id
from services.food_analyzer import analyze_food_audio, analyze_food_description, analyze_food_photo

router = APIRouter()


class FoodAnalysisOut(BaseModel):
    meal_name: str
    estimated_calories: float | None = None
    ingredients: list[str] = Field(default_factory=list)
    nutrition_quality: int = Field(..., ge=1, le=10)
    protein_g: float | None = None
    sugar_g: float | None = None
    fat_g: float | None = None
    cost_estimate: float | None = None
    sustainability_score: int = Field(..., ge=1, le=10)
    meal_type: str | None = None


class FoodTextIn(BaseModel):
    description: str | None = None
    audio_base64: str | None = None


@router.post("/food/analyze-photo", response_model=FoodAnalysisOut)
async def analyze_photo(
    image: UploadFile = File(...),
    _user_id: str = Depends(get_authenticated_user_id),
):
    if image.content_type not in {"image/jpeg", "image/png"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image type")
    image_bytes = await image.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")
    try:
        payload = analyze_food_photo(image_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    return FoodAnalysisOut(**payload)


@router.post("/food/analyze-text", response_model=FoodAnalysisOut)
async def analyze_text(
    payload: FoodTextIn,
    _user_id: str = Depends(get_authenticated_user_id),
):
    if payload.audio_base64:
        raw = payload.audio_base64
        if "," in raw:
            raw = raw.split(",", 1)[1]
        try:
            audio_bytes = base64.b64decode(raw, validate=True)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid audio payload"
            ) from exc
        if len(audio_bytes) > 8 * 1024 * 1024:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")
        try:
            payload = analyze_food_audio(audio_bytes)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
            ) from exc
        return FoodAnalysisOut(**payload)

    description = payload.description or ""
    if not description.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Description required")
    try:
        payload = analyze_food_description(description)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    return FoodAnalysisOut(**payload)
