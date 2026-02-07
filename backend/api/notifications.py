from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from api.events import get_authenticated_user_id
from db.supabase import get_supabase_client
from services.alert_service import get_alerts, mark_alert_read

router = APIRouter()

PREFERENCES_TABLE = "notification_preferences"


class NotificationPreferencesIn(BaseModel):
    email: bool = Field(default=True)
    push: bool = Field(default=False)
    alert_types: dict[str, bool] = Field(default_factory=dict)


class NotificationPreferencesOut(BaseModel):
    email_enabled: bool
    push_enabled: bool
    alert_types: dict[str, bool]
    frequency: str


class AlertOut(BaseModel):
    id: str
    alert_type: str
    title: str
    message: str
    action_link: str | None = None
    read: bool
    created_at: str


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not configured",
        )
    return supabase


def _default_alert_types() -> dict[str, bool]:
    return {"insights": True, "goals": True, "social": True, "reminders": True}


@router.get("/notifications/preferences", response_model=NotificationPreferencesOut)
def get_preferences(user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    response = (
        supabase.table(PREFERENCES_TABLE)
        .select("email_enabled,push_enabled,alert_types,frequency")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        return NotificationPreferencesOut(
            email_enabled=True,
            push_enabled=False,
            alert_types=_default_alert_types(),
            frequency="weekly",
        )
    row = response.data[0]
    return NotificationPreferencesOut(
        email_enabled=bool(row.get("email_enabled")),
        push_enabled=bool(row.get("push_enabled")),
        alert_types=row.get("alert_types") or _default_alert_types(),
        frequency=row.get("frequency") or "weekly",
    )


@router.put("/notifications/preferences", response_model=NotificationPreferencesOut)
def update_preferences(payload: NotificationPreferencesIn, user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    alert_types = _default_alert_types()
    alert_types.update(payload.alert_types or {})
    update_payload: dict[str, Any] = {
        "user_id": user_id,
        "email_enabled": payload.email,
        "push_enabled": payload.push,
        "alert_types": alert_types,
        "frequency": "weekly",
        "updated_at": datetime.utcnow().isoformat(),
    }
    existing = (
        supabase.table(PREFERENCES_TABLE).select("id").eq("user_id", user_id).limit(1).execute()
    )
    if existing.data:
        response = (
            supabase.table(PREFERENCES_TABLE)
            .update(update_payload)
            .eq("user_id", user_id)
            .execute()
        )
    else:
        update_payload["created_at"] = datetime.utcnow().isoformat()
        response = supabase.table(PREFERENCES_TABLE).insert(update_payload).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save preferences"
        )
    row = response.data[0]
    return NotificationPreferencesOut(
        email_enabled=bool(row.get("email_enabled")),
        push_enabled=bool(row.get("push_enabled")),
        alert_types=row.get("alert_types") or _default_alert_types(),
        frequency=row.get("frequency") or "weekly",
    )


@router.get("/alerts", response_model=list[AlertOut])
def list_alerts(
    unread: bool = Query(False),
    user_id: str = Depends(get_authenticated_user_id),
):
    alerts = get_alerts(user_id, unread_only=unread)
    return [AlertOut(**row) for row in alerts]


@router.post("/alerts/{alert_id}/read")
def read_alert(alert_id: str, user_id: str = Depends(get_authenticated_user_id)):
    ok = mark_alert_read(user_id, alert_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return {"status": "ok"}
