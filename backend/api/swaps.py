import uuid
from datetime import datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field

from api.events import get_authenticated_user_id
from db.supabase import get_supabase_client
from models.events import EventCreate
from services.event_service import create_event
from services.food_analyzer import analyze_food_photo
from services.swap_engine import suggest_all_alternatives

router = APIRouter()

SwapType = Literal["healthier", "cheaper", "eco"]
RejectionReason = Literal[
    "taste_preference",
    "availability",
    "too_expensive",
    "dietary_restriction",
    "time_constraint",
    "not_realistic",
    "other",
]


class MealAnalysisOut(BaseModel):
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


class SwapSuggestIn(BaseModel):
    meal_data: dict[str, Any]



class SwapSuggestionOut(BaseModel):
    swap_id: str
    original: dict[str, Any]
    healthier: dict[str, Any]
    cheaper: dict[str, Any]
    eco: dict[str, Any]
    best_balanced: SwapType


class SwapAcceptIn(BaseModel):
    swap_id: str
    original_event_id: str | None = None
    swap_type: SwapType
    original_data: dict[str, Any]
    alternative_data: dict[str, Any]


class SwapAcceptOut(BaseModel):
    id: str
    event_id: str


class SwapHistoryItem(BaseModel):
    id: str
    swap_type: SwapType
    original_data: dict[str, Any]
    alternative_data: dict[str, Any]
    accepted_at: datetime


class SwapRejectIn(BaseModel):
    swap_id: str | None = None
    original_meal: dict[str, Any]
    alternative: dict[str, Any]
    swap_type: SwapType
    reason: RejectionReason
    custom_reason: str | None = None
    would_try_modified: bool = False


class SwapRejectOut(BaseModel):
    id: str
    message: str


class SwapFeedbackSummaryOut(BaseModel):
    accepted_count: int
    rejected_count: int
    acceptance_rate: float
    most_common_rejection: str | None = None


@router.post("/swaps/analyze-meal", response_model=MealAnalysisOut)
async def analyze_meal(
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
    return MealAnalysisOut(**payload)


@router.post("/swaps/suggest", response_model=SwapSuggestionOut)
def suggest_swap(payload: SwapSuggestIn, _user_id: str = Depends(get_authenticated_user_id)):
    alternatives = suggest_all_alternatives(payload.meal_data)
    return SwapSuggestionOut(
        swap_id=str(uuid.uuid4()),
        original=payload.meal_data,
        healthier=alternatives["healthier"],
        cheaper=alternatives["cheaper"],
        eco=alternatives["eco"],
        best_balanced=alternatives["best_balanced"],
    )


@router.post("/swaps/accept", response_model=SwapAcceptOut)
def accept_swap(payload: SwapAcceptIn, user_id: str = Depends(get_authenticated_user_id)):
    supabase = get_supabase_client()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not configured",
        )

    insert_payload = {
        "id": payload.swap_id,
        "user_id": user_id,
        "original_event_id": payload.original_event_id,
        "swap_type": payload.swap_type,
        "original_data": payload.original_data,
        "alternative_data": payload.alternative_data,
    }
    response = supabase.table("swap_history").insert(insert_payload).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to log swap")

    alternative = payload.alternative_data or {}
    calories = alternative.get("calories")
    cost_estimate = alternative.get("cost_estimate")
    savings = alternative.get("savings")
    nutrition_quality = alternative.get("nutrition_quality")
    sustainability_score = alternative.get("sustainability_score")

    metadata = {
        "swap_id": payload.swap_id,
        "swap_type": payload.swap_type,
        "swap_accepted": True,
        "is_swap": True,
        "original_data": payload.original_data,
        "alternative_data": payload.alternative_data,
        "nutrition_quality_score": nutrition_quality,
        "sustainability_score": sustainability_score,
        "swap_savings": savings,
        "money_saved_via_swaps": savings,
        "cost_estimate": cost_estimate,
    }
    event_type = "spending" if payload.swap_type == "cheaper" else "food"
    category = "finance" if payload.swap_type == "cheaper" else "nutrition"
    amount = cost_estimate if payload.swap_type == "cheaper" else calories
    event = EventCreate(
        user_id=user_id,
        event_type=event_type,
        category=category,
        title=f"Swap accepted: {alternative.get('alternative', 'Meal swap')}",
        timestamp=datetime.utcnow(),
        amount=amount if isinstance(amount, (int, float)) else None,
        metadata=metadata,
    )
    created = create_event(event)

    return SwapAcceptOut(id=response.data[0].get("id", payload.swap_id), event_id=created.id)


@router.post("/swaps/reject", response_model=SwapRejectOut)
def reject_swap(payload: SwapRejectIn, user_id: str = Depends(get_authenticated_user_id)):
    supabase = get_supabase_client()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not configured",
        )
    swap_id = payload.swap_id or str(uuid.uuid4())
    custom_reason = payload.custom_reason if payload.reason == "other" else None
    insert_payload = {
        "swap_id": swap_id,
        "user_id": user_id,
        "original_meal": payload.original_meal,
        "suggested_alternative": payload.alternative,
        "swap_type": payload.swap_type,
        "rejection_reason": payload.reason,
        "custom_reason": custom_reason,
        "would_try_modified": payload.would_try_modified,
        "rejected_at": datetime.utcnow().isoformat(),
    }
    response = supabase.table("swap_feedback").insert(insert_payload).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to log feedback"
        )
    return SwapRejectOut(id=response.data[0].get("id", swap_id), message="Thanks for the feedback.")


@router.get("/swaps/history", response_model=list[SwapHistoryItem])
def swap_history(
    days: int = Query(30, ge=1, le=365),
    user_id: str = Depends(get_authenticated_user_id),
):
    supabase = get_supabase_client()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not configured",
        )
    since = datetime.utcnow() - timedelta(days=days)
    response = (
        supabase.table("swap_history")
        .select("id,swap_type,original_data,alternative_data,accepted_at")
        .eq("user_id", user_id)
        .gte("accepted_at", since.isoformat())
        .order("accepted_at", desc=True)
        .execute()
    )
    rows = response.data or []
    return [
        SwapHistoryItem(
            id=row.get("id"),
            swap_type=row.get("swap_type"),
            original_data=row.get("original_data") or {},
            alternative_data=row.get("alternative_data") or {},
            accepted_at=row.get("accepted_at"),
        )
        for row in rows
    ]


@router.get("/swaps/feedback-summary", response_model=SwapFeedbackSummaryOut)
def swap_feedback_summary(
    days: int = Query(60, ge=1, le=365),
    user_id: str = Depends(get_authenticated_user_id),
):
    supabase = get_supabase_client()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not configured",
        )
    since = datetime.utcnow() - timedelta(days=days)
    history_resp = (
        supabase.table("swap_history")
        .select("id")
        .eq("user_id", user_id)
        .gte("accepted_at", since.isoformat())
        .execute()
    )
    accepted_count = len(history_resp.data or [])
    feedback_resp = (
        supabase.table("swap_feedback")
        .select("rejection_reason")
        .eq("user_id", user_id)
        .gte("rejected_at", since.isoformat())
        .execute()
    )
    reasons = feedback_resp.data or []
    rejected_count = len(reasons)
    reason_counts: dict[str, int] = {}
    for row in reasons:
        reason = str(row.get("rejection_reason") or "").strip()
        if not reason:
            continue
        reason_counts[reason] = reason_counts.get(reason, 0) + 1
    most_common = None
    if reason_counts:
        most_common = max(reason_counts.items(), key=lambda item: item[1])[0]
    total = accepted_count + rejected_count
    acceptance_rate = (accepted_count / total) if total else 0.0
    return SwapFeedbackSummaryOut(
        accepted_count=accepted_count,
        rejected_count=rejected_count,
        acceptance_rate=round(acceptance_rate, 3),
        most_common_rejection=most_common,
    )
