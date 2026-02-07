from datetime import datetime, timedelta, date as date_type
from typing import Any, Dict, List

from db.supabase import get_supabase_client

EVENTS_TABLE = "events"
SCORES_TABLE = "score_snapshots"


def _parse_dt(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


def _day_key(dt: datetime) -> str:
    return datetime(dt.year, dt.month, dt.day).date().isoformat()


def _week_start(day: date_type) -> date_type:
    offset = (day.weekday() + 1) % 7
    return day - timedelta(days=offset)


def _safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def _pearson(x: List[float], y: List[float]) -> float:
    n = min(len(x), len(y))
    if n == 0:
        return 0.0
    xs = x[:n]
    ys = y[:n]
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    num = sum((a - mean_x) * (b - mean_y) for a, b in zip(xs, ys))
    den_x = sum((a - mean_x) ** 2 for a in xs)
    den_y = sum((b - mean_y) ** 2 for b in ys)
    den = (den_x * den_y) ** 0.5
    if den == 0:
        return 0.0
    corr = num / den
    if corr > 1:
        corr = 1.0
    if corr < -1:
        corr = -1.0
    return round(corr, 2)


def _fetch_events(user_id: str, start: datetime, end: datetime) -> List[Dict[str, Any]]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    resp = (
        supabase.table(EVENTS_TABLE)
        .select("event_type,category,amount,metadata,timestamp,title")
        .eq("user_id", user_id)
        .gte("timestamp", start.isoformat())
        .lte("timestamp", end.isoformat())
        .order("timestamp", desc=False)
        .execute()
    )
    return resp.data or []


def _fetch_scores(user_id: str, start_day: date_type, end_day: date_type) -> Dict[str, Dict[str, float]]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    resp = (
        supabase.table(SCORES_TABLE)
        .select("date,wallet_score,wellness_score,sustainability_score,movement_score")
        .eq("user_id", user_id)
        .gte("date", start_day.isoformat())
        .lte("date", end_day.isoformat())
        .order("date", desc=False)
        .execute()
    )
    rows = resp.data or []
    return {str(row.get("date")): row for row in rows if row.get("date")}


def _is_meal_prep_event(event: Dict[str, Any]) -> bool:
    etype = (event.get("event_type") or "").lower()
    category = (event.get("category") or "").lower()
    if etype == "habit" and category == "meal_prep":
        return True
    title = str(event.get("title") or "").lower()
    metadata = event.get("metadata") or {}
    if "meal prep" in title or "mealprep" in title or "meal-prep" in title:
        return True
    return bool(metadata.get("meal_prep"))


def detect_correlations(user_id: str, lookback_days: int = 30) -> List[Dict[str, Any]]:
    end = datetime.utcnow()
    start = end - timedelta(days=max(1, lookback_days))
    events = _fetch_events(user_id, start, end)
    late_eating_days: Dict[str, int] = {}
    mood_by_week: Dict[str, List[float]] = {}
    monday_workouts: Dict[str, int] = {}
    weekly_spending: Dict[str, float] = {}
    meal_prep_weeks: Dict[str, int] = {}
    for ev in events:
        ts = _parse_dt(ev.get("timestamp"))
        if ts is None:
            continue
        day_key = _day_key(ts)
        week_key = _week_start(ts.date()).isoformat()
        etype = (ev.get("event_type") or "").lower()
        amount = _safe_float(ev.get("amount")) or 0.0
        if etype == "food" and ts.hour >= 21:
            late_eating_days[day_key] = 1
        if etype == "mood":
            mood_by_week.setdefault(week_key, []).append(amount)
        if etype == "movement" and ts.weekday() == 0:
            monday_workouts[week_key] = 1
        if etype == "spending":
            weekly_spending[week_key] = weekly_spending.get(week_key, 0.0) + abs(amount)
        if _is_meal_prep_event(ev) and ts.weekday() == 6:
            meal_prep_weeks[week_key] = 1
    score_map = _fetch_scores(user_id, start.date(), end.date())
    days_sorted = sorted(score_map.keys())
    def next_day_seq(indicator: Dict[str, int]) -> tuple[List[float], List[float]]:
        x_seq: List[float] = []
        y_seq: List[float] = []
        for day in days_sorted:
            next_dt = datetime.fromisoformat(day) + timedelta(days=1)
            next_key = next_dt.date().isoformat()
            next_row = score_map.get(next_key)
            if next_row is None:
                continue
            x_seq.append(float(indicator.get(day, 0)))
            y_seq.append(float(next_row.get("wellness_score") or 0.0))
        return x_seq, y_seq
    insights: List[Dict[str, Any]] = []
    x_late, y_next = next_day_seq(late_eating_days)
    corr_late = _pearson(x_late, y_next)
    if abs(corr_late) >= 0.5 and x_late and y_next:
        with_late = [y for x, y in zip(x_late, y_next) if x > 0.5]
        without_late = [y for x, y in zip(x_late, y_next) if x <= 0.5]
        avg_with = round(sum(with_late) / max(1, len(with_late)), 2) if with_late else 0.0
        avg_without = round(sum(without_late) / max(1, len(without_late)), 2) if without_late else 0.0
        impact = round(avg_with - avg_without, 2)
        insights.append({
            "pattern": "Late-night eating (after 9pm)",
            "frequency": int(sum(1 for v in late_eating_days.values() if v)),
            "impact_metric": "wellness_score",
            "impact_value": impact,
            "impact_description": f"Wellness {'drops' if impact < 0 else 'rises'} {abs(int(impact))} pts next day",
            "confidence": round(abs(corr_late), 2),
            "recommendation": "Move dinner to 7–8pm window",
        })
    week_keys = sorted(set(mood_by_week.keys()) | set(monday_workouts.keys()))
    x_monday: List[float] = []
    y_mood: List[float] = []
    for week in week_keys:
        moods = mood_by_week.get(week, [])
        if not moods:
            continue
        avg_mood = sum(moods) / max(1, len(moods))
        x_monday.append(1.0 if monday_workouts.get(week) else 0.0)
        y_mood.append(avg_mood)
    corr_monday = _pearson(x_monday, y_mood)
    if abs(corr_monday) >= 0.5 and x_monday and y_mood:
        with_workout = [y for x, y in zip(x_monday, y_mood) if x > 0.5]
        without_workout = [y for x, y in zip(x_monday, y_mood) if x <= 0.5]
        avg_with = sum(with_workout) / max(1, len(with_workout)) if with_workout else 0.0
        avg_without = sum(without_workout) / max(1, len(without_workout)) if without_workout else 0.0
        change_pct = 0.0
        if avg_with:
            change_pct = round(((avg_without - avg_with) / avg_with) * 100.0, 1)
        insights.append({
            "pattern": "Skipping workouts on Mondays",
            "frequency": int(sum(1 for v in x_monday if v <= 0.5)),
            "impact_metric": "mood_score",
            "impact_value": change_pct,
            "impact_description": f"Mood dips {abs(change_pct)}% that week",
            "confidence": round(abs(corr_monday), 2),
            "recommendation": "Schedule a short Monday workout to stabilize mood",
        })
    week_spend_keys = sorted(set(weekly_spending.keys()) | set(meal_prep_weeks.keys()))
    x_prep: List[float] = []
    y_spend: List[float] = []
    for week in week_spend_keys:
        if week not in weekly_spending:
            continue
        x_prep.append(1.0 if meal_prep_weeks.get(week) else 0.0)
        y_spend.append(float(weekly_spending.get(week, 0.0)))
    corr_prep = _pearson(x_prep, y_spend)
    if abs(corr_prep) >= 0.5 and x_prep and y_spend:
        with_prep = [y for x, y in zip(x_prep, y_spend) if x > 0.5]
        without_prep = [y for x, y in zip(x_prep, y_spend) if x <= 0.5]
        avg_with = sum(with_prep) / max(1, len(with_prep)) if with_prep else 0.0
        avg_without = sum(without_prep) / max(1, len(without_prep)) if without_prep else 0.0
        savings = round(avg_without - avg_with, 2)
        insights.append({
            "pattern": "Meal prep Sundays",
            "frequency": int(sum(1 for v in x_prep if v > 0.5)),
            "impact_metric": "spending",
            "impact_value": savings,
            "impact_description": f"Save ${abs(savings):.0f}/week",
            "confidence": round(abs(corr_prep), 2),
            "recommendation": "Plan two batch meals on Sunday afternoon",
        })
    insights.sort(key=lambda item: abs(float(item.get("impact_value") or 0.0)), reverse=True)
    return insights


def identify_triggers(user_id: str, negative_pattern: str, lookback_days: int = 30) -> Dict[str, Any]:
    end = datetime.utcnow()
    start = end - timedelta(days=max(1, lookback_days))
    events = _fetch_events(user_id, start, end)
    pattern = (negative_pattern or "").lower()
    targets: List[Dict[str, Any]] = []
    if "overspending" in pattern:
        spending_values = [abs(_safe_float(ev.get("amount")) or 0.0) for ev in events if (ev.get("event_type") or "").lower() == "spending"]
        threshold = (sum(spending_values) / max(1, len(spending_values))) * 1.2 if spending_values else 0.0
        for ev in events:
            if (ev.get("event_type") or "").lower() != "spending":
                continue
            amount = abs(_safe_float(ev.get("amount")) or 0.0)
            category = (ev.get("category") or "").lower()
            if amount >= threshold and ("food" in category or "grocer" in category or "restaurant" in category):
                targets.append(ev)
    elif "skipped" in pattern:
        day_events: Dict[str, List[Dict[str, Any]]] = {}
        for ev in events:
            ts = _parse_dt(ev.get("timestamp"))
            if ts is None:
                continue
            day_events.setdefault(_day_key(ts), []).append(ev)
        current = start.date()
        while current <= end.date():
            day_key = current.isoformat()
            day_rows = day_events.get(day_key, [])
            has_movement = any((row.get("event_type") or "").lower() == "movement" for row in day_rows)
            if not has_movement:
                targets.extend(day_rows)
            current += timedelta(days=1)
    elif "poor food" in pattern:
        for ev in events:
            if (ev.get("event_type") or "").lower() != "food":
                continue
            metadata = ev.get("metadata") or {}
            quality = _safe_float(metadata.get("nutrition_quality_score"))
            if quality is not None and quality <= 4:
                targets.append(ev)
    elif "low mood" in pattern:
        for ev in events:
            if (ev.get("event_type") or "").lower() != "mood":
                continue
            score = _safe_float(ev.get("amount"))
            if score is not None and score <= 4:
                targets.append(ev)
    else:
        targets = events
    total_events = max(1, len(targets))
    trigger_counts: Dict[str, List[float]] = {}
    trigger_types: Dict[str, str] = {}
    for ev in targets:
        ts = _parse_dt(ev.get("timestamp"))
        if ts is None:
            continue
        amount = abs(_safe_float(ev.get("amount")) or 0.0)
        dow = ts.strftime("%A")
        tod = "morning" if ts.hour < 12 else ("afternoon" if ts.hour < 17 else "evening")
        key = f"time::{dow} {tod}"
        trigger_counts.setdefault(key, []).append(amount)
        trigger_types[key] = "time"
        metadata = ev.get("metadata") or {}
        location = metadata.get("location")
        if location:
            key = f"location::{location}"
            trigger_counts.setdefault(key, []).append(amount)
            trigger_types[key] = "location"
        mood = metadata.get("mood")
        if mood:
            key = f"mood::{mood}"
            trigger_counts.setdefault(key, []).append(amount)
            trigger_types[key] = "mood"
        social = metadata.get("social_context")
        if social:
            key = f"social::{social}"
            trigger_counts.setdefault(key, []).append(amount)
            trigger_types[key] = "social"
    triggers: List[Dict[str, Any]] = []
    for key, amounts in trigger_counts.items():
        ttype, value = key.split("::", 1)
        occurrence_rate = round(len(amounts) / total_events, 2)
        impact_value = round(sum(amounts) / max(1, len(amounts)), 2)
        triggers.append({
            "type": ttype,
            "value": value,
            "occurrence_rate": occurrence_rate,
            "impact_metric": "avg_overspend" if "overspending" in pattern else "avg_impact",
            "impact_value": impact_value,
        })
    triggers.sort(key=lambda t: t.get("occurrence_rate", 0), reverse=True)
    if "overspending" in pattern:
        recommendations = [
            "Plan Friday meals ahead",
            "Set a budget for evening outings",
            "Keep healthy snacks ready to avoid impulse buys",
        ]
    elif "skipped" in pattern:
        recommendations = [
            "Schedule workouts earlier in the day",
            "Lay out gear the night before",
            "Use a buddy system for accountability",
        ]
    elif "poor food" in pattern:
        recommendations = ["Keep healthy snacks prepped", "Swap fast food with simple home meals"]
    else:
        recommendations = ["Plan a gentle reset routine", "Check in with mood before decisions"]
    return {"negative_pattern": negative_pattern, "triggers": triggers, "recommendations": recommendations}


def generate_insight_notifications(user_id: str) -> List[Dict[str, Any]]:
    end = datetime.utcnow()
    start = end - timedelta(days=14)
    events = _fetch_events(user_id, start, end)
    scores = _fetch_scores(user_id, start.date(), end.date())
    notifications: List[Dict[str, Any]] = []
    weekend_spend: Dict[str, float] = {}
    daily_spend: Dict[str, float] = {}
    movement_days: Dict[str, int] = {}
    mood_by_day: Dict[str, List[float]] = {}
    for ev in events:
        ts = _parse_dt(ev.get("timestamp"))
        if ts is None:
            continue
        etype = (ev.get("event_type") or "").lower()
        day_key = _day_key(ts)
        if etype == "spending":
            amount = abs(_safe_float(ev.get("amount")) or 0.0)
            daily_spend[day_key] = daily_spend.get(day_key, 0.0) + amount
            if ts.weekday() >= 5:
                week_key = _week_start(ts.date()).isoformat()
                weekend_spend[week_key] = weekend_spend.get(week_key, 0.0) + amount
        if etype == "movement":
            movement_days[day_key] = 1
        if etype == "mood":
            mood_by_day.setdefault(day_key, []).append(_safe_float(ev.get("amount")) or 0.0)
    weekend_keys = sorted(weekend_spend.keys())
    if len(weekend_keys) >= 2:
        last_total = weekend_spend.get(weekend_keys[-1], 0.0)
        prev_total = weekend_spend.get(weekend_keys[-2], 0.0)
        if prev_total > 0:
            change = (last_total - prev_total) / prev_total
            if change >= 0.2:
                severity = "high" if change >= 0.35 else "medium"
                notifications.append({
                    "type": "spending",
                    "title": "Weekend spending up",
                    "message": f"Weekend spending up {round(change * 100)}% (${last_total:.0f})",
                    "severity": severity,
                    "action": "Review spending",
                    "link": "/analytics",
                })
    if daily_spend:
        avg_daily = sum(daily_spend.values()) / max(1, len(daily_spend))
        latest_day = max(daily_spend.keys())
        latest_total = daily_spend.get(latest_day, 0.0)
        if avg_daily > 0 and latest_total >= avg_daily * 1.4:
            notifications.append({
                "type": "spending",
                "title": "Daily spend spike",
                "message": f"Spending hit ${latest_total:.0f} on {latest_day}",
                "severity": "medium",
                "action": "Set a cap",
                "link": "/settings/profile",
            })
    sorted_days = sorted(movement_days.keys())
    streak = 0
    streak_start = None
    if sorted_days:
        prev = datetime.fromisoformat(sorted_days[-1]).date()
        streak = 1
        streak_start = prev
        for key in reversed(sorted_days[:-1]):
            current = datetime.fromisoformat(key).date()
            if (prev - current).days == 1:
                streak += 1
                streak_start = current
                prev = current
            else:
                break
    recent_scores = list(scores.items())[-7:]
    previous_scores = list(scores.items())[-14:-7]
    if streak >= 3 and recent_scores and previous_scores:
        recent_mood = [
            _safe_float(item[1].get("wellness_score")) or 0.0 for item in recent_scores
        ]
        prev_mood = [_safe_float(item[1].get("wellness_score")) or 0.0 for item in previous_scores]
        recent_avg = sum(recent_mood) / max(1, len(recent_mood))
        prev_avg = sum(prev_mood) / max(1, len(prev_mood))
        if prev_avg > 0 and recent_avg > prev_avg:
            improvement = round(((recent_avg - prev_avg) / prev_avg) * 100.0)
            notifications.append({
                "type": "movement",
                "title": "Walking streak improving mood",
                "message": f"{streak}-day streak with wellness up {improvement}%",
                "severity": "low",
                "action": "Keep it going",
                "link": "/insights",
            })
    notifications.sort(
        key=lambda item: {"high": 0, "medium": 1, "low": 2}.get(item.get("severity"), 3)
    )
    return notifications


def detect_positive_patterns(user_id: str, days: int = 30) -> List[Dict[str, Any]]:
    end = datetime.utcnow()
    start = end - timedelta(days=max(1, days))
    events = _fetch_events(user_id, start, end)
    scores = _fetch_scores(user_id, start.date(), end.date())
    weekly_spending: Dict[str, float] = {}
    meal_prep_weeks: Dict[str, int] = {}
    movement_days: Dict[str, int] = {}
    for ev in events:
        ts = _parse_dt(ev.get("timestamp"))
        if ts is None:
            continue
        week_key = _week_start(ts.date()).isoformat()
        etype = (ev.get("event_type") or "").lower()
        if etype == "spending":
            amount = abs(_safe_float(ev.get("amount")) or 0.0)
            weekly_spending[week_key] = weekly_spending.get(week_key, 0.0) + amount
        if _is_meal_prep_event(ev) and ts.weekday() == 6:
            meal_prep_weeks[week_key] = 1
        if etype == "movement":
            movement_days[_day_key(ts)] = 1
    patterns: List[Dict[str, Any]] = []
    week_keys = sorted(set(weekly_spending.keys()) | set(meal_prep_weeks.keys()))
    x_prep: List[float] = []
    y_spend: List[float] = []
    for week in week_keys:
        if week not in weekly_spending:
            continue
        x_prep.append(1.0 if meal_prep_weeks.get(week) else 0.0)
        y_spend.append(float(weekly_spending.get(week, 0.0)))
    if x_prep and y_spend:
        with_prep = [y for x, y in zip(x_prep, y_spend) if x > 0.5]
        without_prep = [y for x, y in zip(x_prep, y_spend) if x <= 0.5]
        avg_with = sum(with_prep) / max(1, len(with_prep)) if with_prep else 0.0
        avg_without = sum(without_prep) / max(1, len(without_prep)) if without_prep else 0.0
        savings = round(avg_without - avg_with, 2)
        if savings > 0 and sum(x_prep) >= 2:
            streak = 0
            streak_start = None
            for week in reversed(week_keys):
                if meal_prep_weeks.get(week):
                    streak += 1
                    streak_start = week
                else:
                    break
            patterns.append({
                "pattern": "Sunday meal prep",
                "started_date": streak_start or week_keys[-1],
                "improvement": f"Save ${abs(savings):.0f}/week",
                "streak": streak,
                "message": "Meal prep weeks reduced food spending.",
                "encouragement": "Keep the prep streak alive.",
            })
    sorted_days = sorted(movement_days.keys())
    streak = 0
    streak_start = None
    if sorted_days:
        prev = datetime.fromisoformat(sorted_days[-1]).date()
        streak = 1
        streak_start = prev
        for key in reversed(sorted_days[:-1]):
            current = datetime.fromisoformat(key).date()
            if (prev - current).days == 1:
                streak += 1
                streak_start = current
                prev = current
            else:
                break
    score_items = list(scores.items())
    recent_scores = score_items[-7:]
    previous_scores = score_items[-14:-7]
    if streak >= 3 and recent_scores and previous_scores:
        recent_avg = sum(_safe_float(item[1].get("wellness_score")) or 0.0 for item in recent_scores) / max(1, len(recent_scores))
        prev_avg = sum(_safe_float(item[1].get("wellness_score")) or 0.0 for item in previous_scores) / max(1, len(previous_scores))
        if prev_avg > 0 and recent_avg > prev_avg:
            improvement = round(((recent_avg - prev_avg) / prev_avg) * 100.0)
            patterns.append({
                "pattern": "Daily movement streak",
                "started_date": streak_start.isoformat() if streak_start else recent_scores[0][0],
                "improvement": f"Wellness +{improvement}%",
                "streak": streak,
                "message": f"Movement streak lifted wellness by {improvement}%.",
                "encouragement": "Stay steady and keep moving.",
            })
    patterns.sort(key=lambda item: int(item.get("streak") or 0), reverse=True)
    return patterns
