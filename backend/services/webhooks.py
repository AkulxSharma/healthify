import hmac
import json
from datetime import datetime
from hashlib import sha256
from typing import Any
from urllib import request

from db.supabase import get_supabase_client

TABLE_NAME = "webhooks"


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    return supabase


def register_webhook(user_id: str, url: str, events: list[str], secret: str | None) -> dict[str, Any]:
    supabase = _require_supabase()
    payload = {
        "user_id": user_id,
        "url": url,
        "events": events,
        "secret": secret,
        "status": "active",
        "created_at": datetime.utcnow().isoformat(),
    }
    response = supabase.table(TABLE_NAME).insert(payload).execute()
    if not response.data:
        raise RuntimeError("Failed to register webhook")
    return response.data[0]


def list_webhooks(user_id: str) -> list[dict[str, Any]]:
    supabase = _require_supabase()
    response = supabase.table(TABLE_NAME).select("*").eq("user_id", user_id).execute()
    return response.data or []


def delete_webhook(user_id: str, webhook_id: str) -> bool:
    supabase = _require_supabase()
    response = (
        supabase.table(TABLE_NAME)
        .delete()
        .eq("id", webhook_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(response.data)


def trigger_webhook(user_id: str, event_type: str, data: dict[str, Any]) -> list[dict[str, Any]]:
    supabase = _require_supabase()
    response = (
        supabase.table(TABLE_NAME)
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    )
    hooks = response.data or []
    sent: list[dict[str, Any]] = []
    payload = {
        "event": event_type,
        "user_id": user_id,
        "data": data,
        "triggered_at": datetime.utcnow().isoformat(),
    }
    body = json.dumps(payload).encode("utf-8")
    for hook in hooks:
        events = hook.get("events") or []
        if events and event_type not in events:
            continue
        secret = hook.get("secret") or ""
        signature = ""
        if secret:
            signature = hmac.new(secret.encode("utf-8"), body, sha256).hexdigest()
        req = request.Request(hook.get("url"), data=body, method="POST")
        req.add_header("Content-Type", "application/json")
        req.add_header("X-Lifemosaic-Event", event_type)
        if signature:
            req.add_header("X-Lifemosaic-Signature", f"sha256={signature}")
        try:
            with request.urlopen(req, timeout=10) as response_obj:
                _ = response_obj.read()
            sent.append({"id": hook.get("id"), "status": "sent"})
            supabase.table(TABLE_NAME).update({"last_triggered": datetime.utcnow().isoformat()}).eq(
                "id", hook.get("id")
            ).execute()
        except Exception as exc:
            sent.append({"id": hook.get("id"), "status": "failed", "error": str(exc)})
    return sent
