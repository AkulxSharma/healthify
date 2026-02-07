from __future__ import annotations

from typing import Any


def suggest_healthier_swap(meal_data: dict[str, Any]) -> dict[str, Any]:
    calories = _number(meal_data.get("estimated_calories"), 650)
    sugar = _number(meal_data.get("sugar_g"), 12)
    protein = _number(meal_data.get("protein_g"), 25)
    nutrition_quality = int(_number(meal_data.get("nutrition_quality"), 5))
    ingredients = _ingredients(meal_data)
    name = str(meal_data.get("meal_name") or "").lower()

    reasons: list[str] = []
    alternative = "Balanced grain bowl with lean protein"
    if _is_meat_heavy(ingredients, name):
        alternative = "Grilled chicken salad with olive oil"
        reasons.append("Shift from heavy meats to lean protein and greens")
    if _is_processed(ingredients, name):
        alternative = "Whole-food bowl with roasted vegetables"
        reasons.append("Swap processed items for whole foods")
    if sugar > 30:
        alternative = "Low-sugar yogurt parfait with berries"
        reasons.append("Cut added sugar with natural sweetness")
    if calories > 800:
        reasons.append("Reduce portion size for a lighter option")

    new_calories = max(300, calories - _clamp(calories * 0.35, 150, 400))
    protein_diff = 5 if protein else 0
    sugar_reduced = int(_clamp(sugar * 0.5, 8, 20)) if sugar else 0
    new_nutrition_quality = min(10, max(nutrition_quality + 3, 8))

    return {
        "alternative": alternative,
        "calories": round(new_calories, 1),
        "nutrition_quality": new_nutrition_quality,
        "comparison": {
            "calories_saved": round(calories - new_calories, 1),
            "protein_diff": protein_diff,
            "sugar_reduced": sugar_reduced,
        },
        "reasoning": _join_reasons(reasons)
        or "Replace heavy, sugary components with lighter, whole-food options.",
    }


def suggest_cheaper_swap(meal_data: dict[str, Any]) -> dict[str, Any]:
    cost = _number(meal_data.get("cost_estimate"), 14)
    ingredients = _ingredients(meal_data)
    name = str(meal_data.get("meal_name") or "").lower()

    reasons: list[str] = []
    alternative = "Make a simple stir-fry at home"
    availability = "Ingredients at Walmart/Aldi"

    if _is_delivery(name):
        alternative = "Batch-cook the same meal at home"
        reasons.append("Skip delivery fees with meal prep")
    if _is_restaurant(name):
        alternative = "Recreate the dish at home"
        reasons.append("Restaurant markups raise the total cost")
    if _is_premium_brand(name, ingredients):
        reasons.append("Switch to store-brand staples")

    new_cost = max(3.5, cost * (0.45 if reasons else 0.6))
    savings = max(0, cost - new_cost)

    return {
        "alternative": alternative,
        "cost_estimate": round(new_cost, 2),
        "savings": round(savings, 2),
        "availability": availability,
        "reasoning": _join_reasons(reasons)
        or "Use pantry staples and cook at home for lower cost.",
    }


def suggest_eco_swap(meal_data: dict[str, Any]) -> dict[str, Any]:
    sustainability = int(_number(meal_data.get("sustainability_score"), 5))
    calories = _number(meal_data.get("estimated_calories"), 650)
    ingredients = _ingredients(meal_data)
    name = str(meal_data.get("meal_name") or "").lower()

    reasons: list[str] = []
    alternative = "Seasonal vegetable grain bowl"
    if _is_meat_heavy(ingredients, name):
        alternative = "Plant-based bowl with legumes"
        reasons.append("Reduce animal-based footprint")
    if _is_processed(ingredients, name):
        alternative = "Whole-food salad with local produce"
        reasons.append("Cut packaging and processing impact")

    new_sustainability = min(10, max(sustainability + 3, 8))
    sustainability_gain = new_sustainability - sustainability
    co2_saved = round(max(0.0, sustainability_gain * 0.6), 2)

    return {
        "alternative": alternative,
        "calories": round(max(300, calories - 200), 1),
        "nutrition_quality": min(10, max(int(_number(meal_data.get("nutrition_quality"), 5)) + 2, 7)),
        "sustainability_score": new_sustainability,
        "co2_saved": co2_saved,
        "comparison": {
            "sustainability_gain": sustainability_gain,
        },
        "reasoning": _join_reasons(reasons)
        or "Favor local, plant-forward ingredients to improve sustainability.",
    }


def suggest_all_alternatives(meal_data: dict[str, Any]) -> dict[str, Any]:
    healthier = suggest_healthier_swap(meal_data)
    cheaper = suggest_cheaper_swap(meal_data)
    eco = suggest_eco_swap(meal_data)

    scores = {
        "healthier": _score_healthier(healthier),
        "cheaper": _score_cheaper(cheaper),
        "eco": _score_eco(eco),
    }
    best_balanced = max(scores.items(), key=lambda item: item[1])[0]

    return {
        "healthier": healthier,
        "cheaper": cheaper,
        "eco": eco,
        "best_balanced": best_balanced,
    }


def _score_healthier(alternative: dict[str, Any]) -> float:
    nutrition_quality = _number(alternative.get("nutrition_quality"), 0)
    calories = _number(alternative.get("calories"), 700)
    comparison = alternative.get("comparison") or {}
    calories_saved = _number(comparison.get("calories_saved"), 0)
    score = nutrition_quality * 2
    score += max(0.0, (800 - calories) / 50)
    score += calories_saved / 40
    return score


def _score_cheaper(alternative: dict[str, Any]) -> float:
    savings = _number(alternative.get("savings"), 0)
    cost_estimate = _number(alternative.get("cost_estimate"), 12)
    score = savings * 2
    score += max(0.0, 14 - cost_estimate)
    return score


def _score_eco(alternative: dict[str, Any]) -> float:
    sustainability = _number(alternative.get("sustainability_score"), 0)
    co2_saved = _number(alternative.get("co2_saved"), 0)
    score = sustainability * 2
    score += co2_saved
    return score


def _ingredients(meal_data: dict[str, Any]) -> list[str]:
    raw = meal_data.get("ingredients") or []
    return [str(item).lower() for item in raw if str(item).strip()]


def _number(value: Any, fallback: float) -> float:
    if value is None:
        return fallback
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _is_processed(ingredients: list[str], name: str) -> bool:
    keywords = [
        "fried",
        "nugget",
        "pizza",
        "soda",
        "chips",
        "processed",
        "instant",
        "sugary",
        "bacon",
        "sausage",
        "fast food",
    ]
    return _contains_any(ingredients, name, keywords)


def _is_meat_heavy(ingredients: list[str], name: str) -> bool:
    keywords = ["beef", "pork", "bacon", "chicken", "steak", "sausage", "lamb", "turkey"]
    return _contains_any(ingredients, name, keywords)


def _is_restaurant(name: str) -> bool:
    return any(token in name for token in ["restaurant", "bistro", "cafe", "takeout"])


def _is_delivery(name: str) -> bool:
    return any(token in name for token in ["delivery", "uber eats", "doordash", "grubhub"])


def _is_premium_brand(name: str, ingredients: list[str]) -> bool:
    keywords = ["premium", "organic", "artisan", "gourmet", "brand"]
    return _contains_any(ingredients, name, keywords)


def _contains_any(ingredients: list[str], name: str, keywords: list[str]) -> bool:
    lowered = " ".join(ingredients + [name])
    return any(keyword in lowered for keyword in keywords)


def _join_reasons(reasons: list[str]) -> str:
    return "; ".join(dict.fromkeys(reasons))
