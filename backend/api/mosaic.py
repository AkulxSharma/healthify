from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from api.events import get_authenticated_user_id
from services.mosaic_service import generate_daily_mosaic, generate_week_mosaic

router = APIRouter()


class MosaicTile(BaseModel):
    key: str
    name: str
    score: float
    color: str
    detail: str


class DailyMosaic(BaseModel):
    date: str
    overall_score: float
    story: str
    tiles: list[MosaicTile]


@router.get("/mosaic/daily", response_model=DailyMosaic)
def mosaic_daily(
    date: date = Query(...),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        return generate_daily_mosaic(user_id, date)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/mosaic/week", response_model=list[DailyMosaic])
def mosaic_week(
    start: date = Query(...),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        return generate_week_mosaic(user_id, start)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc
