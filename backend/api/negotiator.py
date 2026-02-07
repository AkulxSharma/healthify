from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from api.events import get_authenticated_user_id
from db.supabase import get_supabase_client
from services.habit_negotiator import (
    analyze_cost_impact,
    analyze_health_impact,
    analyze_sustainability_impact,
    generate_alternative,
    negotiate_decision,
)

router = APIRouter()


class NegotiatorRequest(BaseModel):
    query: str
    context: dict[str, Any] | None = None


class CostImpact(BaseModel):
    immediate_cost: float
    budget_impact_pct: float
    budget_remaining: float
    opportunity_cost: str
    weekly_spend_rate: str
    indicator: str
    severity: str


class HealthImpact(BaseModel):
    calories: float
    nutrition_quality: int
    protein_g: float
    sugar_g: float
    wellness_score_change: float
    goal_alignment: dict[str, Any]
    indicator: str
    severity: str


class SustainabilityImpact(BaseModel):
    co2e_kg: float
    co2e_comparison: str
    packaging_waste: str
    packaging_details: str
    sourcing: str
    score_change: float
    baseline_comparison: str
    indicator: str
    severity: str


class NegotiatorBreakdown(BaseModel):
    cost_impact: CostImpact
    health_impact: HealthImpact
    sustainability_impact: SustainabilityImpact


class NegotiatorAlternative(BaseModel):
    suggestion: str
    cost: float
    cost_saved: float
    health_improvement: dict[str, Any]
    sustainability_improvement: dict[str, Any]
    effort: str
    reasoning: str


class NegotiatorResponse(BaseModel):
    query: str
    answer: str
    breakdown: NegotiatorBreakdown
    alternative: NegotiatorAlternative
    final_recommendation: str


class NegotiatorAnalyzeRequest(BaseModel):
    item: str
    price: float | None = None
    context: dict[str, Any] | None = None


class NegotiatorAnalyzeResponse(BaseModel):
    item: str
    cost_impact: CostImpact
    health_impact: HealthImpact
    sustainability_impact: SustainabilityImpact
    alternative: NegotiatorAlternative


class DecisionLogRequest(BaseModel):
    query: str
    item: str
    decision_type: str
    alternative: dict[str, Any] | None = None
    cost_actual: float | None = None
    impacts: dict[str, Any]


class DecisionLogResponse(BaseModel):
    id: str
    message: str


class DecisionHistoryEntry(BaseModel):
    query: str
    decision: str
    date: str
    savings: float
    impacts: dict[str, Any]


@router.post("/negotiator/ask", response_model=NegotiatorResponse)
def ask_negotiator(payload: NegotiatorRequest, user_id: str = Depends(get_authenticated_user_id)):
    try:
        return negotiate_decision(user_id, payload.query, payload.context)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.post("/negotiator/analyze", response_model=NegotiatorAnalyzeResponse)
def analyze_negotiator(payload: NegotiatorAnalyzeRequest, user_id: str = Depends(get_authenticated_user_id)):
    try:
        price = payload.price or 0.0
        cost_impact = analyze_cost_impact(payload.item, price, user_id)
        health_impact = analyze_health_impact(payload.item, user_id)
        sustainability_impact = analyze_sustainability_impact(payload.item)
        alternative = generate_alternative(
            payload.item,
            {"cost_impact": cost_impact, "health_impact": health_impact, "sustainability_impact": sustainability_impact},
            user_id,
        )
        return {
            "item": payload.item,
            "cost_impact": cost_impact,
            "health_impact": health_impact,
            "sustainability_impact": sustainability_impact,
            "alternative": alternative,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.post("/negotiator/log-decision", response_model=DecisionLogResponse)
def log_decision(payload: DecisionLogRequest, user_id: str = Depends(get_authenticated_user_id)):
    supabase = get_supabase_client()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not configured",
        )
    impacts = payload.impacts or {}
    alternative = payload.alternative or {}
    summary = {
        "calories_saved": float(
            (alternative.get("health_improvement") or {}).get("calories_saved") or 0.0
        ),
        "co2e_saved": float(
            (alternative.get("sustainability_improvement") or {}).get("co2e_saved") or 0.0
        ),
        "savings": float((alternative.get("cost_saved") or 0.0)),
    }
    impacts["summary"] = summary
    original_cost = (
        impacts.get("cost_impact", {}).get("immediate_cost")
        if isinstance(impacts.get("cost_impact"), dict)
        else None
    )
    original_cost = float(original_cost or payload.cost_actual or 0.0)
    cost_actual = float(payload.cost_actual or original_cost)
    insert_payload = {
        "user_id": user_id,
        "query": payload.query,
        "item": payload.item,
        "original_cost": original_cost,
        "decision_type": payload.decision_type,
        "alternative_taken": payload.decision_type == "took_alternative",
        "cost_actual": cost_actual,
        "impacts": impacts,
        "logged_at": datetime.utcnow().isoformat(),
    }
    response = supabase.table("decisions").insert(insert_payload).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to log decision")
    scores = {
        "cost_impact": -abs(cost_actual),
        "wellness_impact": float(impacts.get("health_impact", {}).get("wellness_score_change") or 0.0),
        "sustainability_impact": float(impacts.get("sustainability_impact", {}).get("score_change") or 0.0),
        "explanations": {
            "wellness": "Negotiator decision impact",
            "cost": "Negotiator decision impact",
            "sustainability": "Negotiator decision impact",
        },
    }
    event_payload = {
        "user_id": user_id,
        "event_type": "spending",
        "category": "finance",
        "title": payload.item,
        "timestamp": datetime.utcnow().isoformat(),
        "amount": cost_actual,
        "metadata": {
            "type": "negotiator_decision",
            "decision_type": payload.decision_type,
            "alternative_taken": payload.decision_type == "took_alternative",
            "item": payload.item,
            "query": payload.query,
            "impacts": impacts,
        },
        "scores": scores,
    }
    supabase.table("events").insert(event_payload).execute()
    return {
        "id": response.data[0].get("id"),
        "message": "Decision logged! Updating your stats...",
    }


@router.get("/negotiator/history", response_model=list[DecisionHistoryEntry])
def decision_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_authenticated_user_id),
):
    supabase = get_supabase_client()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not configured",
        )
    response = (
        supabase.table("decisions")
        .select("query,decision_type,original_cost,cost_actual,impacts,logged_at")
        .eq("user_id", user_id)
        .order("logged_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    rows = response.data or []
    results: list[DecisionHistoryEntry] = []
    for row in rows:
        original_cost = float(row.get("original_cost") or 0.0)
        actual_cost = float(row.get("cost_actual") or original_cost)
        savings = round(original_cost - actual_cost, 2)
        results.append(
            DecisionHistoryEntry(
                query=row.get("query") or "",
                decision=row.get("decision_type") or "",
                date=row.get("logged_at") or "",
                savings=savings,
                impacts=row.get("impacts") or {},
            )
        )
    return results
