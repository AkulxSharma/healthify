from datetime import date as date_type, datetime, timedelta
from typing import Any

from db.supabase import get_supabase_client

EVENTS_TABLE = "events"
MOVEMENT_TABLE = "movement_patterns"
SCORE_SNAPSHOTS_TABLE = "score_snapshots"


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def _parse_timestamp(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            return datetime.fromisoformat(text)
        except Exception:
            return None
    return None


def _bucket_key(dt: datetime, granularity: str) -> str:
    if granularity == "week":
        start = dt.date() - timedelta(days=dt.weekday())
        return start.isoformat()
    if granularity == "month":
        start = date_type(dt.year, dt.month, 1)
        return start.isoformat()
    return dt.date().isoformat()


def _fetch_events(
    user_id: str,
    start_date: datetime,
    end_date: datetime,
    event_types: list[str] | None = None,
) -> list[dict[str, Any]]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    query = (
        supabase.table(EVENTS_TABLE)
        .select("event_type,category,amount,metadata,scores,timestamp")
        .eq("user_id", user_id)
        .gte("timestamp", start_date.isoformat())
        .lte("timestamp", end_date.isoformat())
    )
    if event_types:
        query = query.in_("event_type", event_types)
    response = query.execute()
    return response.data or []


def _trend_from_events(
    rows: list[dict[str, Any]],
    granularity: str,
    metric: str,
) -> list[dict[str, Any]]:
    buckets: dict[str, dict[str, float]] = {}
    for row in rows:
        ts = _parse_timestamp(row.get("timestamp"))
        if ts is None:
            continue
        key = _bucket_key(ts, granularity)
        bucket = buckets.setdefault(key, {"sum": 0.0, "count": 0.0})
        event_type = (row.get("event_type") or "").lower()
        amount = _safe_float(row.get("amount"))
        scores = row.get("scores") or {}
        metadata = row.get("metadata") or {}

        if metric == "spending":
            if event_type == "spending" and amount is not None:
                bucket["sum"] += abs(amount)
                bucket["count"] += 1
        elif metric == "wellness":
            value = _safe_float(scores.get("wellness_impact"))
            if value is not None:
                bucket["sum"] += value
                bucket["count"] += 1
        elif metric == "sustainability":
            value = _safe_float(scores.get("sustainability_impact"))
            if value is not None:
                bucket["sum"] += value
                bucket["count"] += 1
        elif metric == "movement_minutes":
            if event_type == "movement":
                minutes = _safe_float(metadata.get("duration_minutes")) or amount
                if minutes is not None:
                    bucket["sum"] += minutes
                    bucket["count"] += 1
    results: list[dict[str, Any]] = []
    for key, value in buckets.items():
        if metric in {"wellness", "sustainability"}:
            avg = value["sum"] / value["count"] if value["count"] > 0 else 0.0
            results.append({"date": key, "value": round(avg, 2)})
        else:
            results.append({"date": key, "value": round(value["sum"], 2)})
    results.sort(key=lambda item: item["date"])
    return results


def _trend_from_movement(
    user_id: str,
    start_date: datetime,
    end_date: datetime,
    granularity: str,
) -> list[dict[str, Any]]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    start = start_date.date().isoformat()
    end = end_date.date().isoformat()
    response = (
        supabase.table(MOVEMENT_TABLE)
        .select("date,active_minutes")
        .eq("user_id", user_id)
        .gte("date", start)
        .lte("date", end)
        .execute()
    )
    rows = response.data or []
    buckets: dict[str, float] = {}
    for row in rows:
        date_value = row.get("date")
        if isinstance(date_value, str):
            dt = _parse_timestamp(date_value)
            if dt is None:
                try:
                    dt = datetime.fromisoformat(date_value)
                except Exception:
                    continue
        elif isinstance(date_value, date_type):
            dt = datetime.combine(date_value, datetime.min.time())
        else:
            continue
        key = _bucket_key(dt, granularity)
        buckets[key] = buckets.get(key, 0.0) + float(row.get("active_minutes") or 0)
    results = [{"date": key, "value": round(value, 2)} for key, value in buckets.items()]
    results.sort(key=lambda item: item["date"])
    return results


def get_trend_data(
    user_id: str,
    metric: str,
    start_date: datetime,
    end_date: datetime,
    granularity: str = "day",
) -> list[dict[str, Any]]:
    if metric == "movement_minutes":
        data = _trend_from_movement(user_id, start_date, end_date, granularity)
        if data:
            return data
    rows = _fetch_events(user_id, start_date, end_date, None)
    return _trend_from_events(rows, granularity, metric)


def get_breakdown_data(
    user_id: str,
    breakdown_type: str,
    start_date: datetime,
    end_date: datetime,
) -> list[dict[str, Any]]:
    if breakdown_type == "spending_by_category":
        rows = _fetch_events(user_id, start_date, end_date, ["spending"])
        totals: dict[str, float] = {}
        for row in rows:
            metadata = row.get("metadata") or {}
            category = metadata.get("category") or "Other"
            amount = _safe_float(row.get("amount")) or 0.0
            totals[str(category)] = totals.get(str(category), 0.0) + abs(amount)
        total_value = sum(totals.values())
        results = [
            {
                "name": key,
                "value": round(value, 2),
                "percentage": round((value / total_value * 100) if total_value > 0 else 0.0, 2),
            }
            for key, value in totals.items()
        ]
        results.sort(key=lambda item: item["value"], reverse=True)
        return results

    if breakdown_type == "food_by_quality":
        rows = _fetch_events(user_id, start_date, end_date, ["food"])
        buckets = {"Excellent": 0, "Good": 0, "Fair": 0, "Poor": 0}
        for row in rows:
            metadata = row.get("metadata") or {}
            scores = row.get("scores") or {}
            quality = _safe_float(metadata.get("nutrition_quality_score"))
            if quality is None:
                quality = _safe_float(scores.get("wellness_impact"))
            if quality is None:
                continue
            if quality >= 8:
                buckets["Excellent"] += 1
            elif quality >= 6:
                buckets["Good"] += 1
            elif quality >= 4:
                buckets["Fair"] += 1
            else:
                buckets["Poor"] += 1
        total_value = sum(buckets.values())
        results = [
            {
                "name": key,
                "value": float(value),
                "percentage": round((value / total_value * 100) if total_value > 0 else 0.0, 2),
            }
            for key, value in buckets.items()
            if value > 0
        ]
        results.sort(key=lambda item: item["value"], reverse=True)
        return results

    if breakdown_type == "time_by_activity":
        event_types = ["movement", "work", "study", "social", "sleep", "habit", "break"]
        rows = _fetch_events(user_id, start_date, end_date, event_types)
        totals: dict[str, float] = {}
        label_map = {
            "movement": "Movement",
            "work": "Work",
            "study": "Study",
            "social": "Social",
            "sleep": "Sleep",
            "habit": "Habits",
            "break": "Break",
        }
        for row in rows:
            event_type = (row.get("event_type") or "").lower()
            metadata = row.get("metadata") or {}
            minutes = _safe_float(metadata.get("duration_minutes"))
            amount = _safe_float(row.get("amount"))
            if minutes is None and amount is not None:
                if event_type == "sleep" and amount <= 24:
                    minutes = amount * 60
                else:
                    minutes = amount
            if minutes is None:
                continue
            label = label_map.get(event_type, "Other")
            totals[label] = totals.get(label, 0.0) + minutes
        total_value = sum(totals.values())
        results = [
            {
                "name": key,
                "value": round(value, 2),
                "percentage": round((value / total_value * 100) if total_value > 0 else 0.0, 2),
            }
            for key, value in totals.items()
        ]
        results.sort(key=lambda item: item["value"], reverse=True)
        return results

    raise ValueError("Unsupported breakdown type")

def _day_bounds(d: datetime) -> tuple[datetime, datetime]:
    start = datetime(d.year, d.month, d.day)
    end = start + timedelta(days=1) - timedelta(seconds=1)
    return start, end

def _compute_daily_scores(user_id: str, day: datetime) -> dict[str, float]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    start, end = _day_bounds(day)
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
        .select("total_movement_score")
        .eq("user_id", user_id)
        .eq("date", day.date().isoformat())
        .maybe_single()
        .execute()
    )
    movement_row = movement_resp.data if isinstance(movement_resp.data, dict) else None

    spend_total = 0.0
    income_total = 0.0
    wellness_scores: list[float] = []
    sustainability_scores: list[float] = []

    for row in rows:
        etype = (row.get("event_type") or "").lower()
        category = (row.get("category") or "").lower()
        amount = _safe_float(row.get("amount")) or 0.0
        scores = row.get("scores") or {}
        wellness_impact = _safe_float(scores.get("wellness_impact"))
        sustainability_impact = _safe_float(scores.get("sustainability_impact"))

        if etype == "spending":
            spend_total += abs(amount)
        if category == "finance" or etype == "income":
            income_total += amount
        if wellness_impact is not None:
            wellness_scores.append(50.0 + float(wellness_impact) / 2.0)
        if sustainability_impact is not None:
            sustainability_scores.append(50.0 + float(sustainability_impact) / 2.0)

    if income_total + spend_total > 0:
        net = income_total - spend_total
        wallet_score = 50.0 + (net / float(income_total + spend_total)) * 50.0
    else:
        wallet_score = 50.0

    wellness_score = sum(wellness_scores) / float(len(wellness_scores)) if wellness_scores else 50.0
    sustainability_score = (
        sum(sustainability_scores) / float(len(sustainability_scores)) if sustainability_scores else 50.0
    )
    movement_score = _safe_float((movement_row or {}).get("total_movement_score")) or 0.0
    movement_score = max(0.0, min(100.0, movement_score))

    return {
        "wallet_score": round(max(0.0, min(100.0, wallet_score)), 2),
        "wellness_score": round(max(0.0, min(100.0, wellness_score)), 2),
        "sustainability_score": round(max(0.0, min(100.0, sustainability_score)), 2),
        "movement_score": round(movement_score, 2),
    }

def save_daily_snapshot(user_id: str, day: datetime) -> dict[str, float]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    scores = _compute_daily_scores(user_id, day)
    payload = {
        "user_id": user_id,
        "date": day.date().isoformat(),
        **scores,
    }
    response = (
        supabase.table(SCORE_SNAPSHOTS_TABLE)
        .upsert(payload, on_conflict="user_id,date")
        .execute()
    )
    if response.error:
        raise RuntimeError(str(response.error))
    return scores

def get_score_history(user_id: str, start_date: datetime, end_date: datetime) -> list[dict[str, float | str]]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    resp = (
        supabase.table(SCORE_SNAPSHOTS_TABLE)
        .select("date,wallet_score,wellness_score,sustainability_score,movement_score")
        .eq("user_id", user_id)
        .gte("date", start_date.date().isoformat())
        .lte("date", end_date.date().isoformat())
        .order("date", desc=False)
        .execute()
    )
    rows = resp.data or []
    return rows


def snapshot_active_users(target_date: date_type | None = None, lookback_days: int = 30) -> int:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    target = target_date or datetime.utcnow().date()
    since = (target - timedelta(days=max(1, lookback_days))).isoformat()
    resp = (
        supabase.table(EVENTS_TABLE)
        .select("user_id")
        .gte("timestamp", since)
        .execute()
    )
    rows = resp.data or []
    user_ids = {row.get("user_id") for row in rows if row.get("user_id")}
    count = 0
    for user_id in user_ids:
        save_daily_snapshot(str(user_id), datetime.combine(target, datetime.min.time()))
        count += 1
    return count


def _period_bounds(period: str) -> tuple[datetime, datetime, datetime, datetime]:
    today = datetime.utcnow().date()
    if period == "month":
        days = 30
    elif period == "week":
        days = 7
    else:
        raise ValueError("Unsupported period")
    current_start = datetime.combine(today - timedelta(days=days - 1), datetime.min.time())
    current_end = datetime.combine(today, datetime.max.time())
    previous_end = current_start - timedelta(seconds=1)
    previous_start = previous_end - timedelta(days=days - 1)
    return current_start, current_end, previous_start, previous_end


def _pct_change(current: float, previous: float) -> float:
    if previous == 0:
        return 0.0 if current == 0 else 100.0
    return round(((current - previous) / previous) * 100.0, 2)


def _movement_totals(
    user_id: str, start_date: datetime, end_date: datetime
) -> tuple[float, float]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    start = start_date.date().isoformat()
    end = end_date.date().isoformat()
    response = (
        supabase.table(MOVEMENT_TABLE)
        .select("steps,workout_count")
        .eq("user_id", user_id)
        .gte("date", start)
        .lte("date", end)
        .execute()
    )
    rows = response.data or []
    steps = sum(float(row.get("steps") or 0) for row in rows)
    workouts = sum(float(row.get("workout_count") or 0) for row in rows)
    return steps, workouts


def _wellness_avg(rows: list[dict[str, Any]]) -> float:
    values = []
    for row in rows:
        scores = row.get("scores") or {}
        value = _safe_float(scores.get("wellness_impact"))
        if value is not None:
            values.append(value)
    if not values:
        return 0.0
    return round(sum(values) / len(values), 2)


def _swaps_from_rows(rows: list[dict[str, Any]]) -> tuple[int, float]:
    swaps = 0
    savings = 0.0
    for row in rows:
        metadata = row.get("metadata") or {}
        accepted = metadata.get("swap_accepted")
        if accepted is True:
            swaps += 1
            savings += float(metadata.get("swap_savings") or metadata.get("money_saved") or 0)
        elif isinstance(accepted, str) and accepted.lower() in {"true", "yes", "1"}:
            swaps += 1
            savings += float(metadata.get("swap_savings") or metadata.get("money_saved") or 0)
    return swaps, round(savings, 2)


def get_dashboard_stats(user_id: str, period: str = "week") -> dict[str, Any]:
    current_start, current_end, previous_start, previous_end = _period_bounds(period)

    current_rows = _fetch_events(user_id, current_start, current_end, None)
    previous_rows = _fetch_events(user_id, previous_start, previous_end, None)

    def spending_total(rows: list[dict[str, Any]]) -> float:
        return round(
            sum(
                abs(_safe_float(row.get("amount")) or 0.0)
                for row in rows
                if (row.get("event_type") or "").lower() == "spending"
            ),
            2,
        )

    def meals_logged(rows: list[dict[str, Any]]) -> float:
        return float(
            sum(1 for row in rows if (row.get("event_type") or "").lower() == "food")
        )

    current_spending = spending_total(current_rows)
    previous_spending = spending_total(previous_rows)

    current_meals = meals_logged(current_rows)
    previous_meals = meals_logged(previous_rows)

    current_steps, current_workouts = _movement_totals(user_id, current_start, current_end)
    previous_steps, previous_workouts = _movement_totals(user_id, previous_start, previous_end)

    current_wellness = _wellness_avg(current_rows)
    previous_wellness = _wellness_avg(previous_rows)

    current_swaps, current_savings = _swaps_from_rows(current_rows)
    previous_swaps, previous_savings = _swaps_from_rows(previous_rows)

    return {
        "period": period,
        "stats": {
            "spending_total": {
                "value": current_spending,
                "change": round(current_spending - previous_spending, 2),
                "change_percent": _pct_change(current_spending, previous_spending),
            },
            "steps_total": {
                "value": round(current_steps, 2),
                "change": round(current_steps - previous_steps, 2),
                "change_percent": _pct_change(current_steps, previous_steps),
            },
            "meals_logged": {
                "value": current_meals,
                "change": round(current_meals - previous_meals, 2),
                "change_percent": _pct_change(current_meals, previous_meals),
            },
            "workouts_completed": {
                "value": round(current_workouts, 2),
                "change": round(current_workouts - previous_workouts, 2),
                "change_percent": _pct_change(current_workouts, previous_workouts),
            },
            "wellness_score_avg": {
                "value": current_wellness,
                "change": round(current_wellness - previous_wellness, 2),
                "change_percent": _pct_change(current_wellness, previous_wellness),
            },
            "swaps_accepted": {
                "value": float(current_swaps),
                "change": float(current_swaps - previous_swaps),
                "change_percent": _pct_change(float(current_swaps), float(previous_swaps)),
            },
            "money_saved_via_swaps": {
                "value": current_savings,
                "change": round(current_savings - previous_savings, 2),
                "change_percent": _pct_change(current_savings, previous_savings),
            },
        },
    }


def _date_series(start_date: datetime, end_date: datetime) -> list[date_type]:
    days = (end_date.date() - start_date.date()).days + 1
    return [start_date.date() + timedelta(days=i) for i in range(days)]


def _daily_values_from_events(
    rows: list[dict[str, Any]],
    days: list[date_type],
    metric: str,
) -> list[dict[str, Any]]:
    values: dict[str, list[float]] = {day.isoformat(): [] for day in days}
    for row in rows:
        ts = _parse_timestamp(row.get("timestamp"))
        if ts is None:
            continue
        key = ts.date().isoformat()
        if key not in values:
            continue
        event_type = (row.get("event_type") or "").lower()
        amount = _safe_float(row.get("amount"))
        scores = row.get("scores") or {}
        metadata = row.get("metadata") or {}
        if metric == "spending" and event_type == "spending":
            values[key].append(abs(amount or 0.0))
        elif metric == "wellness":
            value = _safe_float(scores.get("wellness_impact"))
            if value is not None:
                values[key].append(value)
        elif metric == "movement_minutes" and event_type == "movement":
            minutes = _safe_float(metadata.get("duration_minutes")) or amount
            if minutes is not None:
                values[key].append(minutes)
    results = []
    for day in days:
        key = day.isoformat()
        if metric in {"wellness"}:
            vals = values[key]
            avg = sum(vals) / len(vals) if vals else 0.0
            results.append({"date": key, "value": round(avg, 2)})
        else:
            results.append({"date": key, "value": round(sum(values[key]), 2)})
    return results


def _daily_values_from_movement(
    user_id: str,
    days: list[date_type],
    metric: str,
) -> list[dict[str, Any]]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    start = days[0].isoformat()
    end = days[-1].isoformat()
    fields = "date,active_minutes,steps"
    response = (
        supabase.table(MOVEMENT_TABLE)
        .select(fields)
        .eq("user_id", user_id)
        .gte("date", start)
        .lte("date", end)
        .execute()
    )
    rows = response.data or []
    lookup: dict[str, dict[str, Any]] = {str(row.get("date")): row for row in rows}
    results = []
    for day in days:
        key = day.isoformat()
        row = lookup.get(key)
        if metric == "steps":
            value = float(row.get("steps") or 0) if row else 0.0
        else:
            value = float(row.get("active_minutes") or 0) if row else 0.0
        results.append({"date": key, "value": round(value, 2)})
    return results


def get_before_after_comparison(
    user_id: str,
    intervention_date: date_type,
    metric: str,
) -> dict[str, Any]:
    days = 14
    before_start = datetime.combine(
        intervention_date - timedelta(days=days), datetime.min.time()
    )
    before_end = datetime.combine(intervention_date - timedelta(days=1), datetime.max.time())
    after_start = datetime.combine(intervention_date, datetime.min.time())
    after_end = datetime.combine(intervention_date + timedelta(days=days - 1), datetime.max.time())

    before_days = _date_series(before_start, before_end)
    after_days = _date_series(after_start, after_end)

    if metric in {"steps", "movement_minutes"}:
        before_data = _daily_values_from_movement(user_id, before_days, metric)
        after_data = _daily_values_from_movement(user_id, after_days, metric)
    else:
        before_rows = _fetch_events(user_id, before_start, before_end, None)
        after_rows = _fetch_events(user_id, after_start, after_end, None)
        if metric not in {"spending", "wellness", "movement_minutes"}:
            raise ValueError("Unsupported metric")
        before_data = _daily_values_from_events(before_rows, before_days, metric)
        after_data = _daily_values_from_events(after_rows, after_days, metric)

    before_avg = round(sum(d["value"] for d in before_data) / len(before_data), 2)
    after_avg = round(sum(d["value"] for d in after_data) / len(after_data), 2)
    change = round(after_avg - before_avg, 2)
    change_percent = _pct_change(after_avg, before_avg)

    return {
        "metric": metric,
        "intervention_date": intervention_date.isoformat(),
        "before_avg": before_avg,
        "after_avg": after_avg,
        "change": change,
        "change_percent": change_percent,
        "before_data": before_data,
        "after_data": after_data,
    }
