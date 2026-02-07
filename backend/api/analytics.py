from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from api.events import get_authenticated_user_id
from services.analytics_service import (
    get_before_after_comparison,
    get_breakdown_data,
    get_dashboard_stats,
    get_score_history,
    get_trend_data,
)

router = APIRouter()


class TrendPoint(BaseModel):
    date: str
    value: float


class TrendResponse(BaseModel):
    metric: str
    granularity: str
    data: list[TrendPoint]


class BreakdownSlice(BaseModel):
    name: str
    value: float
    percentage: float


class BreakdownResponse(BaseModel):
    type: str
    data: list[BreakdownSlice]


class StatValue(BaseModel):
    value: float
    change: float
    change_percent: float


class DashboardStats(BaseModel):
    period: str
    stats: dict[str, StatValue]


class ComparisonResponse(BaseModel):
    metric: str
    intervention_date: str
    before_avg: float
    after_avg: float
    change: float
    change_percent: float
    before_data: list[TrendPoint]
    after_data: list[TrendPoint]


class ScoreHistoryPoint(BaseModel):
    date: str
    wallet_score: float | None = None
    wellness_score: float | None = None
    sustainability_score: float | None = None
    movement_score: float | None = None


@router.get("/analytics/trends", response_model=TrendResponse)
def analytics_trends(
    metric: str = Query(...),
    start: datetime = Query(...),
    end: datetime = Query(...),
    granularity: str = Query("day"),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        data = get_trend_data(user_id, metric, start, end, granularity)
        return TrendResponse(metric=metric, granularity=granularity, data=data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/analytics/breakdown", response_model=BreakdownResponse)
def analytics_breakdown(
    type: str = Query(...),
    start: datetime = Query(...),
    end: datetime = Query(...),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        data = get_breakdown_data(user_id, type, start, end)
        return BreakdownResponse(type=type, data=data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/analytics/dashboard-stats", response_model=DashboardStats)
def analytics_dashboard_stats(
    period: str = Query("week", pattern="^(week|month)$"),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        return get_dashboard_stats(user_id, period)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/analytics/comparison", response_model=ComparisonResponse)
def analytics_comparison(
    intervention_date: date = Query(...),
    metric: str = Query(...),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        return get_before_after_comparison(user_id, intervention_date, metric)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/analytics/score-history", response_model=list[ScoreHistoryPoint])
def analytics_score_history(
    start: date = Query(...),
    end: date = Query(...),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        start_dt = datetime.combine(start, datetime.min.time())
        end_dt = datetime.combine(end, datetime.max.time())
        return get_score_history(user_id, start_dt, end_dt)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc
