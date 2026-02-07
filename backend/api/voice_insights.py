from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from services.voice_insights import get_recent_checkins_with_insights, process_voice_checkin

router = APIRouter()


class VoiceCheckinInsightOut(BaseModel):
    id: str
    checkin_id: str
    created_at: datetime
    transcript: str
    mood_score: int = Field(..., ge=0, le=10)
    stress_score: int = Field(..., ge=0, le=10)
    symptoms: list[str]
    summary: str


class VoiceCheckinWithInsightOut(BaseModel):
    id: str
    user_id: str
    storage_path: str
    duration_seconds: int
    created_at: datetime
    insight: VoiceCheckinInsightOut | None = None


@router.post("/voice-checkins/{checkin_id}/process", response_model=VoiceCheckinInsightOut)
def process_checkin(checkin_id: str):
    try:
        insight = process_voice_checkin(checkin_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    return VoiceCheckinInsightOut(**insight.model_dump())


@router.get("/voice-checkins/recent", response_model=list[VoiceCheckinWithInsightOut])
def recent_checkins(user_id: str = Query(..., min_length=1), limit: int = Query(5, ge=1, le=50)):
    try:
        rows = get_recent_checkins_with_insights(user_id, limit)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    return [VoiceCheckinWithInsightOut(**row) for row in rows]
