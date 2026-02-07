from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from api.events import get_authenticated_user_id
from services.receipt_processor import process_receipt_image

router = APIRouter()


class ReceiptItemOut(BaseModel):
    name: str
    quantity: float | None = None
    price: float | None = None


class ReceiptExtractionOut(BaseModel):
    total_amount: float | None = None
    merchant: str | None = None
    date: str | None = None
    category: str | None = None
    items: list[ReceiptItemOut] = []


@router.post("/receipts/process", response_model=ReceiptExtractionOut)
async def process_receipt(
    image: UploadFile = File(...),
    _user_id: str = Depends(get_authenticated_user_id),
):
    if image.content_type not in {"image/jpeg", "image/png"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image type")
    image_bytes = await image.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")
    try:
        payload = process_receipt_image(image_bytes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc
    return ReceiptExtractionOut(**payload)
