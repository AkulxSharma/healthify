from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from middleware.api_auth import ApiKeyContext, require_api_key, require_scope
from models.events import EventCategory, EventCreate, EventMetadata, EventOut, EventScores, EventType
from services.event_service import create_event, get_events

router = APIRouter(prefix="/v1")


class EventCreateIn(BaseModel):
    event_type: EventType
    category: EventCategory
    title: str = Field(..., min_length=1)
    timestamp: datetime | None = None
    amount: float | None = None
    metadata: EventMetadata | dict | None = None
    scores: EventScores | dict | None = None


class EventListOut(BaseModel):
    events: list[EventOut]
    total: int
    has_more: bool


@router.get("/events", response_model=EventListOut)
def list_events(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    types: str | None = Query(None),
    categories: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    context: ApiKeyContext = Depends(require_api_key),
):
    try:
        require_scope(context, "events")
        parsed_types = [item.strip() for item in (types or "").split(",") if item.strip()] or None
        parsed_categories = [item.strip() for item in (categories or "").split(",") if item.strip()] or None
        return get_events(
            context.user_id,
            start_date,
            end_date,
            parsed_types,
            parsed_categories,
            limit,
            offset,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/events", response_model=EventOut)
def create_event_v1(payload: EventCreateIn, context: ApiKeyContext = Depends(require_api_key)):
    try:
        require_scope(context, "events")
        event = EventCreate(
            user_id=context.user_id,
            event_type=payload.event_type,
            category=payload.category,
            title=payload.title,
            timestamp=payload.timestamp or datetime.utcnow(),
            amount=payload.amount,
            metadata=payload.metadata,
            scores=payload.scores,
        )
        return create_event(event)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
