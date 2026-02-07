from datetime import datetime, timedelta, date as date_type
from typing import Any, Dict, List, Optional

from db.supabase import get_supabase_client

TABLE_NAME = "movement_patterns"
EVENTS_TABLE = "events"
MOVEMENT_TESTS_TABLE = "movement_tests"


def _day_bounds(d: date_type) -> tuple[datetime, datetime]:
    start = datetime(d.year, d.month, d.day)
    end = start + timedelta(days=1) - timedelta(seconds=1)
    return start, end


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        iv = int(float(value))
        return iv if iv >= 0 else default
    except Exception:
        return default


def _classify_workout(title: str, meta_type: Optional[str]) -> bool:
    if meta_type and meta_type.lower() in {"workout", "run", "yoga", "lift", "training"}:
        return True
    t = title.lower()
    return any(key in t for key in ["run", "workout", "yoga", "lift", "training"])


def _compute_score(steps: int, active_minutes: int) -> int:
    steps_component = min(1.0, steps / 10000.0) * 50.0
    active_component = min(1.0, active_minutes / 30.0) * 50.0
    return int(round(min(100.0, steps_component + active_component)))


def update_daily_movement(user_id: str, d: date_type) -> Dict[str, Any]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")

    start, end = _day_bounds(d)
    events_resp = (
        supabase.table(EVENTS_TABLE)
        .select("title,event_type,category,amount,metadata,timestamp")
        .eq("user_id", user_id)
        .gte("timestamp", start.isoformat())
        .lte("timestamp", end.isoformat())
        .execute()
    )
    rows: List[Dict[str, Any]] = events_resp.data or []
    tests_resp = (
        supabase.table(MOVEMENT_TESTS_TABLE)
        .select("duration_seconds,created_at")
        .eq("user_id", user_id)
        .gte("created_at", start.isoformat())
        .lte("created_at", end.isoformat())
        .execute()
    )
    test_rows: List[Dict[str, Any]] = tests_resp.data or []

    steps_total = 0
    active_minutes = 0
    workout_count = 0
    sleep_hours = 0.0

    for row in rows:
        etype = (row.get("event_type") or "").lower()
        title = row.get("title") or ""
        amount = row.get("amount")
        meta = row.get("metadata") or {}

        if etype == "movement":
            steps_val = meta.get("steps")
            if steps_val is None and "step" in title.lower():
                steps_val = amount
            steps_total += _safe_int(steps_val or 0)

            dur = meta.get("duration_minutes", None)
            if dur is None and isinstance(amount, (int, float)):
                dur = amount
            active_minutes += _safe_int(dur or 0)

            meta_type = meta.get("type")
            if _classify_workout(title, meta_type):
                workout_count += 1

        elif etype == "sleep":
            if isinstance(amount, (int, float)):
                sleep_hours += float(amount)

    sleep_minutes = int(round(sleep_hours * 60.0))
    if test_rows:
        active_minutes += sum(
            _safe_int((row.get("duration_seconds") or 0) / 60.0) for row in test_rows
        )
        workout_count += len(test_rows)
    sedentary_minutes = max(0, 24 * 60 - sleep_minutes - active_minutes)
    total_movement_score = _compute_score(steps_total, active_minutes)

    payload = {
        "user_id": user_id,
        "date": d.isoformat(),
        "steps": steps_total,
        "active_minutes": active_minutes,
        "sedentary_minutes": sedentary_minutes,
        "workout_count": workout_count,
        "total_movement_score": total_movement_score,
        "updated_at": datetime.utcnow().isoformat(),
    }

    upsert_resp = (
        supabase.table(TABLE_NAME)
        .upsert(payload, on_conflict="user_id,date")
        .select("*")
        .single()
        .execute()
    )
    if upsert_resp.error:
        raise RuntimeError(upsert_resp.error.message)
    return upsert_resp.data


def get_movement_history(user_id: str, start_date: str, end_date: str) -> List[Dict[str, Any]]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    resp = (
        supabase.table(TABLE_NAME)
        .select("*")
        .eq("user_id", user_id)
        .gte("date", start_date)
        .lte("date", end_date)
        .order("date", desc=False)
        .execute()
    )
    return resp.data or []


def get_movement_stats(user_id: str, days: int = 7) -> Dict[str, Any]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    today = datetime.utcnow().date()
    start = (today - timedelta(days=days - 1)).isoformat()
    end = today.isoformat()
    rows_resp = (
        supabase.table(TABLE_NAME)
        .select("steps,active_minutes,sedentary_minutes,workout_count,total_movement_score")
        .eq("user_id", user_id)
        .gte("date", start)
        .lte("date", end)
        .execute()
    )
    rows: List[Dict[str, Any]] = rows_resp.data or []
    n = max(1, len(rows))
    totals = {
        "steps_total": sum(_safe_int(r.get("steps", 0)) for r in rows),
        "active_total": sum(_safe_int(r.get("active_minutes", 0)) for r in rows),
        "sedentary_total": sum(_safe_int(r.get("sedentary_minutes", 0)) for r in rows),
        "workouts_total": sum(_safe_int(r.get("workout_count", 0)) for r in rows),
        "score_total": sum(_safe_int(r.get("total_movement_score", 0)) for r in rows),
    }
    averages = {
        "steps_avg": int(round(totals["steps_total"] / n)),
        "active_avg": int(round(totals["active_total"] / n)),
        "sedentary_avg": int(round(totals["sedentary_total"] / n)),
        "score_avg": int(round(totals["score_total"] / n)),
    }
    return {"totals": totals, "averages": averages, "days": len(rows)}
