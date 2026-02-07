from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from db.supabase import get_supabase_client
from services.email_service import send_email_verification_email

router = APIRouter()

PROFILES_TABLE = "profiles"
TOKEN_TTL_HOURS = 24
logger = logging.getLogger(__name__)


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not configured",
        )
    return supabase


def _extract_users(result: Any) -> list[Any]:
    if hasattr(result, "users"):
        return list(result.users or [])
    if hasattr(result, "data"):
        return list(result.data or [])
    if isinstance(result, dict):
        return list(result.get("users") or result.get("data") or [])
    return []


def _get_user_by_email(email: str) -> Any | None:
    supabase = _require_supabase()
    response = supabase.auth.admin.list_users()
    users = _extract_users(response)
    target = email.strip().lower()
    for user in users:
        value = user.email if hasattr(user, "email") else user.get("email")
        if value and str(value).lower() == target:
            return user
    return None


def _get_base_url() -> str:
    return (
        os.getenv("EMAIL_VERIFICATION_URL")
        or os.getenv("APP_URL")
        or os.getenv("LIFEMOSAIC_APP_URL")
        or "http://localhost:3000"
    )

def _is_env_true(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _is_production() -> bool:
    return os.getenv("ENVIRONMENT", "").lower() == "production" or os.getenv("APP_ENV", "").lower() == "production" or os.getenv("NODE_ENV", "").lower() == "production"


def _parse_timestamp(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value)
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _rate_limit_config() -> tuple[int, int, int]:
    max_per_window = int(os.getenv("EMAIL_VERIFICATION_MAX_PER_HOUR", "5"))
    window_minutes = int(os.getenv("EMAIL_VERIFICATION_WINDOW_MINUTES", "60"))
    cooldown_seconds = int(os.getenv("EMAIL_VERIFICATION_COOLDOWN_SECONDS", "60"))
    return max_per_window, window_minutes, cooldown_seconds


def _rate_limit_error(retry_after_seconds: int, detail: str) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "detail": detail,
            "error_code": "email_rate_limited",
            "retry_after_seconds": retry_after_seconds,
        },
        headers={"Retry-After": str(retry_after_seconds)},
    )


class EmailVerificationRequestIn(BaseModel):
    email: str = Field(..., min_length=3)


class EmailVerificationConfirmIn(BaseModel):
    token: str = Field(..., min_length=1)


class EmailVerificationOut(BaseModel):
    status: str
    user_id: str | None = None


@router.post("/auth/verify-email/request", response_model=EmailVerificationOut)
def request_email_verification(payload: EmailVerificationRequestIn):
    user = _get_user_by_email(payload.email)
    if not user:
        return EmailVerificationOut(status="sent")
    user_id = user.id if hasattr(user, "id") else user.get("id")
    if not user_id:
        return EmailVerificationOut(status="sent")
    allow_dev_bypass = not _is_production()
    auto_verify = allow_dev_bypass and _is_env_true("DEV_AUTO_VERIFY_EMAIL")
    skip_limits = allow_dev_bypass and _is_env_true("DEV_SKIP_EMAIL_LIMITS")
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=TOKEN_TTL_HOURS)
    supabase = _require_supabase()
    max_per_window, window_minutes, cooldown_seconds = _rate_limit_config()
    now = datetime.utcnow()
    profile_resp = (
        supabase.table(PROFILES_TABLE)
        .select(
            "email_verified,email_verification_last_sent_at,email_verification_send_count,email_verification_send_window_started_at"
        )
        .eq("id", str(user_id))
        .limit(1)
        .execute()
    )
    row = profile_resp.data[0] if profile_resp.data else {}
    last_sent_at = _parse_timestamp(row.get("email_verification_last_sent_at"))
    window_started_at = _parse_timestamp(row.get("email_verification_send_window_started_at"))
    send_count = int(row.get("email_verification_send_count") or 0)
    if auto_verify:
        update_resp = (
            supabase.table(PROFILES_TABLE)
            .upsert(
                {
                    "id": str(user_id),
                    "email_verified": True,
                    "email_verified_at": now.isoformat(),
                    "email_verification_token": None,
                    "email_verification_expires_at": None,
                    "email_verification_last_sent_at": None,
                    "email_verification_send_count": 0,
                    "email_verification_send_window_started_at": None,
                    "updated_at": now.isoformat(),
                },
                on_conflict="id",
            )
            .execute()
        )
        if update_resp.error:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(update_resp.error))
        return EmailVerificationOut(status="verified", user_id=str(user_id))
    if not skip_limits:
        if last_sent_at and cooldown_seconds > 0:
            retry_after = int((last_sent_at + timedelta(seconds=cooldown_seconds) - now).total_seconds())
            if retry_after > 0:
                return _rate_limit_error(retry_after, "Email verification request rate limited.")
        window_seconds = max(1, window_minutes) * 60
        if window_started_at and (now - window_started_at).total_seconds() < window_seconds:
            if send_count >= max_per_window:
                retry_after = int(window_seconds - (now - window_started_at).total_seconds())
                return _rate_limit_error(max(1, retry_after), "Email verification limit exceeded.")
            send_count += 1
        else:
            window_started_at = now
            send_count = 1
    update_resp = (
        supabase.table(PROFILES_TABLE)
        .upsert(
            {
                "id": str(user_id),
                "email_verification_token": token,
                "email_verification_expires_at": expires_at.isoformat(),
                "email_verification_last_sent_at": now.isoformat(),
                "email_verification_send_count": send_count,
                "email_verification_send_window_started_at": window_started_at.isoformat()
                if window_started_at
                else now.isoformat(),
                "updated_at": now.isoformat(),
            },
            on_conflict="id",
        )
        .execute()
    )
    if update_resp.error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(update_resp.error))
    verify_url = f"{_get_base_url()}/auth/verify-email?token={token}"
    try:
        email_result = send_email_verification_email(str(user_id), verify_url)
    except Exception as exc:
        logger.exception("Email verification send failed", extra={"user_id": str(user_id), "error": str(exc)})
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={
                "detail": "Email provider error.",
                "error_code": "email_provider_error",
            },
        )
    if email_result.get("status") != "sent":
        logger.error("Email verification send returned non-sent status", extra={"user_id": str(user_id), "result": email_result})
        if email_result.get("reason") == "smtp_not_configured":
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "detail": "Email service is not configured.",
                    "error_code": "email_service_not_configured",
                },
            )
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={
                "detail": "Email provider error.",
                "error_code": "email_provider_error",
            },
        )
    return EmailVerificationOut(status="sent", user_id=str(user_id))


@router.post("/auth/verify-email", response_model=EmailVerificationOut)
def confirm_email_verification(payload: EmailVerificationConfirmIn):
    supabase = _require_supabase()
    response = (
        supabase.table(PROFILES_TABLE)
        .select("id,email_verification_expires_at")
        .eq("email_verification_token", payload.token)
        .limit(1)
        .execute()
    )
    row = response.data[0] if response.data else None
    if not row:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification token")
    expires_at = row.get("email_verification_expires_at")
    if expires_at:
        expires_dt = datetime.fromisoformat(str(expires_at))
        if expires_dt < datetime.utcnow():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification token expired")
    update_resp = (
        supabase.table(PROFILES_TABLE)
        .update(
            {
                "email_verified": True,
                "email_verified_at": datetime.utcnow().isoformat(),
                "email_verification_token": None,
                "email_verification_expires_at": None,
                "updated_at": datetime.utcnow().isoformat(),
            }
        )
        .eq("id", row.get("id"))
        .execute()
    )
    if update_resp.error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(update_resp.error))
    return EmailVerificationOut(status="verified", user_id=str(row.get("id")))
