import io
import json
import os
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from db.supabase import get_supabase_client


class VoiceInsightResult(BaseModel):
    mood: int = Field(..., ge=0, le=10)
    stress: int = Field(..., ge=0, le=10)
    symptoms: list[str]
    summary: str


class VoiceCheckin(BaseModel):
    id: str
    user_id: str
    storage_path: str
    duration_seconds: int
    created_at: datetime


class VoiceCheckinInsight(BaseModel):
    id: str
    checkin_id: str
    created_at: datetime
    transcript: str
    mood_score: int
    stress_score: int
    symptoms: list[str]
    summary: str


def _get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    from openai import OpenAI
    return OpenAI(api_key=api_key)


def _download_audio(storage_path: str) -> bytes:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    return supabase.storage.from_("voice-checkins").download(storage_path)


def _transcribe_audio(audio_bytes: bytes) -> str:
    client = _get_openai_client()
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = "checkin.webm"
    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
    )
    return transcript.text


def _extract_json(content: str) -> dict[str, Any]:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(content[start : end + 1])


def _structure_transcript(transcript: str) -> VoiceInsightResult:
    client = _get_openai_client()
    schema = {
        "name": "voice_checkin_insight",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "mood": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 10,
                    "description": "Overall mood score from 0 (low) to 10 (high).",
                },
                "stress": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 10,
                    "description": "Overall stress score from 0 (low) to 10 (high).",
                },
                "symptoms": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Key physical or mental symptoms mentioned.",
                },
                "summary": {
                    "type": "string",
                    "description": "Short paragraph summarizing the day.",
                },
            },
            "required": ["mood", "stress", "symptoms", "summary"],
        },
        "strict": True,
    }
    system_prompt = (
        "You are a health journaling assistant. "
        "Given a transcript of a person talking about their day, return only valid JSON "
        "matching the provided schema."
    )
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_schema", "json_schema": schema},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": transcript},
        ],
    )
    content = completion.choices[0].message.content or ""
    payload = _extract_json(content)
    try:
        return VoiceInsightResult.model_validate(payload)
    except ValidationError:
        raise


def _get_checkin(checkin_id: str) -> VoiceCheckin:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    response = (
        supabase.table("voice_checkins")
        .select("id,user_id,storage_path,duration_seconds,created_at")
        .eq("id", checkin_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        raise ValueError("Voice check-in not found")
    return VoiceCheckin.model_validate(response.data[0])


def _get_existing_insight(checkin_id: str) -> VoiceCheckinInsight | None:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    response = (
        supabase.table("voice_checkin_insights")
        .select("id,checkin_id,created_at,transcript,mood_score,stress_score,symptoms,summary")
        .eq("checkin_id", checkin_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        return None
    return VoiceCheckinInsight.model_validate(response.data[0])


def process_voice_checkin(checkin_id: str) -> VoiceCheckinInsight:
    existing = _get_existing_insight(checkin_id)
    if existing:
        return existing

    checkin = _get_checkin(checkin_id)
    audio_bytes = _download_audio(checkin.storage_path)
    transcript = _transcribe_audio(audio_bytes)
    structured = _structure_transcript(transcript)

    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    payload = {
        "checkin_id": checkin.id,
        "transcript": transcript,
        "mood_score": structured.mood,
        "stress_score": structured.stress,
        "symptoms": structured.symptoms,
        "summary": structured.summary,
    }
    response = supabase.table("voice_checkin_insights").insert(payload).execute()
    if not response.data:
        raise RuntimeError("Failed to create voice check-in insight")
    return VoiceCheckinInsight.model_validate(response.data[0])


def get_recent_checkins_with_insights(user_id: str, limit: int = 5) -> list[dict[str, Any]]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    response = (
        supabase.table("voice_checkins")
        .select(
            "id,user_id,storage_path,duration_seconds,created_at,"
            "voice_checkin_insights(id,checkin_id,created_at,transcript,mood_score,stress_score,symptoms,summary)"
        )
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    rows: list[dict[str, Any]] = response.data or []
    results: list[dict[str, Any]] = []
    for row in rows:
        insights = row.get("voice_checkin_insights") or []
        insight = insights[0] if isinstance(insights, list) and insights else None
        results.append(
            {
                "id": row.get("id"),
                "user_id": row.get("user_id"),
                "storage_path": row.get("storage_path"),
                "duration_seconds": row.get("duration_seconds"),
                "created_at": row.get("created_at"),
                "insight": insight,
            }
        )
    return results
