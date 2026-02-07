import base64
import json
import os
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError


class ReceiptItem(BaseModel):
    name: str
    quantity: float | None = None
    price: float | None = None


ReceiptCategory = Literal["Food", "Transport", "Shopping", "Entertainment", "Health", "Other"]


class ReceiptExtraction(BaseModel):
    total_amount: float | None = None
    merchant: str | None = None
    date: datetime | None = None
    category: ReceiptCategory | None = None
    items: list[ReceiptItem] = Field(default_factory=list)
    suggested_category: ReceiptCategory | None = None
    raw_text: str | None = None


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


def process_receipt_image(image_bytes: bytes) -> dict[str, Any]:
    mime_type = _guess_mime(image_bytes)
    if mime_type == "application/octet-stream":
        raise RuntimeError("Unsupported image format")
    data_url = f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode('utf-8')}"

    schema = {
        "name": "receipt_extraction",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "total_amount": {"type": ["number", "null"]},
                "merchant": {"type": ["string", "null"]},
                "date": {"type": ["string", "null"], "description": "ISO-8601 date-time string"},
                "category": {
                    "type": ["string", "null"],
                    "enum": ["Food", "Transport", "Shopping", "Entertainment", "Health", "Other", None],
                },
                "suggested_category": {
                    "type": ["string", "null"],
                    "enum": ["Food", "Transport", "Shopping", "Entertainment", "Health", "Other", None],
                },
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "name": {"type": "string"},
                            "quantity": {"type": ["number", "null"]},
                            "price": {"type": ["number", "null"]},
                            "category": {
                                "type": ["string", "null"],
                                "enum": ["Food", "Transport", "Shopping", "Entertainment", "Health", "Other", None],
                            },
                        },
                        "required": ["name"],
                    },
                },
                "raw_text": {"type": ["string", "null"]},
            },
            "required": ["total_amount", "merchant", "date", "category", "items"],
        },
        "strict": True,
    }

    prompt = (
        "Extract: total_amount (number), merchant (string), date (ISO), items: [{name, price, category}]. "
        "Suggest spending category, and include raw_text of the receipt. Return JSON."
    )

    client = _get_openai_client()
    completion = client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_schema", "json_schema": schema},
        messages=[
            {"role": "system", "content": "You extract structured data from receipt images."},
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
    payload = _extract_json(content)
    try:
        parsed = ReceiptExtraction.model_validate(payload)
    except ValidationError as exc:
        raise RuntimeError("Unable to parse receipt data") from exc

    return {
        "total_amount": parsed.total_amount,
        "merchant": parsed.merchant,
        "date": parsed.date.isoformat() if parsed.date else None,
        "category": parsed.category,
        "items": [item.model_dump() for item in parsed.items],
        "suggested_category": parsed.suggested_category,
        "raw_text": parsed.raw_text,
    }
