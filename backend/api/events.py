from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

from db.supabase import get_supabase_client
from models.events import EventCategory, EventCreate, EventMetadata, EventOut, EventScores, EventType
from services.event_service import create_event, get_event_stats, get_events, rescore_events

router = APIRouter()


class EventCreateIn(BaseModel):
    event_type: EventType
    category: EventCategory
    title: str = Field(..., min_length=1)
    timestamp: datetime | None = None
    amount: float | None = None
    metadata: EventMetadata | dict | None = None
    scores: EventScores | dict | None = None


class EventAggregateOut(BaseModel):
    count: int
    total_amount: float


class EventStatsOut(BaseModel):
    by_type: dict[str, EventAggregateOut]
    by_category: dict[str, EventAggregateOut]


class EventListOut(BaseModel):
    events: list[EventOut]
    total: int
    has_more: bool


class EventRescoreOut(BaseModel):
    updated: int


def _parse_csv(value: str | None) -> list[str] | None:
    if not value:
        return None
    parts = [item.strip() for item in value.split(",")]
    cleaned = [item for item in parts if item]
    return cleaned or None


def get_authenticated_user_id(
    authorization: str | None = Header(None),
    x_user_id: str | None = Header(None),
) -> str:
    if x_user_id:
        return x_user_id
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization required")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization required")
    token = parts[1]
    supabase = get_supabase_client()
    if supabase is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization required")
    try:
        response = supabase.auth.get_user(token)
        user = response.user
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return user.id


@router.post("/events", response_model=EventOut)
def create_event_route(
    payload: EventCreateIn, user_id: str = Depends(get_authenticated_user_id)
):
    event = EventCreate(
        user_id=user_id,
        event_type=payload.event_type,
        category=payload.category,
        title=payload.title,
        timestamp=payload.timestamp or datetime.utcnow(),
        amount=payload.amount,
        metadata=payload.metadata,
        scores=payload.scores,
    )
    try:
        return create_event(event)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/events", response_model=EventListOut)
def list_events(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    types: str | None = Query(None),
    event_types: str | None = Query(None, alias="type"),
    categories: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        parsed_types = _parse_csv(types or event_types)
        parsed_categories = _parse_csv(categories)
        return get_events(
            user_id,
            start_date,
            end_date,
            parsed_types,
            parsed_categories,
            limit,
            offset,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.get("/events/stats", response_model=EventStatsOut)
def event_stats(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        raw = get_event_stats(user_id, start_date, end_date)
        by_type = {
            key: EventAggregateOut(**value) for key, value in raw.get("by_type", {}).items()
        }
        by_category = {
            key: EventAggregateOut(**value)
            for key, value in raw.get("by_category", {}).items()
        }
        return EventStatsOut(by_type=by_type, by_category=by_category)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.post("/events/rescore", response_model=EventRescoreOut)
def rescore_events_route(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    types: str | None = Query(None),
    categories: str | None = Query(None),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        parsed_types = _parse_csv(types)
        parsed_categories = _parse_csv(categories)
        updated = rescore_events(user_id, start_date, end_date, parsed_types, parsed_categories)
        return EventRescoreOut(updated=updated)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc
