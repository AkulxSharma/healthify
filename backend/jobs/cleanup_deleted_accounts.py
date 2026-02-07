from __future__ import annotations

from datetime import datetime
from typing import Any

from db.supabase import get_supabase_client
from services.data_deletion import permanently_delete_user

PROFILES_TABLE = "profiles"


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    return supabase


def run_cleanup() -> list[dict[str, Any]]:
    supabase = _require_supabase()
    response = (
        supabase.table(PROFILES_TABLE)
        .select("id,deletion_scheduled_for")
        .not_.is_("deletion_scheduled_for", "null")
        .lte("deletion_scheduled_for", datetime.utcnow().isoformat())
        .execute()
    )
    results: list[dict[str, Any]] = []
    for row in response.data or []:
        user_id = row.get("id")
        if not user_id:
            continue
        try:
            permanently_delete_user(str(user_id))
            results.append({"user_id": str(user_id), "status": "deleted"})
        except Exception as exc:
            results.append({"user_id": str(user_id), "status": "failed", "error": str(exc)})
    return results


if __name__ == "__main__":
    run_cleanup()
