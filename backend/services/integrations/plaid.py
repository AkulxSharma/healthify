import base64
import json
import os
from datetime import datetime, timedelta
from typing import Any
from urllib import request

from db.supabase import get_supabase_client
from models.events import EventCreate
from services.event_service import create_event

PROVIDER = "plaid"
TABLE_NAME = "integrations"


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    return supabase


def _crypto_key() -> bytes:
    key = os.getenv("INTEGRATIONS_CRYPTO_KEY")
    if not key:
        raise RuntimeError("Integrations crypto key missing")
    return key.encode("utf-8")


def _xor_bytes(payload: bytes, key: bytes) -> bytes:
    key_len = len(key)
    return bytes(b ^ key[i % key_len] for i, b in enumerate(payload))


def _encrypt_token(token: str | None) -> str | None:
    if not token:
        return None
    key = _crypto_key()
    raw = token.encode("utf-8")
    encrypted = _xor_bytes(raw, key)
    return base64.urlsafe_b64encode(encrypted).decode("utf-8")


def _decrypt_token(token: str | None) -> str | None:
    if not token:
        return None
    key = _crypto_key()
    raw = base64.urlsafe_b64decode(token.encode("utf-8"))
    decrypted = _xor_bytes(raw, key)
    return decrypted.decode("utf-8")


def _plaid_base_url() -> str:
    env = os.getenv("PLAID_ENV", "sandbox").lower()
    if env == "production":
        return "https://production.plaid.com"
    if env == "development":
        return "https://development.plaid.com"
    return "https://sandbox.plaid.com"


def _plaid_headers() -> dict[str, str]:
    return {"Content-Type": "application/json"}


def _plaid_request(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{_plaid_base_url()}{path}"
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, method="POST", headers=_plaid_headers())
    with request.urlopen(req, timeout=20) as response:
        body = response.read().decode("utf-8")
    return json.loads(body) if body else {}


def connect_bank_account(user_id: str, public_token: str) -> dict[str, Any]:
    client_id = os.getenv("PLAID_CLIENT_ID")
    secret = os.getenv("PLAID_SECRET")
    if not client_id or not secret:
        raise RuntimeError("Plaid configuration is missing")
    payload = {"client_id": client_id, "secret": secret, "public_token": public_token}
    exchange = _plaid_request("/item/public_token/exchange", payload)
    access_token = exchange.get("access_token")
    if not access_token:
        raise RuntimeError("Unable to exchange Plaid token")
    supabase = _require_supabase()
    record = {
        "user_id": user_id,
        "provider": PROVIDER,
        "access_token": _encrypt_token(access_token),
        "status": "active",
    }
    response = supabase.table(TABLE_NAME).upsert(record, on_conflict="user_id,provider").execute()
    if not response.data:
        raise RuntimeError("Failed to save integration")
    return response.data[0]


def _integration_row(user_id: str) -> dict[str, Any] | None:
    supabase = _require_supabase()
    response = (
        supabase.table(TABLE_NAME)
        .select("*")
        .eq("user_id", user_id)
        .eq("provider", PROVIDER)
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None


def _categorize(categories: list[str]) -> str:
    lowered = " ".join([c.lower() for c in categories])
    if any(token in lowered for token in ["food", "restaurant", "grocer", "dining", "coffee"]):
        return "food"
    if any(token in lowered for token in ["transport", "rideshare", "gas", "transit", "travel"]):
        return "transport"
    if any(token in lowered for token in ["shopping", "retail", "clothing", "electronics"]):
        return "shopping"
    if any(token in lowered for token in ["health", "medical", "pharmacy"]):
        return "health"
    if any(token in lowered for token in ["entertainment", "stream", "movie", "music"]):
        return "entertainment"
    return "other"


def sync_transactions(user_id: str, days: int = 30) -> dict[str, Any]:
    row = _integration_row(user_id)
    if not row:
        raise RuntimeError("Plaid integration not found")
    access_token = _decrypt_token(row.get("access_token"))
    if not access_token:
        raise RuntimeError("Missing Plaid access token")
    client_id = os.getenv("PLAID_CLIENT_ID")
    secret = os.getenv("PLAID_SECRET")
    if not client_id or not secret:
        raise RuntimeError("Plaid configuration is missing")
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days)
    payload = {
        "client_id": client_id,
        "secret": secret,
        "access_token": access_token,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "options": {"count": 50, "offset": 0},
    }
    transactions = _plaid_request("/transactions/get", payload)
    items = transactions.get("transactions") or []
    created_ids: list[str] = []
    for item in items:
        amount = float(item.get("amount") or 0)
        name = item.get("name") or "Bank transaction"
        date_str = item.get("date") or end_date.isoformat()
        categories = item.get("category") or []
        category_label = _categorize(categories)
        event = EventCreate(
            user_id=user_id,
            event_type="spending",
            category="finance",
            title=name,
            amount=amount,
            timestamp=datetime.fromisoformat(date_str),
            metadata={
                "merchant": item.get("merchant_name") or name,
                "category": category_label,
                "notes": item.get("payment_channel"),
                "type": "plaid",
                "plaid_transaction_id": item.get("transaction_id"),
            },
        )
        created = create_event(event)
        created_ids.append(created.id)
    supabase = _require_supabase()
    supabase.table(TABLE_NAME).update({"last_sync": datetime.utcnow().isoformat()}).eq("id", row.get("id")).execute()
    return {"synced": len(created_ids), "event_ids": created_ids}
