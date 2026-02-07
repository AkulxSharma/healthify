import base64
import json
import os
from datetime import datetime, timedelta
from typing import Any
from urllib import request, parse

from db.supabase import get_supabase_client
from models.events import EventCreate
from services.event_service import create_event

PROVIDER = "google_calendar"
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


def _request_json(url: str, data: dict[str, Any] | None = None, headers: dict[str, str] | None = None) -> Any:
    payload = None
    if data is not None:
        payload = json.dumps(data).encode("utf-8")
    req = request.Request(url, data=payload, headers=headers or {}, method="POST" if data else "GET")
    with request.urlopen(req, timeout=15) as response:
        body = response.read().decode("utf-8")
    return json.loads(body) if body else {}


def connect_google_calendar(user_id: str, auth_code: str) -> dict[str, Any]:
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    if not client_id or not client_secret or not redirect_uri:
        raise RuntimeError("Google OAuth configuration is missing")
    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "code": auth_code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }
    encoded = parse.urlencode(payload).encode("utf-8")
    req = request.Request(token_url, data=encoded, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with request.urlopen(req, timeout=15) as response:
        body = response.read().decode("utf-8")
    token_payload = json.loads(body)
    access_token = token_payload.get("access_token")
    refresh_token = token_payload.get("refresh_token")
    expires_in = int(token_payload.get("expires_in") or 0)
    expires_at = datetime.utcnow() + timedelta(seconds=expires_in) if expires_in else None
    supabase = _require_supabase()
    record = {
        "user_id": user_id,
        "provider": PROVIDER,
        "access_token": _encrypt_token(access_token),
        "refresh_token": _encrypt_token(refresh_token),
        "expires_at": expires_at.isoformat() if expires_at else None,
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


def sync_events(user_id: str, days: int = 30) -> dict[str, Any]:
    row = _integration_row(user_id)
    if not row:
        raise RuntimeError("Google Calendar integration not found")
    access_token = _decrypt_token(row.get("access_token"))
    if not access_token:
        raise RuntimeError("Missing Google access token")
    time_min = (datetime.utcnow() - timedelta(days=days)).isoformat() + "Z"
    params = parse.urlencode({"timeMin": time_min, "maxResults": 50, "singleEvents": "true"})
    url = f"https://www.googleapis.com/calendar/v3/calendars/primary/events?{params}"
    headers = {"Authorization": f"Bearer {access_token}"}
    payload = _request_json(url, headers=headers)
    items = payload.get("items") or []
    created_events: list[str] = []
    for item in items:
        summary = item.get("summary") or "Calendar event"
        start = (item.get("start") or {}).get("dateTime") or (item.get("start") or {}).get("date")
        timestamp = datetime.utcnow().isoformat()
        if start:
            timestamp = str(start).replace("Z", "+00:00")
        event = EventCreate(
            user_id=user_id,
            event_type="work",
            category="productivity",
            title=summary,
            timestamp=datetime.fromisoformat(timestamp.replace("Z", "+00:00")),
            metadata={
                "location": item.get("location"),
                "notes": item.get("description"),
                "type": "calendar",
                "calendar_event_id": item.get("id"),
                "calendar_source": "google",
            },
        )
        created = create_event(event)
        created_events.append(created.id)
    supabase = _require_supabase()
    supabase.table(TABLE_NAME).update({"last_sync": datetime.utcnow().isoformat()}).eq("id", row.get("id")).execute()
    return {"synced": len(created_events), "event_ids": created_events}


def export_to_calendar(user_id: str, event_id: str) -> dict[str, Any]:
    row = _integration_row(user_id)
    if not row:
        raise RuntimeError("Google Calendar integration not found")
    access_token = _decrypt_token(row.get("access_token"))
    if not access_token:
        raise RuntimeError("Missing Google access token")
    supabase = _require_supabase()
    event_rows = (
        supabase.table("events")
        .select("title,timestamp,metadata")
        .eq("id", event_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not event_rows:
        raise RuntimeError("Event not found")
    event = event_rows[0]
    title = event.get("title") or "LifeMosaic event"
    timestamp = event.get("timestamp") or datetime.utcnow().isoformat()
    metadata = event.get("metadata") or {}
    start_dt = datetime.fromisoformat(str(timestamp).replace("Z", "+00:00"))
    duration = int(metadata.get("duration_minutes") or 60)
    end_dt = start_dt + timedelta(minutes=duration)
    payload = {
        "summary": title,
        "description": metadata.get("notes"),
        "location": metadata.get("location"),
        "start": {"dateTime": start_dt.isoformat()},
        "end": {"dateTime": end_dt.isoformat()},
    }
    url = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    created = _request_json(url, data=payload, headers=headers)
    return {"status": "exported", "calendar_event_id": created.get("id")}
