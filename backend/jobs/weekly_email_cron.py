from __future__ import annotations

from typing import Any

from db.supabase import get_supabase_client
from services.email_service import send_weekly_email

PREFERENCES_TABLE = "notification_preferences"


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    return supabase


def run_weekly_emails() -> list[dict[str, Any]]:
    supabase = _require_supabase()
    response = (
        supabase.table(PREFERENCES_TABLE)
        .select("user_id,email_enabled,frequency")
        .eq("email_enabled", True)
        .eq("frequency", "weekly")
        .execute()
    )
    results: list[dict[str, Any]] = []
    for row in response.data or []:
        user_id = row.get("user_id")
        if not user_id:
            continue
        result = send_weekly_email(str(user_id))
        results.append({"user_id": str(user_id), **result})
    return results


if __name__ == "__main__":
    run_weekly_emails()
