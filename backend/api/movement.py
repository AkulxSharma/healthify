from datetime import datetime, date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from api.events import get_authenticated_user_id
from services.movement_service import (
    get_movement_history,
    get_movement_stats,
    update_daily_movement,
)

router = APIRouter()


class MovementPatternOut(BaseModel):
    id: str
    user_id: str
    date: date_type
    steps: int
    active_minutes: int
    sedentary_minutes: int
    workout_count: int
    total_movement_score: int
    created_at: datetime
    updated_at: datetime


class MovementStatsOut(BaseModel):
    days: int
    totals: dict[str, int]
    averages: dict[str, int]


def _parse_date(raw: str | None) -> date_type:
    if not raw:
        return datetime.utcnow().date()
    try:
        return date_type.fromisoformat(raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format"
        ) from exc


@router.get("/movement/daily", response_model=MovementPatternOut)
def get_daily_movement(
    date: str | None = Query(None),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        target = _parse_date(date)
        row = update_daily_movement(user_id, target)
        return MovementPatternOut(**row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/movement/history", response_model=list[MovementPatternOut])
def movement_history(
    start: str = Query(...),
    end: str = Query(...),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        _parse_date(start)
        _parse_date(end)
        rows = get_movement_history(user_id, start, end)
        return [MovementPatternOut(**row) for row in rows]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/movement/stats", response_model=MovementStatsOut)
def movement_stats(
    days: int = Query(7, ge=1, le=90),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        data = get_movement_stats(user_id, days)
        return MovementStatsOut(**data)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.post("/movement/sync", response_model=MovementPatternOut)
def sync_movement(
    date: str | None = Query(None),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        target = _parse_date(date)
        row = update_daily_movement(user_id, target)
        return MovementPatternOut(**row)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc
