from datetime import date as date_type, datetime, timedelta
import calendar
import math
from typing import Any

from db.supabase import get_supabase_client

EVENTS_TABLE = "events"


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


def _date_key(value: Any) -> str | None:
    ts = _parse_ts(value)
    if ts is None:
        return None
    return ts.date().isoformat()


def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
    return max(minimum, min(maximum, value))


def _add_months(source: date_type, months: int) -> date_type:
    month_index = source.month - 1 + months
    year = source.year + month_index // 12
    month = month_index % 12 + 1
    day = min(source.day, calendar.monthrange(year, month)[1])
    return date_type(year, month, day)


def _safe_avg(values: list[float]) -> float:
    return sum(values) / float(len(values)) if values else 0.0



    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    horizon = max(1, int(days))
    today = datetime.utcnow().date()
    history_start = today - timedelta(days=90)
    history_end = today

    response = (
        supabase.table(EVENTS_TABLE)
        .select("event_type,category,amount,metadata,timestamp,title")
        .eq("user_id", user_id)
        .gte("timestamp", datetime.combine(history_start, datetime.min.time()).isoformat())
        .lte("timestamp", datetime.combine(history_end, datetime.max.time()).isoformat())
        .execute()
    )
    rows = response.data or []

    latest_balance = None
    latest_balance_ts = None
    net_by_day: dict[str, float] = {}
    swap_savings_total = 0.0
    recurring: dict[str, dict[str, Any]] = {}

    for row in rows:
        metadata = row.get("metadata") or {}
        timestamp = row.get("timestamp")
        ts = _parse_ts(timestamp)
        if ts is None:
            continue
        date_key = ts.date().isoformat()
        amount = _safe_float(row.get("amount")) or 0.0
        event_type = (row.get("event_type") or "").lower()
        category = (row.get("category") or "").lower()

        current_balance = _safe_float(metadata.get("current_balance"))
        if current_balance is not None:
            if latest_balance_ts is None or ts > latest_balance_ts:
                latest_balance_ts = ts
                latest_balance = current_balance

        if event_type == "spending":
            net_by_day[date_key] = net_by_day.get(date_key, 0.0) - abs(amount)
        elif category == "finance":
            net_by_day[date_key] = net_by_day.get(date_key, 0.0) + amount

        savings = _safe_float(metadata.get("money_saved_via_swaps"))
        if savings is None:
            savings = _safe_float(metadata.get("swap_savings"))
        if savings is not None:
            swap_savings_total += max(0.0, savings)

        if event_type == "spending":
            recurring_flag = metadata.get("recurring") or metadata.get("is_recurring")
            if recurring_flag:
                key = str(metadata.get("merchant") or row.get("title") or metadata.get("category") or "Recurring")
                cadence_days = int(_safe_float(metadata.get("recurring_interval_days")) or 30)
                entry = recurring.setdefault(
                    key,
                    {
                        "name": key,
                        "amounts": [],
                        "last_date": ts.date(),
                        "cadence_days": cadence_days,
                        "next_due": metadata.get("next_due_date"),
                    },
                )
                entry["amounts"].append(abs(amount))
                if ts.date() > entry["last_date"]:
                    entry["last_date"] = ts.date()
                if entry["cadence_days"] != cadence_days:
                    entry["cadence_days"] = cadence_days

    if latest_balance is None:
        latest_balance = sum(net_by_day.values())

    lookback_days = max(1, min(30, len(net_by_day) or 1))
    lookback_start = today - timedelta(days=lookback_days - 1)
    daily_nets = [
        net_by_day.get((lookback_start + timedelta(days=offset)).isoformat(), 0.0)
        for offset in range(lookback_days)
    ]
    total_net = sum(daily_nets)
    average_daily_net = total_net / float(lookback_days)
    savings_per_day = swap_savings_total / float(max(1, lookback_days))
    mean_net = average_daily_net
    variance = _safe_avg([(value - mean_net) ** 2 for value in daily_nets])
    std_daily = math.sqrt(variance)

    trajectories = {"current": [], "with_swaps": []}
    for offset in range(horizon + 1):
        date_value = today + timedelta(days=offset)
        balance = latest_balance + average_daily_net * offset
        with_swaps = latest_balance + (average_daily_net + savings_per_day) * offset
        interval = std_daily * math.sqrt(max(1, offset))
        point = {
            "date": date_value.isoformat(),
            "balance": round(balance, 2),
            "lower": round(balance - interval, 2),
            "upper": round(balance + interval, 2),
        }
        swap_point = {
            "date": date_value.isoformat(),
            "balance": round(with_swaps, 2),
            "lower": round(with_swaps - interval, 2),
            "upper": round(with_swaps + interval, 2),
        }
        trajectories["current"].append(point)
        trajectories["with_swaps"].append(swap_point)

    recurring_expenses = []
    for entry in recurring.values():
        cadence_days = max(1, int(entry.get("cadence_days") or 30))
        last_date = entry.get("last_date") or today
        next_due = entry.get("next_due")
        if isinstance(next_due, str):
            next_due_date = next_due
        else:
            next_due_date = (last_date + timedelta(days=cadence_days)).isoformat()
        amount_list = entry.get("amounts") or []
        average_amount = sum(amount_list) / float(len(amount_list)) if amount_list else 0.0
        recurring_expenses.append(
            {
                "name": entry.get("name") or "Recurring",
                "amount": round(average_amount, 2),
                "cadence_days": cadence_days,
                "next_due": next_due_date,
            }
        )
    recurring_expenses.sort(key=lambda item: item["next_due"])

    return {
        "current_balance": round(float(latest_balance), 2),
        "trajectories": trajectories,
        "recurring_expenses": recurring_expenses,
        "savings_potential": round(savings_per_day * horizon, 2),
    }


def project_wallet_longterm(user_id: str, months: int = 3) -> dict[str, Any]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    horizon_months = max(3, min(6, int(months)))
    today = datetime.utcnow().date()
    history_start = today - timedelta(days=180)
    history_end = today

    response = (
        supabase.table(EVENTS_TABLE)
        .select("event_type,category,amount,metadata,timestamp,title")
        .eq("user_id", user_id)
        .gte("timestamp", datetime.combine(history_start, datetime.min.time()).isoformat())
        .lte("timestamp", datetime.combine(history_end, datetime.max.time()).isoformat())
        .execute()
    )
    rows = response.data or []

    latest_balance = None
    latest_balance_ts = None
    net_by_day: dict[str, float] = {}
    income_by_day: dict[str, float] = {}
    spend_by_day: dict[str, float] = {}
    swap_savings_total = 0.0
    recurring: dict[str, dict[str, Any]] = {}

    for row in rows:
        metadata = row.get("metadata") or {}
        timestamp = row.get("timestamp")
        ts = _parse_ts(timestamp)
        if ts is None:
            continue
        date_key = ts.date().isoformat()
        amount = _safe_float(row.get("amount")) or 0.0
        event_type = (row.get("event_type") or "").lower()
        category = (row.get("category") or "").lower()

        current_balance = _safe_float(metadata.get("current_balance"))
        if current_balance is not None:
            if latest_balance_ts is None or ts > latest_balance_ts:
                latest_balance_ts = ts
                latest_balance = current_balance

        if event_type == "spending":
            net_by_day[date_key] = net_by_day.get(date_key, 0.0) - abs(amount)
            spend_by_day[date_key] = spend_by_day.get(date_key, 0.0) + abs(amount)
        elif category == "finance":
            net_by_day[date_key] = net_by_day.get(date_key, 0.0) + amount
            income_by_day[date_key] = income_by_day.get(date_key, 0.0) + amount

        savings = _safe_float(metadata.get("money_saved_via_swaps"))
        if savings is None:
            savings = _safe_float(metadata.get("swap_savings"))
        if savings is not None:
            swap_savings_total += max(0.0, savings)

        if event_type == "spending":
            recurring_flag = metadata.get("recurring") or metadata.get("is_recurring")
            if recurring_flag:
                key = str(metadata.get("merchant") or row.get("title") or metadata.get("category") or "Recurring")
                cadence_days = int(_safe_float(metadata.get("recurring_interval_days")) or 30)
                entry = recurring.setdefault(
                    key,
                    {
                        "name": key,
                        "amounts": [],
                        "last_date": ts.date(),
                        "cadence_days": cadence_days,
                        "next_due": metadata.get("next_due_date"),
                    },
                )
                entry["amounts"].append(abs(amount))
                if ts.date() > entry["last_date"]:
                    entry["last_date"] = ts.date()
                if entry["cadence_days"] != cadence_days:
                    entry["cadence_days"] = cadence_days

    if latest_balance is None:
        latest_balance = sum(net_by_day.values())

    lookback_days = max(1, min(90, len(net_by_day) or 1))
    lookback_start = today - timedelta(days=lookback_days - 1)
    daily_nets = [
        net_by_day.get((lookback_start + timedelta(days=offset)).isoformat(), 0.0)
        for offset in range(lookback_days)
    ]
    daily_income = [
        income_by_day.get((lookback_start + timedelta(days=offset)).isoformat(), 0.0)
        for offset in range(lookback_days)
    ]
    daily_spend = [
        spend_by_day.get((lookback_start + timedelta(days=offset)).isoformat(), 0.0)
        for offset in range(lookback_days)
    ]

    average_daily_net = _safe_avg(daily_nets)
    average_daily_income = _safe_avg(daily_income)
    average_daily_spend = _safe_avg(daily_spend)
    savings_per_day = swap_savings_total / float(max(1, lookback_days))
    mean_net = average_daily_net
    variance = _safe_avg([(value - mean_net) ** 2 for value in daily_nets])
    std_daily = math.sqrt(variance)

    trajectories = {"current": [], "with_swaps": []}
    monthly_breakdown = []
    current_balance = float(latest_balance)
    current_cumulative = current_balance
    swap_cumulative = current_balance
    for month_offset in range(horizon_months + 1):
        date_value = _add_months(today, month_offset)
        days = 30 * month_offset
        balance = current_balance + average_daily_net * days
        with_swaps = current_balance + (average_daily_net + savings_per_day) * days
        interval = std_daily * math.sqrt(max(1, days))
        trajectories["current"].append(
            {
                "date": date_value.isoformat(),
                "balance": round(balance, 2),
                "lower": round(balance - interval, 2),
                "upper": round(balance + interval, 2),
            }
        )
        trajectories["with_swaps"].append(
            {
                "date": date_value.isoformat(),
                "balance": round(with_swaps, 2),
                "lower": round(with_swaps - interval, 2),
                "upper": round(with_swaps + interval, 2),
            }
        )

        if month_offset > 0:
            month_income = average_daily_income * 30
            month_spend = average_daily_spend * 30
            net = month_income - month_spend
            current_cumulative += net
            swap_cumulative += net + savings_per_day * 30
            monthly_breakdown.append(
                {
                    "month": date_value.strftime("%Y-%m"),
                    "projected_income": round(month_income, 2),
                    "projected_spend": round(month_spend, 2),
                    "net": round(net, 2),
                    "cumulative_balance": round(current_cumulative, 2),
                }
            )

    major_expenses = []
    horizon_date = _add_months(today, horizon_months)
    for entry in recurring.values():
        cadence_days = max(1, int(entry.get("cadence_days") or 30))
        last_date = entry.get("last_date") or today
        next_due = entry.get("next_due")
        if isinstance(next_due, str):
            next_due_date = datetime.fromisoformat(next_due).date()
        else:
            next_due_date = last_date + timedelta(days=cadence_days)
        if next_due_date <= horizon_date:
            amount_list = entry.get("amounts") or []
            average_amount = sum(amount_list) / float(len(amount_list)) if amount_list else 0.0
            major_expenses.append(
                {
                    "name": entry.get("name") or "Recurring",
                    "amount": round(average_amount, 2),
                    "next_due": next_due_date.isoformat(),
                }
            )
    major_expenses.sort(key=lambda item: item["amount"], reverse=True)
    major_expenses = major_expenses[:6]

    total_days = horizon_months * 30
    return {
        "current_balance": round(current_balance, 2),
        "trajectories": trajectories,
        "monthly_breakdown": monthly_breakdown,
        "cumulative_savings": {
            "current": round(average_daily_net * total_days, 2),
            "with_swaps": round((average_daily_net + savings_per_day) * total_days, 2),
        },
        "major_expenses": major_expenses,
    }


def project_wellness(user_id: str, days: int = 30) -> dict[str, Any]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    horizon_days = max(30, min(90, int(days)))
    today = datetime.utcnow().date()
    history_start = today - timedelta(days=90)
    history_end = today

    response = (
        supabase.table(EVENTS_TABLE)
        .select("event_type,category,amount,metadata,scores,timestamp")
        .eq("user_id", user_id)
        .gte("timestamp", datetime.combine(history_start, datetime.min.time()).isoformat())
        .lte("timestamp", datetime.combine(history_end, datetime.max.time()).isoformat())
        .execute()
    )
    rows = response.data or []

    daily = {}
    for offset in range(90):
        day = history_start + timedelta(days=offset)
        daily[day.isoformat()] = {
            "sleep_hours": 0.0,
            "movement_minutes": 0.0,
            "diet_scores": [],
            "mood_scores": [],
        }

    for row in rows:
        ts = _parse_ts(row.get("timestamp"))
        if ts is None:
            continue
        date_key = ts.date().isoformat()
        if date_key not in daily:
            continue
        event_type = (row.get("event_type") or "").lower()
        metadata = row.get("metadata") or {}
        scores = row.get("scores") or {}
        amount = _safe_float(row.get("amount")) or 0.0

        if event_type == "sleep":
            hours = amount or _safe_float(metadata.get("hours")) or 0.0
            daily[date_key]["sleep_hours"] += max(0.0, hours)
        if event_type == "movement":
            minutes = _safe_float(metadata.get("duration_minutes")) or amount or 0.0
            daily[date_key]["movement_minutes"] += max(0.0, minutes)
        if event_type == "food":
            quality = _safe_float(metadata.get("nutrition_quality_score"))
            if quality is None:
                quality = _safe_float(scores.get("wellness_impact"))
            if quality is not None:
                if quality <= 10:
                    daily[date_key]["diet_scores"].append(quality * 10.0)
                else:
                    daily[date_key]["diet_scores"].append((quality + 100.0) / 2.0)
        if event_type == "mood":
            mood = _safe_float(amount)
            if mood is not None:
                daily[date_key]["mood_scores"].append(_clamp(mood * 10.0))

    lookback_days = 14
    lookback_start = today - timedelta(days=lookback_days - 1)
    sleep_scores = []
    movement_scores = []
    diet_scores = []
    stress_scores = []
    for offset in range(lookback_days):
        date_value = lookback_start + timedelta(days=offset)
        day = daily.get(date_value.isoformat())
        if not day:
            continue
        sleep_hours = day["sleep_hours"]
        sleep_score = 100.0 - min(50.0, abs(sleep_hours - 7.5) * 12.0)
        movement_score = min(100.0, (day["movement_minutes"] / 120.0) * 100.0)
        diet_score = _safe_avg(day["diet_scores"]) if day["diet_scores"] else 0.0
        mood_score = _safe_avg(day["mood_scores"]) if day["mood_scores"] else 50.0
        sleep_scores.append(_clamp(sleep_score))
        movement_scores.append(_clamp(movement_score))
        diet_scores.append(_clamp(diet_score))
        stress_scores.append(_clamp(mood_score))

    sleep_base = _safe_avg(sleep_scores)
    movement_base = _safe_avg(movement_scores)
    diet_base = _safe_avg(diet_scores)
    stress_base = _safe_avg(stress_scores)

    weights = {"sleep": 0.3, "movement": 0.3, "diet": 0.2, "stress": 0.2}
    current_score = (
        sleep_base * weights["sleep"]
        + movement_base * weights["movement"]
        + diet_base * weights["diet"]
        + stress_base * weights["stress"]
    )

    targets = {
        "sleep": min(100.0, sleep_base + max(5.0, 80.0 - sleep_base) * 0.5),
        "movement": min(100.0, movement_base + max(5.0, 80.0 - movement_base) * 0.6),
        "diet": min(100.0, diet_base + max(5.0, 80.0 - diet_base) * 0.5),
        "stress": min(100.0, stress_base + max(5.0, 75.0 - stress_base) * 0.5),
    }
    improved_score = (
        targets["sleep"] * weights["sleep"]
        + targets["movement"] * weights["movement"]
        + targets["diet"] * weights["diet"]
        + targets["stress"] * weights["stress"]
    )

    trajectories = {"current": [], "improved": []}
    projected_scores = []
    for offset in range(horizon_days + 1):
        ratio = offset / float(horizon_days)
        date_value = today + timedelta(days=offset)
        current_point = {
            "date": date_value.isoformat(),
            "score": round(current_score, 2),
            "sleep": round(sleep_base, 2),
            "diet": round(diet_base, 2),
            "movement": round(movement_base, 2),
            "stress": round(stress_base, 2),
        }
        improved_point = {
            "date": date_value.isoformat(),
            "score": round(current_score + (improved_score - current_score) * ratio, 2),
            "sleep": round(sleep_base + (targets["sleep"] - sleep_base) * ratio, 2),
            "diet": round(diet_base + (targets["diet"] - diet_base) * ratio, 2),
            "movement": round(movement_base + (targets["movement"] - movement_base) * ratio, 2),
            "stress": round(stress_base + (targets["stress"] - stress_base) * ratio, 2),
        }
        trajectories["current"].append(current_point)
        trajectories["improved"].append(improved_point)
        projected_scores.append(current_point)

    factors = []
    if sleep_base < 75:
        factors.append({"name": "Sleep consistency", "impact": round(75 - sleep_base, 2), "detail": "Below 7-8h target"})
    if movement_base < 70:
        factors.append(
            {"name": "Movement minutes", "impact": round(70 - movement_base, 2), "detail": "Below 120 min/day"}
        )
    if diet_base < 70:
        factors.append({"name": "Diet quality", "impact": round(70 - diet_base, 2), "detail": "Low nutrition scores"})
    if stress_base < 65:
        factors.append({"name": "Stress load", "impact": round(65 - stress_base, 2), "detail": "Low mood logs"})
    factors.sort(key=lambda item: item["impact"], reverse=True)

    recommendations = []
    if sleep_base < 75:
        recommendations.append("Aim for a consistent 7-8h sleep window.")
    if movement_base < 70:
        recommendations.append("Add 20-30 minutes of movement most days.")
    if diet_base < 70:
        recommendations.append("Increase meals with whole foods or vegetables.")
    if stress_base < 65:
        recommendations.append("Schedule a daily decompression ritual.")

    return {
        "current_score": round(current_score, 2),
        "projected_scores": projected_scores,
        "trajectories": trajectories,
        "factors_impacting": factors,
        "recommended_changes": recommendations,
    }


def project_sustainability(user_id: str, days: int = 30) -> dict[str, Any]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    horizon_days = max(30, min(90, int(days)))
    today = datetime.utcnow().date()
    history_start = today - timedelta(days=90)
    history_end = today

    response = (
        supabase.table(EVENTS_TABLE)
        .select("event_type,category,amount,metadata,scores,timestamp")
        .eq("user_id", user_id)
        .gte("timestamp", datetime.combine(history_start, datetime.min.time()).isoformat())
        .lte("timestamp", datetime.combine(history_end, datetime.max.time()).isoformat())
        .execute()
    )
    rows = response.data or []

    daily = {}
    for offset in range(90):
        day = history_start + timedelta(days=offset)
        daily[day.isoformat()] = {"co2e": 0.0, "water": 0.0, "waste": 0.0}

    impact_totals = {"Food": 0.0, "Transport": 0.0, "Purchases": 0.0}
    food_meat = 0
    food_plant = 0
    transport_car = 0
    transport_walk = 0
    purchase_local = 0
    purchase_shipped = 0

    meat_keywords = {"beef", "pork", "lamb", "chicken", "turkey", "meat", "steak"}
    plant_keywords = {"tofu", "bean", "beans", "lentil", "vegetable", "veggie", "salad"}

    for row in rows:
        ts = _parse_ts(row.get("timestamp"))
        if ts is None:
            continue
        date_key = ts.date().isoformat()
        if date_key not in daily:
            continue
        event_type = (row.get("event_type") or "").lower()
        metadata = row.get("metadata") or {}
        scores = row.get("scores") or {}

        if event_type == "food":
            ingredients = [str(item).lower() for item in metadata.get("ingredients") or []]
            sustainability_score = _safe_float(metadata.get("sustainability_score"))
            if sustainability_score is None:
                sustainability_score = _safe_float(scores.get("sustainability_impact"))
            if any(keyword in ingredients for keyword in meat_keywords):
                co2e, water, waste = 5.0, 4.0, 2.0
                food_meat += 1
            elif any(keyword in ingredients for keyword in plant_keywords):
                co2e, water, waste = 2.0, 2.0, 1.0
                food_plant += 1
            else:
                base = 3.5 if sustainability_score is None else 5.0 - (sustainability_score / 20.0)
                co2e, water, waste = base, base * 0.8, base * 0.5
            daily[date_key]["co2e"] += co2e
            daily[date_key]["water"] += water
            daily[date_key]["waste"] += waste
            impact_totals["Food"] += co2e + water + waste

        if event_type == "movement":
            mode = str(metadata.get("type") or "").lower()
            if "car" in mode or "drive" in mode:
                co2e, water, waste = 4.0, 1.2, 1.0
                transport_car += 1
            elif "walk" in mode or "bike" in mode:
                co2e, water, waste = 0.5, 0.3, 0.2
                transport_walk += 1
            else:
                co2e, water, waste = 1.5, 0.6, 0.4
            daily[date_key]["co2e"] += co2e
            daily[date_key]["water"] += water
            daily[date_key]["waste"] += waste
            impact_totals["Transport"] += co2e + water + waste

        if event_type == "spending":
            local_flag = bool(metadata.get("local_purchase"))
            shipped_flag = bool(metadata.get("shipping") or metadata.get("shipped") or metadata.get("delivery"))
            if local_flag:
                co2e, water, waste = 1.2, 0.8, 0.6
                purchase_local += 1
            elif shipped_flag:
                co2e, water, waste = 3.2, 1.6, 1.4
                purchase_shipped += 1
            else:
                co2e, water, waste = 2.2, 1.2, 1.0
            daily[date_key]["co2e"] += co2e
            daily[date_key]["water"] += water
            daily[date_key]["waste"] += waste
            impact_totals["Purchases"] += co2e + water + waste

    lookback_days = 30
    lookback_start = today - timedelta(days=lookback_days - 1)
    co2e_values = []
    water_values = []
    waste_values = []
    for offset in range(lookback_days):
        date_value = lookback_start + timedelta(days=offset)
        day = daily.get(date_value.isoformat(), {"co2e": 0.0, "water": 0.0, "waste": 0.0})
        co2e_values.append(day["co2e"])
        water_values.append(day["water"])
        waste_values.append(day["waste"])

    co2e_base = _safe_avg(co2e_values)
    water_base = _safe_avg(water_values)
    waste_base = _safe_avg(waste_values)
    current_footprint = co2e_base + water_base + waste_base

    food_total = food_meat + food_plant
    transport_total = transport_car + transport_walk
    purchase_total = purchase_local + purchase_shipped
    meat_ratio = food_meat / float(food_total) if food_total else 0.0
    car_ratio = transport_car / float(transport_total) if transport_total else 0.0
    shipped_ratio = purchase_shipped / float(purchase_total) if purchase_total else 0.0

    improvement_factor = min(0.4, 0.15 + meat_ratio * 0.2 + car_ratio * 0.2 + shipped_ratio * 0.15)

    trajectories = {"current": [], "green_swaps": []}
    for offset in range(horizon_days + 1):
        date_value = today + timedelta(days=offset)
        trajectories["current"].append(
            {
                "date": date_value.isoformat(),
                "co2e": round(co2e_base, 2),
                "water": round(water_base, 2),
                "waste": round(waste_base, 2),
            }
        )
        trajectories["green_swaps"].append(
            {
                "date": date_value.isoformat(),
                "co2e": round(co2e_base * (1 - improvement_factor), 2),
                "water": round(water_base * (1 - improvement_factor), 2),
                "waste": round(waste_base * (1 - improvement_factor), 2),
            }
        )

    improvement_potential = round(improvement_factor * 100, 2)
    total_impact = sum(impact_totals.values()) or 1.0
    top_impact_areas = [
        {
            "name": name,
            "impact": round((value / total_impact) * 100, 2),
            "detail": f"{round(value, 1)} impact units",
        }
        for name, value in impact_totals.items()
        if value > 0
    ]
    top_impact_areas.sort(key=lambda item: item["impact"], reverse=True)

    projected_footprint = round(current_footprint * horizon_days, 2)

    return {
        "current_footprint": round(current_footprint, 2),
        "projected_footprint": projected_footprint,
        "trajectories": trajectories,
        "improvement_potential": improvement_potential,
        "top_impact_areas": top_impact_areas,
    }


def compare_scenarios(
    user_id: str,
    scenarios: list[dict[str, Any]],
    metric: str,
    days: int = 30,
) -> dict[str, Any]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    horizon_days = max(1, int(days))
    metric_key = (metric or "").lower()

    def _custom_inputs() -> dict[str, float]:
        for scenario in scenarios:
            if (scenario.get("name") or "").lower() == "custom":
                inputs = scenario.get("inputs") or scenario.get("custom") or {}
                return {key: float(value) for key, value in inputs.items() if value is not None}
        return {}

    inputs = _custom_inputs()
    today = datetime.utcnow().date()
    lookback_days = min(30, horizon_days)
    spend_start = today - timedelta(days=lookback_days - 1)

    spend_response = (
        supabase.table(EVENTS_TABLE)
        .select("event_type,amount,timestamp")
        .eq("user_id", user_id)
        .gte("timestamp", datetime.combine(spend_start, datetime.min.time()).isoformat())
        .lte("timestamp", datetime.combine(today, datetime.max.time()).isoformat())
        .execute()
    )
    spend_rows = spend_response.data or []
    spend_total = 0.0
    for row in spend_rows:
        if (row.get("event_type") or "").lower() != "spending":
            continue
        amount = _safe_float(row.get("amount"))
        if amount is not None:
            spend_total += abs(amount)
    baseline_daily_spend = spend_total / float(max(1, lookback_days))

    scenario_results: list[dict[str, Any]] = []
    scenario_series: list[list[dict[str, Any]]] = []

    if metric_key == "wallet":
        base = project_wallet_shortterm(user_id, horizon_days)
        current_points = base["trajectories"]["current"]
        swaps_points = base["trajectories"]["with_swaps"]
        start_balance = float(current_points[0]["balance"]) if current_points else 0.0
        end_balance = float(current_points[-1]["balance"]) if current_points else start_balance
        daily_net = (end_balance - start_balance) / float(max(1, horizon_days))

        custom_spend = inputs.get("daily_spending", baseline_daily_spend)
        custom_daily_net = daily_net + (baseline_daily_spend - custom_spend)

        series_map = {
            "current": [
                {"date": point["date"], "value": float(point["balance"])} for point in current_points
            ],
            "with_swaps": [
                {"date": point["date"], "value": float(point["balance"])} for point in swaps_points
            ],
            "custom": [
                {
                    "date": current_points[index]["date"],
                    "value": round(start_balance + custom_daily_net * index, 2),
                }
                for index in range(len(current_points))
            ],
        }
    elif metric_key == "wellness":
        base = project_wellness(user_id, horizon_days)
        current_points = base["trajectories"]["current"]
        improved_points = base["trajectories"]["improved"]
        base_stress = float(current_points[0]["stress"]) if current_points else 50.0
        current_score = float(current_points[0]["score"]) if current_points else 0.0

        custom_sleep = inputs.get("sleep_hours", 7.5)
        custom_exercise = inputs.get("exercise_days", 3.0)
        custom_spend = inputs.get("daily_spending", baseline_daily_spend)
        custom_meal = inputs.get("meal_quality", 6.0)

        custom_sleep_score = _clamp(100.0 - abs(custom_sleep - 7.5) * 12.0)
        custom_minutes = (custom_exercise / 7.0) * 45.0
        custom_movement_score = _clamp(min(100.0, (custom_minutes / 120.0) * 100.0))
        custom_diet_score = _clamp(custom_meal * 10.0)
        spend_penalty = _clamp(100.0 - max(0.0, custom_spend - baseline_daily_spend) * 0.2)
        custom_stress = _clamp((base_stress + spend_penalty) / 2.0)

        weights = {"sleep": 0.3, "movement": 0.3, "diet": 0.2, "stress": 0.2}
        custom_score = (
            custom_sleep_score * weights["sleep"]
            + custom_movement_score * weights["movement"]
            + custom_diet_score * weights["diet"]
            + custom_stress * weights["stress"]
        )

        series_map = {
            "current": [
                {"date": point["date"], "value": float(point["score"])} for point in current_points
            ],
            "with_swaps": [
                {"date": point["date"], "value": float(point["score"])} for point in improved_points
            ],
            "custom": [
                {
                    "date": current_points[index]["date"],
                    "value": round(
                        current_score + (custom_score - current_score) * (index / float(max(1, horizon_days))),
                        2,
                    ),
                }
                for index in range(len(current_points))
            ],
        }
    elif metric_key == "sustainability":
        base = project_sustainability(user_id, horizon_days)
        current_points = base["trajectories"]["current"]
        green_points = base["trajectories"]["green_swaps"]

        custom_meal = inputs.get("meal_quality", 6.0)
        custom_exercise = inputs.get("exercise_days", 3.0)
        custom_spend = inputs.get("daily_spending", baseline_daily_spend)

        meal_factor = 1.0 - ((custom_meal - 1.0) / 9.0) * 0.2
        spend_factor = 1.0 + ((custom_spend - baseline_daily_spend) / max(50.0, baseline_daily_spend)) * 0.15
        exercise_factor = 1.0 - (custom_exercise / 7.0) * 0.05
        custom_factor = max(0.6, min(1.4, meal_factor * spend_factor * exercise_factor))

        def _total(point: dict[str, Any]) -> float:
            return float(point["co2e"]) + float(point["water"]) + float(point["waste"])

        series_map = {
            "current": [{"date": point["date"], "value": round(_total(point), 2)} for point in current_points],
            "with_swaps": [{"date": point["date"], "value": round(_total(point), 2)} for point in green_points],
            "custom": [
                {"date": point["date"], "value": round(_total(point) * custom_factor, 2)}
                for point in current_points
            ],
        }
    else:
        raise ValueError("Unsupported metric")

    scenario_order = [scenario.get("name") for scenario in scenarios if scenario.get("name")]
    if not scenario_order:
        scenario_order = ["current", "with_swaps", "custom"]

    for name in scenario_order:
        key = str(name).lower()
        data = series_map.get(key, [])
        final_value = float(data[-1]["value"]) if data else 0.0
        scenario_results.append({"name": key, "data": data, "final_value": round(final_value, 2)})
        scenario_series.append(data)

    divergence_points = []
    if scenario_series and scenario_series[0]:
        length = min(len(series) for series in scenario_series if series)
        for index in range(length):
            values = [series[index]["value"] for series in scenario_series if len(series) > index]
            if not values:
                continue
            impact = max(values) - min(values)
            divergence_points.append(
                {"date": scenario_series[0][index]["date"], "impact": round(float(impact), 2)}
            )
        divergence_points.sort(key=lambda item: item["impact"], reverse=True)
        divergence_points = divergence_points[:3]

    return {"scenarios": scenario_results, "divergence_points": divergence_points}
