import base64
import io
import json
import os
from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, Field, ValidationError

MealType = Literal["breakfast", "lunch", "dinner", "snack"]


class FoodAnalysis(BaseModel):
    meal_name: str
    estimated_calories: float | None = None
    ingredients: list[str] = Field(default_factory=list)
    nutrition_quality: int = Field(
        ...,
        ge=1,
        le=10,
        validation_alias=AliasChoices("nutrition_quality", "nutrition_quality_score"),
        serialization_alias="nutrition_quality",
    )
    protein_g: float | None = None
    sugar_g: float | None = None
    fat_g: float | None = None
    cost_estimate: float | None = None
    sustainability_score: int = Field(..., ge=1, le=10)
    meal_type: MealType | None = None


def _get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    from openai import OpenAI
    return OpenAI(api_key=api_key)


def _extract_json(content: str) -> dict[str, Any]:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(content[start : end + 1])


def _guess_mime(image_bytes: bytes) -> str:
    if image_bytes.startswith(b"\x89PNG"):
        return "image/png"
    if image_bytes.startswith(b"\xff\xd8"):
        return "image/jpeg"
    return "application/octet-stream"


def _analysis_schema() -> dict[str, Any]:
    return {
        "name": "food_analysis",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "meal_name": {"type": "string"},
                "estimated_calories": {"type": ["number", "null"]},
                "ingredients": {"type": "array", "items": {"type": "string"}},
                "nutrition_quality": {"type": "integer", "minimum": 1, "maximum": 10},
                "protein_g": {"type": ["number", "null"]},
                "sugar_g": {"type": ["number", "null"]},
                "fat_g": {"type": ["number", "null"]},
                "cost_estimate": {"type": ["number", "null"]},
                "sustainability_score": {"type": "integer", "minimum": 1, "maximum": 10},
                "meal_type": {
                    "type": ["string", "null"],
                    "enum": ["breakfast", "lunch", "dinner", "snack", None],
                },
            },
            "required": [
                "meal_name",
                "estimated_calories",
                "ingredients",
                "nutrition_quality",
                "protein_g",
                "sugar_g",
                "fat_g",
                "cost_estimate",
                "sustainability_score",
                "meal_type",
            ],
        },
        "strict": True,
    }


def _parse_analysis(payload: dict[str, Any]) -> FoodAnalysis:
    try:
        return FoodAnalysis.model_validate(payload)
    except ValidationError as exc:
        raise RuntimeError("Unable to parse food analysis") from exc


def analyze_food_photo(image_bytes: bytes) -> dict[str, Any]:
    mime_type = _guess_mime(image_bytes)
    if mime_type == "application/octet-stream":
        raise RuntimeError("Unsupported image format")
    data_url = f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode('utf-8')}"
    prompt = (
        "Analyze this meal. Return JSON: {meal_name, ingredients[], estimated_calories, "
        "protein_g, sugar_g, fat_g, nutrition_quality: 1-10, cost_estimate, "
        "sustainability_score: 1-10, meal_type}."
    )
    client = _get_openai_client()
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_schema", "json_schema": _analysis_schema()},
        messages=[
            {"role": "system", "content": "You analyze meals and return structured JSON."},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
    )
    content = completion.choices[0].message.content or ""
    parsed = _parse_analysis(_extract_json(content))
    return parsed.model_dump(by_alias=True)


def analyze_food_description(text: str) -> dict[str, Any]:
    if not text.strip():
        raise RuntimeError("Description is required")
    prompt = (
        "Analyze this meal. Return JSON: {meal_name, ingredients[], estimated_calories, "
        "protein_g, sugar_g, fat_g, nutrition_quality: 1-10, cost_estimate, "
        "sustainability_score: 1-10, meal_type}.\n\nDescription:"
    )
    client = _get_openai_client()
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_schema", "json_schema": _analysis_schema()},
        messages=[
            {"role": "system", "content": "You analyze meals and return structured JSON."},
            {"role": "user", "content": f"{prompt} {text}"},
        ],
    )
    content = completion.choices[0].message.content or ""
    parsed = _parse_analysis(_extract_json(content))
    return parsed.model_dump(by_alias=True)


def analyze_food_audio(audio_bytes: bytes) -> dict[str, Any]:
    if not audio_bytes:
        raise RuntimeError("Audio is required")
    client = _get_openai_client()
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = "food.webm"
    transcript = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
    )
    text = transcript.text or ""
    if not text.strip():
        raise RuntimeError("Unable to transcribe audio")
    return analyze_food_description(text)
