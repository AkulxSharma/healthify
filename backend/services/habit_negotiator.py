import re
from typing import Any, Dict


def _extract_amount(query: str) -> float | None:
    match = re.search(r"\$?\s*([0-9]+(?:\.[0-9]+)?)", query)
    if not match:
        return None
    try:
        return float(match.group(1))
    except Exception:
        return None


def _classify_query(query: str) -> str:
    text = query.lower()
    food_terms = ["pizza", "burger", "fries", "soda", "takeout", "delivery", "taco", "pasta"]
    apparel_terms = ["jacket", "shoes", "sneakers", "coat", "jeans", "shirt"]
    if any(term in text for term in food_terms):
        return "food"
    if any(term in text for term in apparel_terms):
        return "apparel"
    return "general"


def _impact_indicator(severity: str) -> str:
    if severity == "high":
        return "🔴"
    if severity == "medium":
        return "🟡"
    return "🟢"


def analyze_cost_impact(item: str, price: float, user_id: str) -> Dict[str, Any]:
    category = _classify_query(item)
    weekly_budget = 240.0 if category == "food" else 180.0 if category == "apparel" else 160.0
    budget_pct = round((price / max(1.0, weekly_budget)) * 100.0)
    budget_remaining = round(weekly_budget - price, 2)
    opportunity_cost = "Could buy groceries for 2 meals" if price >= 18 else "Could buy groceries for 1 meal"
    if price >= 18:
        weekly_spend_rate = "Above average by 15%"
    elif price >= 10:
        weekly_spend_rate = "Above average by 5%"
    else:
        weekly_spend_rate = "On track"
    if budget_pct >= 15:
        severity = "high"
    elif budget_pct >= 8:
        severity = "medium"
    else:
        severity = "low"
    return {
        "immediate_cost": round(price, 2),
        "budget_impact_pct": budget_pct,
        "budget_remaining": budget_remaining,
        "opportunity_cost": opportunity_cost,
        "weekly_spend_rate": weekly_spend_rate,
        "indicator": _impact_indicator(severity),
        "severity": severity,
    }


def analyze_health_impact(item: str, user_id: str) -> Dict[str, Any]:
    text = item.lower()
    if any(term in text for term in ["pizza", "burger", "fries"]):
        calories = 1200
        nutrition_quality = 4
        protein_g = 45
        sugar_g = 18
        wellness_score_change = -8
    elif any(term in text for term in ["salad", "bowl", "grilled"]):
        calories = 520
        nutrition_quality = 8
        protein_g = 38
        sugar_g = 6
        wellness_score_change = 3
    else:
        calories = 700
        nutrition_quality = 6
        protein_g = 30
        sugar_g = 10
        wellness_score_change = -3
    daily_target = 2000
    calories_remaining = daily_target - calories
    status = "Over budget for meal" if calories >= 800 else "Within meal target"
    if wellness_score_change <= -7 or nutrition_quality <= 4:
        severity = "high"
    elif wellness_score_change <= -3 or nutrition_quality <= 6:
        severity = "medium"
    else:
        severity = "low"
    return {
        "calories": calories,
        "nutrition_quality": nutrition_quality,
        "protein_g": protein_g,
        "sugar_g": sugar_g,
        "wellness_score_change": wellness_score_change,
        "goal_alignment": {
            "daily_calorie_target": daily_target,
            "calories_remaining": calories_remaining,
            "status": status,
        },
        "indicator": _impact_indicator(severity),
        "severity": severity,
    }


def analyze_sustainability_impact(item: str) -> Dict[str, Any]:
    text = item.lower()
    if any(term in text for term in ["pizza", "burger", "fries"]):
        co2e_kg = 2.1
        co2e_comparison = "Like driving 5 miles"
        packaging_waste = "High"
        packaging_details = "Single-use plastic, non-recyclable foam"
        sourcing = "Factory farmed, 200+ miles transport"
        score_change = -15
        baseline_comparison = "30% worse than your average meal"
    elif any(term in text for term in ["salad", "bowl", "grilled"]):
        co2e_kg = 0.9
        co2e_comparison = "Like driving 2 miles"
        packaging_waste = "Low"
        packaging_details = "Compostable bowl"
        sourcing = "Local farms, under 50 miles"
        score_change = 4
        baseline_comparison = "10% better than your average meal"
    else:
        co2e_kg = 1.4
        co2e_comparison = "Like driving 3 miles"
        packaging_waste = "Medium"
        packaging_details = "Mixed materials, limited recyclability"
        sourcing = "Regional suppliers, 100+ miles transport"
        score_change = -6
        baseline_comparison = "5% worse than your average meal"
    if score_change <= -12:
        severity = "high"
    elif score_change <= -6:
        severity = "medium"
    else:
        severity = "low"
    return {
        "co2e_kg": co2e_kg,
        "co2e_comparison": co2e_comparison,
        "packaging_waste": packaging_waste,
        "packaging_details": packaging_details,
        "sourcing": sourcing,
        "score_change": score_change,
        "baseline_comparison": baseline_comparison,
        "indicator": _impact_indicator(severity),
        "severity": severity,
    }


def generate_alternative(item: str, breakdown: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    text = item.lower()
    is_food = _classify_query(item) == "food"
    base_cost = float(breakdown.get("cost_impact", {}).get("immediate_cost") or 18.99)
    if is_food:
        suggestion = "Make margherita pizza at home with store dough" if "pizza" in text else "Cook a lighter bowl at home"
        alt_cost = round(base_cost * 0.34, 2) if base_cost > 0 else 6.5
        calories_saved = max(0, int((breakdown.get("health_impact", {}).get("calories") or 1000) - 800))
        co2e_saved = max(
            0.0, float((breakdown.get("sustainability_impact", {}).get("co2e_kg") or 2.1) - 0.8)
        )
        alt = {
            "suggestion": suggestion,
            "cost": alt_cost or 6.5,
            "cost_saved": round(max(0.0, base_cost - (alt_cost or 6.5)), 2),
            "health_improvement": {
                "calories": 800,
                "calories_saved": calories_saved,
                "nutrition_quality": 7,
                "wellness_change": 15,
            },
            "sustainability_improvement": {
                "co2e_kg": 0.8,
                "co2e_saved": round(co2e_saved, 2),
                "packaging_waste": "Low",
                "score_change": 30,
            },
            "effort": "30 min prep",
            "reasoning": "Saves money and calories, reduces packaging. Fresh ingredients, better control.",
        }
        return alt
    suggestion = "Delay 24 hours and compare prices"
    alt_cost = 0.0
    return {
        "suggestion": suggestion,
        "cost": alt_cost,
        "cost_saved": round(base_cost - alt_cost, 2),
        "health_improvement": {"calories": 0, "calories_saved": 0, "nutrition_quality": 0, "wellness_change": 0},
        "sustainability_improvement": {"co2e_kg": 0.0, "co2e_saved": 0.0, "packaging_waste": "Low", "score_change": 5},
        "effort": "No effort",
        "reasoning": "Avoids impulse spending and improves value assessment.",
    }


def negotiate_decision(user_id: str, query: str, context: Dict[str, Any] | None = None) -> Dict[str, Any]:
    payload = context or {}
    category = _classify_query(query)
    amount = _extract_amount(query)
    base_cost = amount
    if base_cost is None:
        base_cost = 18.99 if category == "food" else 60.0 if category == "apparel" else 25.0
    cost_impact = analyze_cost_impact(query, base_cost, user_id)
    health_impact = analyze_health_impact(query, user_id)
    sustainability_impact = analyze_sustainability_impact(query)
    budget_pct = cost_impact["budget_impact_pct"]
    wellness_change = health_impact["wellness_score_change"]
    answer = "maybe"
    if budget_pct >= 15 or wellness_change <= -7:
        answer = "no"
    elif budget_pct <= 5 and wellness_change >= -3:
        answer = "yes"
    alternative = generate_alternative(
        query,
        {"cost_impact": cost_impact, "health_impact": health_impact, "sustainability_impact": sustainability_impact},
        user_id,
    )
    final_recommendation = "Go with a lighter option to save money and wellness." if category == "food" else "Delay the purchase to reassess value."
    return {
        "query": query,
        "answer": answer,
        "breakdown": {
            "cost_impact": cost_impact,
            "health_impact": health_impact,
            "sustainability_impact": sustainability_impact,
        },
        "alternative": alternative,
        "final_recommendation": final_recommendation,
    }
