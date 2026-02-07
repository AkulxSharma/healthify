from typing import Any, Dict

from services.config_loader import get_scoring_rules


def _clamp(value: float, min_value: float = -100.0, max_value: float = 100.0) -> float:
    return max(min_value, min(max_value, value))


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def _pick_profile(rules: dict[str, Any], user_profile: str | None) -> dict[str, Any]:
    profiles = rules.get("profiles") or {}
    if user_profile and user_profile in profiles:
        return profiles[user_profile]
    if "Student" in profiles:
        return profiles["Student"]
    return next(iter(profiles.values()), {})


def _join_explanations(parts: list[str]) -> str:
    return ", ".join([part for part in parts if part])


def compute_event_scores(
    event_type: str,
    category: str,
    amount: Any = None,
    metadata: Dict[str, Any] | None = None,
    user_profile: str | None = None,
) -> Dict[str, Any]:
    m = metadata or {}
    rules = get_scoring_rules()
    profile_rules = _pick_profile(rules, user_profile)
    food_rules = profile_rules.get("food", {})
    movement_rules = profile_rules.get("movement", {})
    sleep_rules = profile_rules.get("sleep", {})
    sustainability_rules = rules.get("sustainability", {})

    wellness = 0
    cost = 0.0
    sustainability = 0

    et = (event_type or "").lower()
    cat = (category or "").lower()

    amt_num = _safe_float(amount)
    wellness_explanations: list[str] = []
    cost_explanations: list[str] = []
    sustainability_explanations: list[str] = []

    if et == "food":
        quality_flag = str(m.get("category", "")).lower()
        ingredients = m.get("ingredients") or []
        nutrition_quality_score = _safe_float(m.get("nutrition_quality_score"))

        healthy_bonus = float(food_rules.get("healthy_bonus", 50))
        junk_penalty = float(food_rules.get("junk_penalty", -30))
        if nutrition_quality_score is not None:
            if nutrition_quality_score >= 7:
                wellness += healthy_bonus
                wellness_explanations.append(f"Healthy meal (+{int(healthy_bonus)})")
            elif nutrition_quality_score <= 3:
                wellness += junk_penalty
                wellness_explanations.append(f"Low quality meal ({int(junk_penalty)})")
        else:
            if any(key in quality_flag for key in ["healthy", "salad", "whole", "fresh"]):
                wellness += healthy_bonus
                wellness_explanations.append(f"Healthy meal (+{int(healthy_bonus)})")
            elif any(key in quality_flag for key in ["junk", "fast", "fried", "processed"]):
                wellness += junk_penalty
                wellness_explanations.append(f"Low quality meal ({int(junk_penalty)})")

        food_sustainability = sustainability_rules.get("food", {})
        names = [str(i).lower() for i in ingredients if isinstance(i, str)]
        if any(n in names for n in ["tofu", "bean", "beans", "lentil", "vegetable", "veggie", "salad"]):
            value = float(food_sustainability.get("plant_based", 40))
            sustainability += value
            sustainability_explanations.append(f"Plant-based (+{int(value)})")
        if any(n in names for n in ["beef", "pork", "lamb", "meat", "steak", "chicken"]):
            value = float(food_sustainability.get("meat", -30))
            sustainability += value
            sustainability_explanations.append(f"Meat ({int(value)})")
        if any(n in names for n in ["processed", "frozen", "packaged", "chips", "soda"]):
            value = float(food_sustainability.get("processed", -20))
            sustainability += value
            sustainability_explanations.append(f"Processed ({int(value)})")

    elif et == "movement":
        duration = _safe_float(m.get("duration_minutes")) or (amt_num or 0)
        per_minute = float(movement_rules.get("per_minute", 2))
        max_score = float(movement_rules.get("max", 100))
        movement_score = min(max_score, (duration or 0) * per_minute)
        wellness += movement_score
        if duration and duration > 0:
            wellness_explanations.append(f"Movement {int(duration)} min (+{int(movement_score)})")
        activity_type = str(m.get("type", "")).lower()
        transport_rules = sustainability_rules.get("transport", {})
        if "walk" in activity_type:
            value = float(transport_rules.get("walk", 50))
            sustainability += value
            sustainability_explanations.append(f"Walking (+{int(value)})")
        elif "bike" in activity_type:
            value = float(transport_rules.get("bike", 45))
            sustainability += value
            sustainability_explanations.append(f"Biking (+{int(value)})")
        elif "car" in activity_type or "drive" in activity_type:
            value = float(transport_rules.get("car", -30))
            sustainability += value
            sustainability_explanations.append(f"Car travel ({int(value)})")

    elif et == "sleep":
        hours = amt_num or _safe_float(m.get("hours"))
        if hours is not None:
            optimal_min = float(sleep_rules.get("optimal_min", 7))
            optimal_max = float(sleep_rules.get("optimal_max", 8))
            penalty = float(sleep_rules.get("penalty_per_hour", -10))
            if optimal_min <= hours <= optimal_max:
                wellness_explanations.append("Optimal sleep window (0)")
            else:
                if hours < optimal_min:
                    diff = optimal_min - hours
                else:
                    diff = hours - optimal_max
                wellness += diff * penalty
                wellness_explanations.append(f"Sleep deviation {diff:.1f}h ({int(diff * penalty)})")

    elif et == "social":
        wellness = 30
        wellness_explanations.append("Social connection (+30)")

    if amt_num is not None:
        if et == "spending":
            cost = -abs(amt_num)
            cost_explanations.append(f"Spent ${abs(amt_num):.2f}")
        elif cat == "finance":
            cost = amt_num
            cost_explanations.append(f"Income ${amt_num:.2f}")

    wellness = _clamp(wellness)
    sustainability = _clamp(sustainability)

    return {
        "wellness_impact": wellness,
        "cost_impact": round(cost, 2),
        "sustainability_impact": sustainability,
        "explanations": {
            "wellness": _join_explanations(wellness_explanations) or "No wellness impact.",
            "cost": _join_explanations(cost_explanations) or "No cost impact.",
            "sustainability": _join_explanations(sustainability_explanations) or "No sustainability impact.",
        },
    }
