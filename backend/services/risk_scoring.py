from datetime import datetime, timedelta, date as date_type
from typing import Any

from db.supabase import get_supabase_client

EVENTS_TABLE = "events"
ACTIVITY_TABLE = "activity_logs"
MOVEMENT_PATTERN_TABLE = "movement_patterns"
MOVEMENT_TESTS_TABLE = "movement_tests"
MOVEMENT_TEST_INSIGHTS_TABLE = "movement_test_insights"
RISK_HISTORY_TABLE = "risk_history"


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def _parse_ts(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


def _risk_level(score: float) -> str:
    if score > 70:
        return "high"
    if score >= 41:
        return "medium"
    return "low"


def calculate_burnout_risk(user_id: str, days: int = 7) -> dict[str, Any]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    window_days = max(1, int(days))
    end = datetime.utcnow()
    start = end - timedelta(days=window_days - 1)
    dates = [start.date() + timedelta(days=offset) for offset in range(window_days)]
    daily = {
        day: {
            "sleep_hours": 0.0,
            "mood_values": [],
            "focus_minutes": 0.0,
            "breaks": 0,
            "late_night": False,
        }
        for day in dates
    }

    events_resp = (
        supabase.table(EVENTS_TABLE)
        .select("event_type,amount,metadata,timestamp")
        .eq("user_id", user_id)
        .gte("timestamp", start.isoformat())
        .lte("timestamp", end.isoformat())
        .execute()
    )
    rows = events_resp.data or []
    for row in rows:
        ts = _parse_ts(row.get("timestamp"))
        if ts is None:
            continue
        day = ts.date()
        if day not in daily:
            continue
        event_type = (row.get("event_type") or "").lower()
        amount = _safe_float(row.get("amount"))
        metadata = row.get("metadata") or {}
        if event_type == "sleep":
            hours = amount
            if hours is None:
                hours = _safe_float(metadata.get("hours"))
            if hours is not None and hours > 0:
                daily[day]["sleep_hours"] += min(24.0, hours)
        if event_type == "mood" and amount is not None:
            daily[day]["mood_values"].append(max(0.0, min(10.0, amount)))
        if event_type == "break" or (
            event_type == "habit" and str(metadata.get("type", "")).lower() == "break"
        ):
            daily[day]["breaks"] += 1
        if ts.hour >= 23 or ts.hour < 5:
            daily[day]["late_night"] = True

    activity_resp = (
        supabase.table(ACTIVITY_TABLE)
        .select("duration_minutes,start_time,end_time,activity_type")
        .eq("user_id", user_id)
        .eq("activity_type", "focus_session")
        .gte("start_time", start.isoformat())
        .lte("end_time", end.isoformat())
        .execute()
    )
    activity_rows = activity_resp.data or []
    for row in activity_rows:
        ts = _parse_ts(row.get("start_time")) or _parse_ts(row.get("end_time"))
        if ts is None:
            continue
        day = ts.date()
        if day not in daily:
            continue
        minutes = _safe_float(row.get("duration_minutes")) or 0.0
        daily[day]["focus_minutes"] += max(0.0, minutes)

    sleep_deficit_hours = 0.0
    sleep_days = 0
    total_sleep = 0.0
    focus_long_days = []
    mood_low_days = []
    late_night_days = []
    no_break_days = []

    for day, data in daily.items():
        sleep_hours = data["sleep_hours"]
        if sleep_hours > 0:
            sleep_days += 1
            total_sleep += sleep_hours
            if sleep_hours < 7:
                sleep_deficit_hours += 7.0 - sleep_hours
        if data["focus_minutes"] > 180:
            focus_long_days.append(day)
        if data["mood_values"]:
            average_mood = sum(data["mood_values"]) / len(data["mood_values"])
            if average_mood < 5:
                mood_low_days.append(day)
        if data["late_night"]:
            late_night_days.append(day)
        if data["breaks"] < 2:
            no_break_days.append(day)

    avg_sleep = total_sleep / sleep_days if sleep_days > 0 else None
    avg_mood = None
    if mood_low_days:
        mood_values = []
        for day in mood_low_days:
            mood_values.extend(daily[day]["mood_values"])
        if mood_values:
            avg_mood = sum(mood_values) / len(mood_values)

    factor_values = [
        (
            "Sleep deficit",
            sleep_deficit_hours * 20.0,
            f"Average {avg_sleep:.1f}h/night, need 7-8h. Missing {sleep_deficit_hours:.1f}h/night."
            if avg_sleep is not None
            else "No sleep logs available.",
        ),
        (
            "Prolonged focus",
            len(focus_long_days) * 15.0,
            f"{len(focus_long_days)} days over 3h focus sessions.",
        ),
        (
            "Negative mood",
            len(mood_low_days) * 10.0,
            f"Average mood {avg_mood:.1f}/10 on {len(mood_low_days)} days."
            if avg_mood is not None
            else "Mood logged below 5.",
        ),
        (
            "Late nights",
            len(late_night_days) * 10.0,
            f"{len(late_night_days)} nights with activity after 11pm.",
        ),
        (
            "Low breaks",
            len(no_break_days) * 10.0,
            f"{len(no_break_days)} days with fewer than 2 breaks.",
        ),
    ]

    factors = [
        {"name": name, "impact": round(impact, 2), "details": detail}
        for name, impact, detail in factor_values
        if impact > 0
    ]
    factors.sort(key=lambda item: item["impact"], reverse=True)
    factors = factors[:3]

    risk_score = round(min(100.0, sum(item["impact"] for item in factors)), 2)
    level = _risk_level(risk_score)

    recommendations: list[str] = []
    if sleep_deficit_hours > 0:
        recommendations.append("Aim for 7-8 hours of sleep each night.")
    if focus_long_days:
        recommendations.append("Plan a recovery break after 90-120 minutes of focus.")
    if mood_low_days:
        recommendations.append("Add a quick mood reset: stretch, hydrate, or brief walk.")
    if late_night_days:
        recommendations.append("Set a cutoff for work screens before 11pm.")
    if no_break_days:
        recommendations.append("Log at least two short breaks per day.")

    return {
        "days": window_days,
        "risk": risk_score,
        "level": level,
        "factors": factors,
        "recommendations": recommendations,
    }


def calculate_injury_risk(user_id: str, days: int = 7) -> dict[str, Any]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    window_days = max(1, int(days))
    end = datetime.utcnow()
    start = end - timedelta(days=window_days - 1)

    events_resp = (
        supabase.table(EVENTS_TABLE)
        .select("event_type,category,title,metadata,timestamp,amount")
        .eq("user_id", user_id)
        .gte("timestamp", start.isoformat())
        .lte("timestamp", end.isoformat())
        .execute()
    )
    rows = events_resp.data or []

    rehab_events = 0
    pain_events = 0

    for row in rows:
        event_type = (row.get("event_type") or "").lower()
        title = (row.get("title") or "").lower()
        metadata = row.get("metadata") or {}
        meta_type = str(metadata.get("type") or "").lower()
        rehab_hit = event_type == "habit" and meta_type in {"rehab", "pt", "physio", "therapy"}
        rehab_hit = rehab_hit or any(key in title for key in ["rehab", "pt", "physio", "therapy"])
        if rehab_hit:
            rehab_events += 1

        pain_level = _safe_float(metadata.get("pain_level") or metadata.get("pain_score"))
        pain_hit = event_type in {"pain", "injury"} or pain_level is not None or "pain" in title
        if pain_hit:
            pain_events += 1

    movement_resp = (
        supabase.table(MOVEMENT_PATTERN_TABLE)
        .select("date,active_minutes")
        .eq("user_id", user_id)
        .gte("date", (start - timedelta(days=window_days)).date().isoformat())
        .lte("date", end.date().isoformat())
        .execute()
    )
    movement_rows = movement_resp.data or []
    current_total = 0.0
    previous_total = 0.0
    current_count = 0
    previous_count = 0

    for row in movement_rows:
        date_val = row.get("date")
        try:
            day = date_type.fromisoformat(str(date_val))
        except Exception:
            continue
        minutes = _safe_float(row.get("active_minutes")) or 0.0
        if day >= start.date():
            current_total += minutes
            current_count += 1
        elif day >= (start - timedelta(days=window_days)).date():
            previous_total += minutes
            previous_count += 1

    current_avg = current_total / float(max(1, current_count))
    previous_avg = previous_total / float(max(1, previous_count))
    spike = False
    if previous_avg > 0:
        spike = current_avg > previous_avg * 1.5
    elif current_avg >= 30:
        spike = True

    tests_resp = (
        supabase.table(MOVEMENT_TESTS_TABLE)
        .select("id,created_at, movement_test_insights(form_score)")
        .eq("user_id", user_id)
        .gte("created_at", start.isoformat())
        .lte("created_at", end.isoformat())
        .execute()
    )
    tests = tests_resp.data or []
    poor_form = 0
    for test in tests:
        insights = test.get("movement_test_insights") or []
        insight = insights[0] if isinstance(insights, list) and insights else None
        form_score = _safe_float((insight or {}).get("form_score"))
        if form_score is not None and form_score < 60:
            poor_form += 1

    factor_values = [
        (
            "Skipped rehab/PT",
            25.0 if rehab_events == 0 else 0.0,
            f"No rehab/PT sessions logged in {window_days} days.",
        ),
        (
            "Activity spike",
            20.0 if spike else 0.0,
            f"Avg active minutes {current_avg:.0f} vs {previous_avg:.0f} (+50%).",
        ),
        (
            "Reported pain",
            pain_events * 15.0,
            f"{pain_events} pain-related logs recorded.",
        ),
        (
            "Poor form",
            poor_form * 10.0,
            f"{poor_form} tests under form score 60.",
        ),
    ]
    factors = [
        {"name": name, "impact": round(impact, 2), "details": detail}
        for name, impact, detail in factor_values
        if impact > 0
    ]
    factors.sort(key=lambda item: item["impact"], reverse=True)
    factors = factors[:3]

    risk_score = round(min(100.0, sum(item["impact"] for item in factors)), 2)
    return {
        "days": window_days,
        "risk": risk_score,
        "level": _risk_level(risk_score),
        "factors": factors,
        "recommendations": ["Gradual increase only", "Rest day needed", "See PT"],
    }


def calculate_isolation_risk(user_id: str, days: int = 7) -> dict[str, Any]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    window_days = max(1, int(days))
    end = datetime.utcnow()
    start = end - timedelta(days=window_days - 1)
    previous_start = start - timedelta(days=window_days)

    events_resp = (
        supabase.table(EVENTS_TABLE)
        .select("event_type,title,metadata,timestamp,amount")
        .eq("user_id", user_id)
        .gte("timestamp", previous_start.isoformat())
        .lte("timestamp", end.isoformat())
        .execute()
    )
    rows = events_resp.data or []
    social_count = 0
    group_count = 0
    mood_values: list[float] = []
    current_events = 0
    previous_events = 0

    for row in rows:
        ts = _parse_ts(row.get("timestamp"))
        if ts is None:
            continue
        event_type = (row.get("event_type") or "").lower()
        title = (row.get("title") or "").lower()
        metadata = row.get("metadata") or {}
        in_current = ts.date() >= start.date()
        if in_current:
            current_events += 1
        else:
            previous_events += 1

        if in_current and event_type == "social":
            social_count += 1
            meta_type = str(metadata.get("type") or "").lower()
            is_group = metadata.get("group") is True
            if is_group or meta_type in {"group", "team", "class", "meetup"}:
                group_count += 1
            if any(key in title for key in ["group", "team", "class", "meetup"]):
                group_count += 1

        if in_current and event_type == "mood":
            amount = _safe_float(row.get("amount"))
            if amount is not None:
                mood_values.append(max(0.0, min(10.0, amount)))

    social_target = (3.0 / 7.0) * window_days
    low_social = social_count < social_target
    avg_mood = sum(mood_values) / len(mood_values) if mood_values else None
    low_mood = avg_mood is not None and avg_mood < 5
    reduced_comm = previous_events > 0 and current_events < previous_events * 0.8
    no_group = group_count == 0

    factor_values = [
        (
            "Low social interactions",
            30.0 if low_social else 0.0,
            f"{social_count} social events logged, target {social_target:.1f}.",
        ),
        (
            "Flat/negative mood",
            20.0 if low_mood else 0.0,
            f"Average mood {avg_mood:.1f}/10." if avg_mood is not None else "No mood logs this window.",
        ),
        (
            "Reduced communication",
            15.0 if reduced_comm else 0.0,
            f"{current_events} events vs {previous_events} in prior window.",
        ),
        (
            "No group activities",
            10.0 if no_group else 0.0,
            "No group activities logged.",
        ),
    ]
    factors = [
        {"name": name, "impact": round(impact, 2), "details": detail}
        for name, impact, detail in factor_values
        if impact > 0
    ]
    factors.sort(key=lambda item: item["impact"], reverse=True)
    factors = factors[:3]

    risk_score = round(min(100.0, sum(item["impact"] for item in factors)), 2)
    return {
        "days": window_days,
        "risk": risk_score,
        "level": _risk_level(risk_score),
        "factors": factors,
        "recommendations": ["Schedule social event", "Call a friend", "Join group activity"],
    }


def calculate_financial_risk(user_id: str, days: int = 30) -> dict[str, Any]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    window_days = max(1, int(days))
    end = datetime.utcnow()
    start = end - timedelta(days=window_days - 1)

    events_resp = (
        supabase.table(EVENTS_TABLE)
        .select("event_type,category,title,metadata,timestamp,amount")
        .eq("user_id", user_id)
        .gte("timestamp", start.isoformat())
        .lte("timestamp", end.isoformat())
        .execute()
    )
    rows = events_resp.data or []

    spending_total = 0.0
    income_total = 0.0
    recurring_count = 0
    net_by_day: dict[date_type, float] = {}
    latest_balance = None
    latest_balance_ts = None

    for row in rows:
        ts = _parse_ts(row.get("timestamp"))
        if ts is None:
            continue
        day = ts.date()
        event_type = (row.get("event_type") or "").lower()
        category = (row.get("category") or "").lower()
        amount = _safe_float(row.get("amount")) or 0.0
        metadata = row.get("metadata") or {}

        current_balance = _safe_float(metadata.get("current_balance"))
        if current_balance is not None:
            if latest_balance_ts is None or ts > latest_balance_ts:
                latest_balance_ts = ts
                latest_balance = current_balance

        if event_type == "spending":
            spending_total += abs(amount)
            net_by_day[day] = net_by_day.get(day, 0.0) - abs(amount)
            if metadata.get("recurring") or metadata.get("is_recurring"):
                recurring_count += 1
        if category == "finance" or event_type == "income":
            income_total += amount
            net_by_day[day] = net_by_day.get(day, 0.0) + amount

    if latest_balance is None:
        latest_balance = sum(net_by_day.values())

    month_spend = (spending_total / float(window_days)) * 30.0
    spending_velocity = spending_total > income_total
    emergency_low = latest_balance < month_spend if month_spend > 0 else False

    dates = sorted(net_by_day.keys())
    halfway = max(1, len(dates) // 2)
    first_half = sum(net_by_day[d] for d in dates[:halfway])
    second_half = sum(net_by_day[d] for d in dates[halfway:])
    debt_trend = second_half < first_half and second_half < 0

    factor_values = [
        (
            "Spending velocity",
            40.0 if spending_velocity else 0.0,
            f"Spent {spending_total:.2f} vs earned {income_total:.2f}.",
        ),
        (
            "Recurring expenses",
            20.0 if recurring_count >= 3 else 0.0,
            f"{recurring_count} recurring expenses logged.",
        ),
        (
            "Emergency fund low",
            30.0 if emergency_low else 0.0,
            f"Balance {latest_balance:.2f} vs monthly spend {month_spend:.2f}.",
        ),
        (
            "Increasing debt trend",
            20.0 if debt_trend else 0.0,
            f"Net trend {second_half:.2f} vs {first_half:.2f}.",
        ),
    ]
    factors = [
        {"name": name, "impact": round(impact, 2), "details": detail}
        for name, impact, detail in factor_values
        if impact > 0
    ]
    factors.sort(key=lambda item: item["impact"], reverse=True)
    factors = factors[:3]

    risk_score = round(min(100.0, sum(item["impact"] for item in factors)), 2)
    return {
        "days": window_days,
        "risk": risk_score,
        "level": _risk_level(risk_score),
        "factors": factors,
        "recommendations": ["Review subscriptions", "Set spending limit", "Build emergency fund"],
    }


def save_risk_snapshot(user_id: str, target_date: date_type | None = None) -> dict[str, Any]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    day = target_date or datetime.utcnow().date()
    burnout = calculate_burnout_risk(user_id, 7)
    injury = calculate_injury_risk(user_id, 7)
    isolation = calculate_isolation_risk(user_id, 7)
    financial = calculate_financial_risk(user_id, 30)
    payload = {
        "user_id": user_id,
        "date": day.isoformat(),
        "burnout_risk": burnout["risk"],
        "injury_risk": injury["risk"],
        "isolation_risk": isolation["risk"],
        "financial_risk": financial["risk"],
        "created_at": datetime.utcnow().isoformat(),
    }
    response = (
        supabase.table(RISK_HISTORY_TABLE)
        .upsert(payload, on_conflict="user_id,date")
        .select("*")
        .single()
        .execute()
    )
    if response.error:
        raise RuntimeError(response.error.message)
    return response.data


def get_risk_history(
    user_id: str, days: int = 30, types: list[str] | None = None
) -> list[dict[str, Any]]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    window_days = max(1, int(days))
    end = datetime.utcnow().date()
    start = (end - timedelta(days=window_days - 1)).isoformat()
    columns = ["date"]
    allowed = {
        "burnout": "burnout_risk",
        "injury": "injury_risk",
        "isolation": "isolation_risk",
        "financial": "financial_risk",
    }
    if types:
        for t in types:
            col = allowed.get(t)
            if col and col not in columns:
                columns.append(col)
    else:
        columns.extend(allowed.values())

    select_clause = ",".join(columns)
    rows_resp = (
        supabase.table(RISK_HISTORY_TABLE)
        .select(select_clause)
        .eq("user_id", user_id)
        .gte("date", start)
        .lte("date", end.isoformat())
        .order("date")
        .execute()
    )
    return rows_resp.data or []
