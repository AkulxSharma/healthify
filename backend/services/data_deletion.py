from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta
from typing import Any

from db.supabase import get_supabase_client
from services.email_service import send_account_deletion_email

PROFILES_TABLE = "profiles"
PRIVACY_TABLE = "privacy_settings"

DELETION_GRACE_DAYS = 30
TOKEN_TTL_HOURS = 24


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    return supabase


def _get_user_email(user_id: str) -> str | None:
    supabase = _require_supabase()
    try:
        auth_response = supabase.auth.admin.get_user_by_id(user_id)
        user = auth_response.user if hasattr(auth_response, "user") else auth_response.get("user")
        email = user.email if hasattr(user, "email") else user.get("email")
        return str(email) if email else None
    except Exception:
        return None


def _verify_password(user_id: str, password: str) -> bool:
    email = _get_user_email(user_id)
    if not email:
        return False
    supabase = _require_supabase()
    try:
        response = supabase.auth.sign_in_with_password({"email": email, "password": password})
    except Exception:
        return False
    return bool(response and getattr(response, "session", None))


def request_account_deletion(user_id: str, password: str, confirmation: str, base_url: str) -> dict[str, Any]:
    if confirmation.strip() != "DELETE MY ACCOUNT":
        raise ValueError("Confirmation phrase does not match.")
    if not _verify_password(user_id, password):
        raise ValueError("Password verification failed.")
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=TOKEN_TTL_HOURS)
    supabase = _require_supabase()
    update_resp = (
        supabase.table(PROFILES_TABLE)
        .update(
            {
                "deletion_token": token,
                "deletion_token_expires_at": expires_at.isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
        )
        .eq("id", user_id)
        .execute()
    )
    if update_resp.error:
        raise RuntimeError(str(update_resp.error))
    confirm_url = f"{base_url}/account/delete-confirm?token={token}"
    email_result = send_account_deletion_email(user_id, confirm_url)
    return {"status": email_result.get("status", "sent"), "email_result": email_result}


def delete_user_account(user_id: str, confirm_token: str) -> datetime:
    supabase = _require_supabase()
    profile_resp = (
        supabase.table(PROFILES_TABLE)
        .select("deletion_token,deletion_token_expires_at,deleted_at")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    row = profile_resp.data[0] if profile_resp.data else None
    if not row:
        raise RuntimeError("Profile not found.")
    token = row.get("deletion_token")
    if not token or token != confirm_token:
        raise ValueError("Invalid confirmation token.")
    expires_at = row.get("deletion_token_expires_at")
    if expires_at:
        expires_dt = datetime.fromisoformat(str(expires_at))
        if expires_dt < datetime.utcnow():
            raise ValueError("Confirmation token expired.")
    scheduled_for = datetime.utcnow() + timedelta(days=DELETION_GRACE_DAYS)
    update_resp = (
        supabase.table(PROFILES_TABLE)
        .update(
            {
                "deleted_at": datetime.utcnow().isoformat(),
                "deletion_scheduled_for": scheduled_for.isoformat(),
                "is_active": False,
                "deletion_token": None,
                "deletion_token_expires_at": None,
                "updated_at": datetime.utcnow().isoformat(),
            }
        )
        .eq("id", user_id)
        .execute()
    )
    if update_resp.error:
        raise RuntimeError(str(update_resp.error))
    privacy_payload = {
        "user_id": user_id,
        "profile_visibility": "private",
        "activity_sharing": False,
        "data_analytics_consent": False,
        "updated_at": datetime.utcnow().isoformat(),
    }
    supabase.table(PRIVACY_TABLE).upsert(privacy_payload, on_conflict="user_id").execute()
    _safe_delete("user_activities", "user_id", user_id)
    return scheduled_for


def cancel_account_deletion(user_id: str) -> bool:
    supabase = _require_supabase()
    response = (
        supabase.table(PROFILES_TABLE)
        .select("deleted_at,deletion_scheduled_for")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    row = response.data[0] if response.data else None
    if not row or not row.get("deleted_at"):
        return False
    scheduled_for = row.get("deletion_scheduled_for")
    if scheduled_for:
        scheduled_dt = datetime.fromisoformat(str(scheduled_for))
        if scheduled_dt < datetime.utcnow():
            return False
    update_resp = (
        supabase.table(PROFILES_TABLE)
        .update(
            {
                "deleted_at": None,
                "deletion_scheduled_for": None,
                "is_active": True,
                "updated_at": datetime.utcnow().isoformat(),
            }
        )
        .eq("id", user_id)
        .execute()
    )
    if update_resp.error:
        raise RuntimeError(str(update_resp.error))
    return True


def _safe_delete(table: str, field: str, value: str) -> None:
    supabase = _require_supabase()
    response = supabase.table(table).delete().eq(field, value).execute()
    if response.error:
        message = str(response.error)
        if "relation" in message or "does not exist" in message:
            return
        raise RuntimeError(message)


def _safe_delete_in(table: str, field: str, values: list[str]) -> None:
    if not values:
        return
    supabase = _require_supabase()
    response = supabase.table(table).delete().in_(field, values).execute()
    if response.error:
        message = str(response.error)
        if "relation" in message or "does not exist" in message:
            return
        raise RuntimeError(message)


def permanently_delete_user(user_id: str) -> None:
    _safe_delete("events", "user_id", user_id)
    _safe_delete("movement_patterns", "user_id", user_id)
    _safe_delete("movement_tests", "user_id", user_id)
    _safe_delete("movement_test_insights", "user_id", user_id)
    _safe_delete("activity_logs", "user_id", user_id)
    _safe_delete("score_snapshots", "user_id", user_id)
    _safe_delete("risk_history", "user_id", user_id)
    _safe_delete("decisions", "user_id", user_id)
    _safe_delete("swap_history", "user_id", user_id)
    _safe_delete("swap_feedback", "user_id", user_id)
    _safe_delete("goal_participants", "user_id", user_id)
    _safe_delete("shared_goals", "creator_id", user_id)
    _safe_delete("user_activities", "user_id", user_id)
    _safe_delete("achievements", "user_id", user_id)
    _safe_delete("notification_preferences", "user_id", user_id)
    _safe_delete("alerts", "user_id", user_id)
    _safe_delete("privacy_settings", "user_id", user_id)
    _safe_delete("user_settings", "user_id", user_id)
    _safe_delete("data_export_jobs", "user_id", user_id)
    _safe_delete("friendships", "user_id", user_id)
    _safe_delete("friendships", "friend_id", user_id)
    checkins = _require_supabase().table("voice_checkins").select("id").eq("user_id", user_id).execute()
    checkin_ids = [str(row.get("id")) for row in (checkins.data or []) if row.get("id")]
    _safe_delete_in("voice_checkin_insights", "checkin_id", checkin_ids)
    _safe_delete("voice_checkins", "user_id", user_id)
    _safe_delete(PROFILES_TABLE, "id", user_id)
    supabase = _require_supabase()
    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception:
        return
