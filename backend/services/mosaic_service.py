from datetime import date as date_type, datetime, timedelta
from typing import Any

from db.supabase import get_supabase_client

EVENTS_TABLE = "events"
MOVEMENT_TABLE = "movement_patterns"
ACTIVITY_TABLE = "activity_logs"


def _day_bounds(d: date_type) -> tuple[datetime, datetime]:
    start = datetime.combine(d, datetime.min.time())
    end = datetime.combine(d, datetime.max.time())
    return start, end


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def _color_for_score(score: float) -> str:
    if score >= 80:
        return "green"
    if score >= 50:
        return "yellow"
    return "red"


def _tile(name: str, score: float, detail: str) -> dict[str, Any]:
    clamped = max(0.0, min(100.0, score))
    return {
        "key": name,
        "name": name.replace("_", " ").title(),
        "score": round(clamped, 2),
        "color": _color_for_score(clamped),
        "detail": detail,
    }


def generate_daily_story(tiles: list[dict[str, Any]]) -> str:
    if not tiles:
        return "No activity data yet."
    scored = [tile for tile in tiles if isinstance(tile.get("score"), (int, float))]
    if not scored:
        return "No activity data yet."
    high = max(scored, key=lambda tile: tile["score"])
    low = min(scored, key=lambda tile: tile["score"])
    moderate_candidates = [
        tile for tile in scored if 50 <= float(tile["score"]) < 80 and tile["key"] not in {high["key"], low["key"]}
    ]
    if moderate_candidates:
        moderate = min(moderate_candidates, key=lambda tile: abs(float(tile["score"]) - 65.0))
    else:
        remaining = [tile for tile in scored if tile["key"] not in {high["key"], low["key"]}]
        moderate = remaining[0] if remaining else high

    def _label(tile: dict[str, Any]) -> str:
        score = float(tile["score"])
        if score >= 80:
            return "high"
        if score < 50:
            return "low"
        return "moderate"

    parts = [
        f"{_label(high)} {high['name'].lower()}",
        f"{_label(low)} {low['name'].lower()}",
        f"{_label(moderate)} {moderate['name'].lower()}",
    ]
    unique_parts = []
    for part in parts:
        if part not in unique_parts:
            unique_parts.append(part)
    if len(unique_parts) == 1:
        return unique_parts[0].capitalize() + "."
    if len(unique_parts) == 2:
        return f"{unique_parts[0].capitalize()} and {unique_parts[1]}."
    return f"{unique_parts[0].capitalize()}, {unique_parts[1]}, and {unique_parts[2]}."


def generate_daily_mosaic(user_id: str, date: date_type) -> dict[str, Any]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")

    start, end = _day_bounds(date)
    events_resp = (
        supabase.table(EVENTS_TABLE)
        .select("event_type,category,amount,metadata,scores,timestamp")
        .eq("user_id", user_id)
        .gte("timestamp", start.isoformat())
        .lte("timestamp", end.isoformat())
        .execute()
    )
    rows = events_resp.data or []

    movement_resp = (
        supabase.table(MOVEMENT_TABLE)
        .select("steps,active_minutes,workout_count,total_movement_score")
        .eq("user_id", user_id)
        .eq("date", date.isoformat())
        .maybe_single()
        .execute()
    )
    movement_row = movement_resp.data or {}

    activity_resp = (
        supabase.table(ACTIVITY_TABLE)
        .select("duration_minutes,activity_type,start_time,end_time")
        .eq("user_id", user_id)
        .eq("activity_type", "focus_session")
        .gte("start_time", start.isoformat())
        .lte("end_time", end.isoformat())
        .execute()
    )
    activity_rows = activity_resp.data or []

    sleep_hours = 0.0
    social_minutes = 0.0
    nutrition_scores: list[float] = []
    mood_scores: list[float] = []
    meds_count = 0
    selfcare_count = 0

    for row in rows:
        etype = (row.get("event_type") or "").lower()
        category = (row.get("category") or "").lower()
        amount = _safe_float(row.get("amount"))
        metadata = row.get("metadata") or {}
        scores = row.get("scores") or {}

        if etype == "sleep" and amount is not None:
            sleep_hours += max(0.0, amount)
        if etype == "social":
            minutes = _safe_float(metadata.get("duration_minutes")) or amount or 0.0
            if minutes > 0 and minutes <= 24:
                minutes *= 60.0
            social_minutes += minutes
        if etype == "food":
            quality = _safe_float(metadata.get("nutrition_quality_score"))
            if quality is None:
                quality = _safe_float(scores.get("wellness_impact"))
                if quality is not None and abs(quality) > 10:
                    quality = (quality + 100.0) / 2.0
                elif quality is not None:
                    quality = quality * 10.0
            if quality is not None:
                nutrition_scores.append(quality)
        if etype == "mood" and amount is not None:
            mood_scores.append(max(0.0, min(10.0, amount)) * 10.0)
        if etype == "meds":
            meds_count += 1
        if category == "selfcare" or etype in {"habit", "break"}:
            selfcare_count += 1

    focus_minutes = sum(_safe_float(row.get("duration_minutes")) or 0.0 for row in activity_rows)

    sleep_score = min(100.0, (sleep_hours / 8.0) * 100.0) if sleep_hours > 0 else 0.0
    movement_score = _safe_float(movement_row.get("total_movement_score")) or 0.0
    focus_score = min(100.0, (focus_minutes / 120.0) * 100.0) if focus_minutes > 0 else 0.0
    social_score = min(100.0, (social_minutes / 120.0) * 100.0) if social_minutes > 0 else 0.0
    nutrition_score = (
        min(100.0, sum(nutrition_scores) / len(nutrition_scores))
        if nutrition_scores
        else 0.0
    )
    meds_score = 90.0 if meds_count > 0 else 0.0
    selfcare_score = min(100.0, selfcare_count * 25.0) if selfcare_count > 0 else 0.0
    mood_score = min(100.0, sum(mood_scores) / len(mood_scores)) if mood_scores else 0.0

    tiles = [
        _tile("sleep", sleep_score, f"{sleep_hours:.1f}h"),
        _tile("movement", movement_score, f"{movement_row.get('active_minutes') or 0} min"),
        _tile("focus", focus_score, f"{int(round(focus_minutes))} min"),
        _tile("social", social_score, f"{int(round(social_minutes))} min"),
        _tile("nutrition", nutrition_score, f"{len(nutrition_scores)} meals"),
        _tile("meds", meds_score, f"{meds_count} entries"),
        _tile("selfcare", selfcare_score, f"{selfcare_count} entries"),
        _tile("mood", mood_score, f"{len(mood_scores)} logs"),
    ]

    overall_score = round(sum(tile["score"] for tile in tiles) / len(tiles), 2)
    story = generate_daily_story(tiles)

    return {
        "date": date.isoformat(),
        "overall_score": overall_score,
        "story": story,
        "tiles": tiles,
    }


def generate_week_mosaic(user_id: str, start_date: date_type) -> list[dict[str, Any]]:
    return [
        generate_daily_mosaic(user_id, start_date + timedelta(days=offset)) for offset in range(7)
    ]
