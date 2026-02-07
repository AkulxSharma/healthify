from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from api.events import get_authenticated_user_id
from db.supabase import get_supabase_client
from services.integrations.calendar import connect_google_calendar, export_to_calendar, sync_events
from services.integrations.plaid import connect_bank_account, sync_transactions

router = APIRouter()


class CalendarConnectIn(BaseModel):
    auth_code: str = Field(..., min_length=3)


class PlaidConnectIn(BaseModel):
    public_token: str = Field(..., min_length=3)


class SyncOut(BaseModel):
    synced: int


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not configured",
        )
    return supabase


@router.get("/integrations")
def list_integrations(user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    response = supabase.table("integrations").select("*").eq("user_id", user_id).execute()
    return response.data or []


@router.post("/integrations/calendar/connect")
def calendar_connect(payload: CalendarConnectIn, user_id: str = Depends(get_authenticated_user_id)):
    try:
        integration = connect_google_calendar(user_id, payload.auth_code)
        return {"status": "connected", "integration": integration}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/integrations/plaid/connect")
def plaid_connect(payload: PlaidConnectIn, user_id: str = Depends(get_authenticated_user_id)):
    try:
        integration = connect_bank_account(user_id, payload.public_token)
        return {"status": "connected", "integration": integration}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/integrations/{provider}/sync", response_model=SyncOut)
def sync_provider(
    provider: str,
    days: int = Query(30, ge=1, le=365),
    user_id: str = Depends(get_authenticated_user_id),
):
    try:
        if provider in {"calendar", "google_calendar"}:
            result = sync_events(user_id, days=days)
            return SyncOut(synced=int(result.get("synced") or 0))
        if provider in {"plaid", "bank"}:
            result = sync_transactions(user_id, days=days)
            return SyncOut(synced=int(result.get("synced") or 0))
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown provider")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post("/integrations/calendar/export")
def calendar_export(event_id: str = Query(..., min_length=1), user_id: str = Depends(get_authenticated_user_id)):
    try:
        result = export_to_calendar(user_id, event_id)
        return {"status": "ok", "result": result}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
