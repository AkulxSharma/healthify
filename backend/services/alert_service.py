from __future__ import annotations

from datetime import datetime
from typing import Any

from db.supabase import get_supabase_client

ALERTS_TABLE = "alerts"
PREFERENCES_TABLE = "notification_preferences"


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    return supabase


def _alert_enabled(user_id: str, alert_type: str) -> bool:
    supabase = _require_supabase()
    response = (
        supabase.table(PREFERENCES_TABLE)
        .select("alert_types")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        return True
    alert_types = response.data[0].get("alert_types") or {}
    return bool(alert_types.get(alert_type, True))


def create_alert(
    user_id: str,
    alert_type: str,
    title: str,
    message: str,
    action_link: str | None = None,
) -> dict[str, Any]:
    if not _alert_enabled(user_id, alert_type):
        return {"status": "skipped", "reason": "alert_disabled"}
    supabase = _require_supabase()
    payload = {
        "user_id": user_id,
        "alert_type": alert_type,
        "title": title,
        "message": message,
        "action_link": action_link,
        "read": False,
        "created_at": datetime.utcnow().isoformat(),
    }
    response = supabase.table(ALERTS_TABLE).insert(payload).execute()
    if not response.data:
        return {"status": "error"}
    return {"status": "created", "alert": response.data[0]}


def get_alerts(user_id: str, unread_only: bool = False) -> list[dict[str, Any]]:
    supabase = _require_supabase()
    query = supabase.table(ALERTS_TABLE).select("*").eq("user_id", user_id)
    if unread_only:
        query = query.eq("read", False)
    response = query.order("created_at", desc=True).execute()
    return response.data or []


def mark_alert_read(user_id: str, alert_id: str) -> bool:
    supabase = _require_supabase()
    response = (
        supabase.table(ALERTS_TABLE)
        .update({"read": True})
        .eq("id", alert_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(response.data)
