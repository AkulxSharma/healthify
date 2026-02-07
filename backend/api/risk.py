from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from api.events import get_authenticated_user_id
from services.risk_scoring import (
    calculate_burnout_risk,
    calculate_financial_risk,
    calculate_injury_risk,
    calculate_isolation_risk,
    get_risk_history,
)

router = APIRouter()


class RiskFactor(BaseModel):
    name: str
    impact: float
    details: str


class RiskResponse(BaseModel):
    days: int
    risk: float
    level: str
    factors: list[RiskFactor]
    recommendations: list[str]


class RiskHistoryPoint(BaseModel):
    date: str
    burnout_risk: float | None = None
    injury_risk: float | None = None
    isolation_risk: float | None = None
    financial_risk: float | None = None


@router.get("/risk/burnout", response_model=RiskResponse)
def risk_burnout(
    days: int = Query(7, ge=1, le=60),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        return calculate_burnout_risk(user_id, days)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/risk/injury", response_model=RiskResponse)
def risk_injury(
    days: int = Query(7, ge=1, le=60),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        return calculate_injury_risk(user_id, days)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/risk/isolation", response_model=RiskResponse)
def risk_isolation(
    days: int = Query(7, ge=1, le=60),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        return calculate_isolation_risk(user_id, days)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/risk/financial", response_model=RiskResponse)
def risk_financial(
    days: int = Query(30, ge=1, le=120),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        return calculate_financial_risk(user_id, days)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/risk/history", response_model=list[RiskHistoryPoint])
def risk_history(
    days: int = Query(30, ge=1, le=120),
    types: str | None = Query(None),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        type_list = [t.strip() for t in types.split(",")] if types else None
        return get_risk_history(user_id, days, type_list)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc
