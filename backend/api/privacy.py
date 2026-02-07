from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from api.events import get_authenticated_user_id
from db.supabase import get_supabase_client

router = APIRouter()

TABLE_NAME = "privacy_settings"

ProfileVisibility = Literal["public", "friends", "private"]


class PrivacySettingsOut(BaseModel):
    profile_visibility: ProfileVisibility
    activity_sharing: bool
    data_analytics_consent: bool


class PrivacySettingsIn(BaseModel):
    profile_visibility: ProfileVisibility
    activity_sharing: bool
    data_analytics_consent: bool


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Supabase unavailable")
    return supabase


@router.get("/privacy/settings", response_model=PrivacySettingsOut)
def get_privacy_settings(user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    response = (
        supabase.table(TABLE_NAME)
        .select("profile_visibility,activity_sharing,data_analytics_consent")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        return PrivacySettingsOut(
            profile_visibility="friends",
            activity_sharing=True,
            data_analytics_consent=True,
        )
    row = response.data[0]
    return PrivacySettingsOut(
        profile_visibility=row.get("profile_visibility") or "friends",
        activity_sharing=bool(row.get("activity_sharing", True)),
        data_analytics_consent=bool(row.get("data_analytics_consent", True)),
    )


@router.put("/privacy/settings", response_model=PrivacySettingsOut)
def update_privacy_settings(
    payload: PrivacySettingsIn, user_id: str = Depends(get_authenticated_user_id)
):
    supabase = _require_supabase()
    update_payload = {
        "user_id": user_id,
        "profile_visibility": payload.profile_visibility,
        "activity_sharing": payload.activity_sharing,
        "data_analytics_consent": payload.data_analytics_consent,
        "updated_at": datetime.utcnow().isoformat(),
    }
    response = supabase.table(TABLE_NAME).upsert(update_payload, on_conflict="user_id").execute()
    if response.error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(response.error))
    return PrivacySettingsOut(
        profile_visibility=payload.profile_visibility,
        activity_sharing=payload.activity_sharing,
        data_analytics_consent=payload.data_analytics_consent,
    )
