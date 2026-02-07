from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

EventType = Literal[
    "spending",
    "food",
    "movement",
    "habit",
    "mood",
    "sleep",
    "social",
    "meds",
    "work",
    "study",
    "break",
    "water",
]

EventCategory = Literal[
    "finance",
    "nutrition",
    "fitness",
    "health",
    "social",
    "productivity",
    "selfcare",
]


class EventScores(BaseModel):
    wellness_impact: float | None = None
    cost_impact: float | None = None
    sustainability_impact: float | None = None
    explanations: dict[str, str] | None = None


class EventMetadata(BaseModel):
    merchant: str | None = None
    category: str | None = None
    ingredients: list[str] | None = None
    duration_minutes: int | None = None
    location: str | None = None
    notes: str | None = None
    steps: int | None = None
    type: str | None = None

    model_config = {"extra": "allow"}


class EventCreate(BaseModel):
    user_id: str = Field(..., min_length=1)
    event_type: EventType
    category: EventCategory
    title: str = Field(..., min_length=1)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    amount: float | None = None
    metadata: EventMetadata | dict | None = None
    scores: EventScores | dict | None = None


class EventOut(EventCreate):
    id: str
    created_at: datetime
