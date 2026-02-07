from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from api.events import get_authenticated_user_id
from services.pattern_detection import (
    detect_correlations,
    detect_positive_patterns,
    generate_insight_notifications,
    identify_triggers,
)
from services.alert_service import create_alert
from services.push_service import notify_insight_discovered

router = APIRouter()


class CorrelationInsight(BaseModel):
    pattern: str
    frequency: int
    impact_metric: str
    impact_value: float
    impact_description: str
    confidence: float
    recommendation: str


class TriggerEntry(BaseModel):
    type: str
    value: str
    occurrence_rate: float
    impact_metric: str
    impact_value: float


class TriggerInsightResponse(BaseModel):
    negative_pattern: str
    triggers: list[TriggerEntry]
    recommendations: list[str]


class InsightNotification(BaseModel):
    type: str
    title: str
    message: str
    severity: str
    action: str
    link: str


class PositivePattern(BaseModel):
    pattern: str
    started_date: str
    improvement: str
    streak: int
    message: str
    encouragement: str


@router.get("/insights/correlations", response_model=list[CorrelationInsight])
def get_correlations(
    days: int = Query(30, ge=7, le=365),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        return detect_correlations(user_id, lookback_days=days)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/insights/triggers", response_model=TriggerInsightResponse)
def get_triggers(
    pattern: str = Query(..., min_length=2),
    days: int = Query(30, ge=7, le=365),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        return identify_triggers(user_id, pattern, lookback_days=days)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/insights/notifications", response_model=list[InsightNotification])
def get_notifications(user_id: str = Depends(get_authenticated_user_id)):
    try:
        notifications = generate_insight_notifications(user_id)
        for row in notifications[:2]:
            create_alert(
                user_id,
                "insights",
                row.get("title") or "Insight discovered",
                row.get("message") or "",
                row.get("link"),
            )
            if row.get("title"):
                notify_insight_discovered(user_id, str(row.get("title")))
        return notifications
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/insights/positive-patterns", response_model=list[PositivePattern])
def get_positive_patterns(
    days: int = Query(30, ge=7, le=365),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        return detect_positive_patterns(user_id, days=days)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc
