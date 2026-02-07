from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from api.events import get_authenticated_user_id
from services.digital_twin import (
    compare_scenarios,
    project_sustainability,
    project_wallet_longterm,
    project_wallet_shortterm,
    project_wellness,
)

router = APIRouter()


class WalletTrajectoryPoint(BaseModel):
    date: str
    balance: float
    lower: float | None = None
    upper: float | None = None


class RecurringExpense(BaseModel):
    name: str
    amount: float
    cadence_days: int
    next_due: str


class WalletProjection(BaseModel):
    current_balance: float
    trajectories: dict[str, list[WalletTrajectoryPoint]]
    recurring_expenses: list[RecurringExpense]
    savings_potential: float


class WalletMonthlyBreakdown(BaseModel):
    month: str
    projected_income: float
    projected_spend: float
    net: float
    cumulative_balance: float


class WalletLongTermProjection(BaseModel):
    current_balance: float
    trajectories: dict[str, list[WalletTrajectoryPoint]]
    monthly_breakdown: list[WalletMonthlyBreakdown]
    cumulative_savings: dict[str, float]
    major_expenses: list[dict[str, str | float]]


class WellnessProjectionPoint(BaseModel):
    date: str
    score: float
    sleep: float
    diet: float
    movement: float
    stress: float


class WellnessFactor(BaseModel):
    name: str
    impact: float
    detail: str


class WellnessProjection(BaseModel):
    current_score: float
    projected_scores: list[WellnessProjectionPoint]
    trajectories: dict[str, list[WellnessProjectionPoint]]
    factors_impacting: list[WellnessFactor]
    recommended_changes: list[str]


class SustainabilityPoint(BaseModel):
    date: str
    co2e: float
    water: float
    waste: float


class SustainabilityImpact(BaseModel):
    name: str
    impact: float
    detail: str


class SustainabilityProjection(BaseModel):
    current_footprint: float
    projected_footprint: float
    trajectories: dict[str, list[SustainabilityPoint]]
    improvement_potential: float
    top_impact_areas: list[SustainabilityImpact]


class ScenarioInputs(BaseModel):
    name: str
    inputs: dict[str, float] | None = None


class ScenarioPoint(BaseModel):
    date: str
    value: float


class ScenarioResult(BaseModel):
    name: str
    data: list[ScenarioPoint]
    final_value: float


class DivergencePoint(BaseModel):
    date: str
    impact: float


class ScenarioComparisonResponse(BaseModel):
    scenarios: list[ScenarioResult]
    divergence_points: list[DivergencePoint]


class ScenarioComparisonRequest(BaseModel):
    scenarios: list[ScenarioInputs]
    metric: str
    days: int = 30


@router.get("/digital-twin/wallet", response_model=WalletProjection)
def digital_twin_wallet(
    days: int = Query(30, ge=1, le=90),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        return project_wallet_shortterm(user_id, days)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/digital-twin/wallet-long", response_model=WalletLongTermProjection)
def digital_twin_wallet_long(
    months: int = Query(3, ge=3, le=6),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        return project_wallet_longterm(user_id, months)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/digital-twin/wellness", response_model=WellnessProjection)
def digital_twin_wellness(
    days: int = Query(30, ge=30, le=90),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        return project_wellness(user_id, days)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/digital-twin/sustainability", response_model=SustainabilityProjection)
def digital_twin_sustainability(
    days: int = Query(30, ge=30, le=90),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        return project_sustainability(user_id, days)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.post("/digital-twin/compare", response_model=ScenarioComparisonResponse)
def digital_twin_compare(
    payload: ScenarioComparisonRequest,
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        return compare_scenarios(user_id, payload.scenarios, payload.metric, payload.days)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc
