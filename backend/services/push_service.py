from __future__ import annotations

import json
import os
import urllib.request
from typing import Any

from db.supabase import get_supabase_client

PREFERENCES_TABLE = "notification_preferences"


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    return supabase


def _push_enabled(user_id: str) -> bool:
    supabase = _require_supabase()
    response = (
        supabase.table(PREFERENCES_TABLE)
        .select("push_enabled")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        return False
    return bool(response.data[0].get("push_enabled"))


def _lookup_token(user_id: str) -> str | None:
    raw = os.getenv("PUSH_TOKEN_MAP", "{}")
    try:
        mapping = json.loads(raw)
        token = mapping.get(user_id)
        return str(token) if token else None
    except json.JSONDecodeError:
        return None


def send_push(user_id: str, title: str, body: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
    if not _push_enabled(user_id):
        return {"status": "skipped", "reason": "push_disabled"}
    token = _lookup_token(user_id)
    if not token:
        return {"status": "skipped", "reason": "no_token"}
    server_key = os.getenv("FCM_SERVER_KEY")
    if not server_key:
        return {"status": "skipped", "reason": "fcm_not_configured"}
    payload = {
        "to": token,
        "notification": {"title": title, "body": body},
        "data": data or {},
    }
    request = urllib.request.Request(
        os.getenv("FCM_URL", "https://fcm.googleapis.com/fcm/send"),
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"key={server_key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request) as response:
        response_body = response.read().decode("utf-8")
    return {"status": "sent", "response": response_body}


def notify_goal_milestone(user_id: str, goal_title: str, progress_pct: float) -> dict[str, Any]:
    title = "Goal milestone reached"
    body = f"{goal_title} is {progress_pct:.0f}% complete"
    return send_push(user_id, title, body, {"type": "goals"})


def notify_friend_challenge(user_id: str, friend_name: str, challenge_title: str) -> dict[str, Any]:
    title = "Friend completed a challenge"
    body = f"{friend_name} finished {challenge_title}"
    return send_push(user_id, title, body, {"type": "social"})


def notify_spending_alert(user_id: str, amount: float) -> dict[str, Any]:
    title = "Spending alert"
    body = f"You're over budget by ${amount:.2f}"
    return send_push(user_id, title, body, {"type": "reminders"})


def notify_insight_discovered(user_id: str, insight_title: str) -> dict[str, Any]:
    title = "New insight discovered"
    body = insight_title
    return send_push(user_id, title, body, {"type": "insights"})


def notify_badge_earned(user_id: str, badge_name: str) -> dict[str, Any]:
    title = "Badge earned"
    body = f"You earned the {badge_name} badge"
    return send_push(user_id, title, body, {"type": "goals"})
