from datetime import datetime, timedelta
from typing import Any

from db.supabase import get_supabase_client
from services.alert_service import create_alert
from services.push_service import notify_badge_earned

EVENTS_TABLE = "events"
SWAP_HISTORY_TABLE = "swap_history"
SCORE_SNAPSHOTS_TABLE = "score_snapshots"
ACHIEVEMENTS_TABLE = "achievements"
USER_ACTIVITIES_TABLE = "user_activities"

BADGE_DEFINITIONS = [
    {"badge_type": "savings_master", "badge_name": "Penny Pincher", "target": 100, "metric": "savings"},
    {"badge_type": "savings_master", "badge_name": "Budget Boss", "target": 1000, "metric": "savings"},
    {"badge_type": "streak_king", "badge_name": "7-Day Streak", "target": 7, "metric": "streak"},
    {"badge_type": "swap_expert", "badge_name": "Swap Master", "target": 50, "metric": "swaps"},
    {"badge_type": "eco_champion", "badge_name": "Eco Warrior", "target": 100, "metric": "co2"},
    {"badge_type": "wellness_warrior", "badge_name": "Wellness Warrior", "target": 80, "metric": "wellness_avg"},
]


def _safe_float(value: Any) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except Exception:
        return 0.0


def _fetch_recent_events(user_id: str, days: int = 365) -> list[dict[str, Any]]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    since = datetime.utcnow() - timedelta(days=days)
    response = (
        supabase.table(EVENTS_TABLE)
        .select("timestamp,metadata")
        .eq("user_id", user_id)
        .gte("timestamp", since.isoformat())
        .execute()
    )
    return response.data or []


def _compute_savings_and_co2(events: list[dict[str, Any]]) -> tuple[float, float]:
    savings_total = 0.0
    co2_total = 0.0
    for row in events:
        metadata = row.get("metadata") or {}
        savings_total += _safe_float(
            metadata.get("money_saved_via_swaps")
            or metadata.get("swap_savings")
            or metadata.get("money_saved")
        )
        co2_total += _safe_float(
            metadata.get("co2_saved")
            or metadata.get("co2e_saved")
            or metadata.get("co2e_kg")
            or metadata.get("co2e_kg_saved")
            or metadata.get("co2_reduced")
        )
    return round(savings_total, 2), round(co2_total, 2)


def _compute_streak(events: list[dict[str, Any]]) -> int:
    dates = set()
    for row in events:
        ts = row.get("timestamp")
        if not ts:
            continue
        try:
            date_value = datetime.fromisoformat(ts.replace("Z", "+00:00")).date()
        except Exception:
            continue
        dates.add(date_value)
    streak = 0
    cursor = datetime.utcnow().date()
    while cursor in dates:
        streak += 1
        cursor = cursor - timedelta(days=1)
    return streak


def _compute_wellness_avg(user_id: str) -> float:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    response = (
        supabase.table(SCORE_SNAPSHOTS_TABLE)
        .select("wellness_score,date")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .limit(7)
        .execute()
    )
    rows = response.data or []
    if not rows:
        return 0.0
    scores = [_safe_float(row.get("wellness_score")) for row in rows]
    avg = sum(scores) / max(1, len(scores))
    return round(avg, 2)


def _count_swaps(user_id: str) -> int:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    response = supabase.table(SWAP_HISTORY_TABLE).select("id", count="exact").eq("user_id", user_id).execute()
    return int(response.count or 0)


def _existing_badges(user_id: str) -> dict[str, dict[str, Any]]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    response = supabase.table(ACHIEVEMENTS_TABLE).select("*").eq("user_id", user_id).execute()
    rows = response.data or []
    return {str(row.get("badge_name")): row for row in rows if row.get("badge_name")}


def _progress_for_metric(metric: str, savings: float, co2: float, swaps: int, streak: int, wellness_avg: float) -> float:
    if metric == "savings":
        return savings
    if metric == "co2":
        return co2
    if metric == "swaps":
        return float(swaps)
    if metric == "streak":
        return float(streak)
    if metric == "wellness_avg":
        return wellness_avg
    return 0.0


def check_and_award_achievements(user_id: str) -> list[dict[str, Any]]:
    supabase = get_supabase_client()
    if supabase is None:
        return []
    events = _fetch_recent_events(user_id, days=365)
    savings_total, co2_total = _compute_savings_and_co2(events)
    streak = _compute_streak(events)
    swaps = _count_swaps(user_id)
    wellness_avg = _compute_wellness_avg(user_id)
    existing = _existing_badges(user_id)
    awarded: list[dict[str, Any]] = []
    for badge in BADGE_DEFINITIONS:
        progress = _progress_for_metric(
            badge["metric"], savings_total, co2_total, swaps, streak, wellness_avg
        )
        if progress < badge["target"]:
            continue
        if badge["badge_name"] in existing:
            continue
        payload = {
            "user_id": user_id,
            "badge_type": badge["badge_type"],
            "badge_name": badge["badge_name"],
            "earned_at": datetime.utcnow().isoformat(),
            "progress_current": progress,
            "progress_target": badge["target"],
        }
        response = supabase.table(ACHIEVEMENTS_TABLE).insert(payload).execute()
        if response.data:
            row = response.data[0]
            awarded.append(row)
            supabase.table(USER_ACTIVITIES_TABLE).insert(
                {
                    "user_id": user_id,
                    "activity_type": "milestone",
                    "title": f"Achievement unlocked: {badge['badge_name']}",
                    "description": f"Earned {badge['badge_name']}",
                    "metadata": {"badge_type": badge["badge_type"], "badge_name": badge["badge_name"]},
                    "visibility": "friends",
                }
            ).execute()
            create_alert(
                user_id,
                "goals",
                "Badge earned",
                f"You earned the {badge['badge_name']} badge",
                "/achievements",
            )
            notify_badge_earned(user_id, badge["badge_name"])
    return awarded


def get_badge_progress(user_id: str) -> list[dict[str, Any]]:
    events = _fetch_recent_events(user_id, days=365)
    savings_total, co2_total = _compute_savings_and_co2(events)
    streak = _compute_streak(events)
    swaps = _count_swaps(user_id)
    wellness_avg = _compute_wellness_avg(user_id)
    existing = _existing_badges(user_id)
    results: list[dict[str, Any]] = []
    for badge in BADGE_DEFINITIONS:
        progress = _progress_for_metric(
            badge["metric"], savings_total, co2_total, swaps, streak, wellness_avg
        )
        earned = existing.get(badge["badge_name"])
        results.append(
            {
                "badge_type": badge["badge_type"],
                "badge_name": badge["badge_name"],
                "earned_at": earned.get("earned_at") if earned else None,
                "progress_current": round(progress, 2),
                "progress_target": badge["target"],
            }
        )
    return results
