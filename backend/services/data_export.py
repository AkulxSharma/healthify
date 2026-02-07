from __future__ import annotations

import json
import os
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

from db.supabase import get_supabase_client

EXPORTS_TABLE = "data_export_jobs"


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    return supabase


def _safe_select(query) -> list[dict[str, Any]]:
    response = query.execute()
    if response.error:
        return []
    return response.data or []


def _fetch_by_user(table: str, user_id: str, fields: str = "*") -> list[dict[str, Any]]:
    supabase = _require_supabase()
    return _safe_select(supabase.table(table).select(fields).eq("user_id", user_id))


def _fetch_by_field(table: str, field: str, value: str, fields: str = "*") -> list[dict[str, Any]]:
    supabase = _require_supabase()
    return _safe_select(supabase.table(table).select(fields).eq(field, value))


def _fetch_in(table: str, field: str, values: list[str], fields: str = "*") -> list[dict[str, Any]]:
    if not values:
        return []
    supabase = _require_supabase()
    return _safe_select(supabase.table(table).select(fields).in_(field, values))


def _fetch_contains(table: str, field: str, values: list[str], fields: str = "*") -> list[dict[str, Any]]:
    if not values:
        return []
    supabase = _require_supabase()
    return _safe_select(supabase.table(table).select(fields).contains(field, values))


def _export_payload(user_id: str) -> dict[str, Any]:
    profile = _fetch_by_field("profiles", "id", user_id, "id,display_name,profile_type,created_at,updated_at")
    privacy = _fetch_by_user(
        "privacy_settings",
        user_id,
        "profile_visibility,activity_sharing,data_analytics_consent,updated_at,created_at",
    )
    settings = _fetch_by_user("user_settings", user_id, "*")
    events = _fetch_by_user("events", user_id, "*")
    movement = _fetch_by_user("movement_patterns", user_id, "*")
    movement_tests = _fetch_by_user("movement_tests", user_id, "*")
    movement_test_insights = _fetch_by_user("movement_test_insights", user_id, "*")
    activity_logs = _fetch_by_user("activity_logs", user_id, "*")
    score_snapshots = _fetch_by_user("score_snapshots", user_id, "*")
    risk_history = _fetch_by_user("risk_history", user_id, "*")
    decisions = _fetch_by_user("decisions", user_id, "*")
    swap_history = _fetch_by_user("swap_history", user_id, "*")
    swap_feedback = _fetch_by_user("swap_feedback", user_id, "*")
    shared_goals = _fetch_by_field("shared_goals", "creator_id", user_id, "*")
    goal_participants = _fetch_by_user("goal_participants", user_id, "*")
    group_challenges = _fetch_contains("group_challenges", "participants", [user_id], "*")
    friendships = _fetch_by_user("friendships", user_id, "*")
    friendships_reverse = _fetch_by_field("friendships", "friend_id", user_id, "*")
    user_activities = _fetch_by_user("user_activities", user_id, "*")
    achievements = _fetch_by_user("achievements", user_id, "*")
    notification_preferences = _fetch_by_user("notification_preferences", user_id, "*")
    alerts = _fetch_by_user("alerts", user_id, "*")
    voice_checkins = _fetch_by_user("voice_checkins", user_id, "*")
    checkin_ids = [str(row.get("id")) for row in voice_checkins if row.get("id")]
    voice_insights = _fetch_in("voice_checkin_insights", "checkin_id", checkin_ids, "*")

    return {
        "meta": {
            "generated_at": datetime.utcnow().isoformat(),
            "format": "lifemosaic_gdpr_export_v1",
            "user_id": user_id,
        },
        "profile": profile[0] if profile else None,
        "privacy_settings": privacy[0] if privacy else None,
        "settings": settings[0] if settings else None,
        "events": events,
        "movement_patterns": movement,
        "movement_tests": movement_tests,
        "movement_test_insights": movement_test_insights,
        "activity_logs": activity_logs,
        "score_snapshots": score_snapshots,
        "risk_history": risk_history,
        "decisions": decisions,
        "swap_history": swap_history,
        "swap_feedback": swap_feedback,
        "goals": {
            "shared_goals": shared_goals,
            "goal_participants": goal_participants,
            "group_challenges": group_challenges,
        },
        "social": {
            "friendships": friendships + friendships_reverse,
            "user_activities": user_activities,
        },
        "achievements": achievements,
        "notifications": {
            "preferences": notification_preferences[0] if notification_preferences else None,
            "alerts": alerts,
        },
        "voice_checkins": {
            "checkins": voice_checkins,
            "insights": voice_insights,
        },
        "insights_and_patterns": {
            "score_snapshots": score_snapshots,
            "risk_history": risk_history,
            "movement_patterns": movement,
        },
    }


def export_user_data(user_id: str, job_id: str | None = None) -> tuple[str, datetime]:
    export_id = job_id or str(uuid4())
    data = _export_payload(user_id)
    export_root = Path(os.getenv("DATA_EXPORT_DIR", "/tmp/lifemosaic_exports"))
    user_dir = export_root / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    json_path = user_dir / f"lifemosaic-export-{export_id}.json"
    zip_path = user_dir / f"lifemosaic-export-{export_id}.zip"
    with json_path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(json_path, arcname="lifemosaic-data.json")
    expires_at = datetime.utcnow() + timedelta(hours=24)
    return str(zip_path), expires_at
