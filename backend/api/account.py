from __future__ import annotations

import os
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from api.events import get_authenticated_user_id
from db.supabase import get_supabase_client
from services.data_deletion import cancel_account_deletion, delete_user_account, request_account_deletion
from services.data_export import export_user_data

EXPORTS_TABLE = "data_export_jobs"

router = APIRouter()


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Supabase unavailable")
    return supabase


class ExportJobOut(BaseModel):
    job_id: str
    status: str


class ExportStatusOut(BaseModel):
    status: str
    download_url: str | None = None
    expires_at: datetime | None = None


class DeleteRequestIn(BaseModel):
    password: str = Field(..., min_length=1)
    confirmation: str = Field(..., min_length=1)


class DeleteMessageOut(BaseModel):
    message: str


class DeleteConfirmIn(BaseModel):
    token: str = Field(..., min_length=1)


class DeleteConfirmOut(BaseModel):
    message: str
    scheduled_for: datetime


def _update_export_job(job_id: str, payload: dict) -> None:
    supabase = _require_supabase()
    response = (
        supabase.table(EXPORTS_TABLE)
        .update({**payload, "updated_at": datetime.utcnow().isoformat()})
        .eq("id", job_id)
        .execute()
    )
    if response.error:
        raise RuntimeError(str(response.error))


def _run_export_job(job_id: str, user_id: str) -> None:
    try:
        file_path, expires_at = export_user_data(user_id, job_id)
        download_url = f"/api/account/export/{job_id}/download"
        _update_export_job(
            job_id,
            {
                "status": "completed",
                "file_path": file_path,
                "download_url": download_url,
                "expires_at": expires_at.isoformat(),
            },
        )
    except Exception as exc:
        _update_export_job(job_id, {"status": "failed", "error": str(exc)})


@router.post("/account/export", response_model=ExportJobOut)
def request_export(background_tasks: BackgroundTasks, user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    job_id = str(uuid4())
    response = (
        supabase.table(EXPORTS_TABLE)
        .insert({"id": job_id, "user_id": user_id, "status": "processing"})
        .execute()
    )
    if response.error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(response.error))
    background_tasks.add_task(_run_export_job, job_id, user_id)
    return ExportJobOut(job_id=job_id, status="processing")


@router.get("/account/export/{job_id}", response_model=ExportStatusOut)
def export_status(job_id: str, user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    response = (
        supabase.table(EXPORTS_TABLE)
        .select("status,download_url,expires_at")
        .eq("id", job_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    row = response.data[0] if response.data else None
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export job not found")
    status_value = row.get("status") or "processing"
    download_url = row.get("download_url")
    expires_at = row.get("expires_at")
    expires_dt = None
    if expires_at:
        expires_dt = datetime.fromisoformat(str(expires_at))
        if expires_dt < datetime.utcnow():
            download_url = None
    return ExportStatusOut(status=status_value, download_url=download_url, expires_at=expires_dt)


@router.get("/account/export/{job_id}/download")
def download_export(job_id: str, user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    response = (
        supabase.table(EXPORTS_TABLE)
        .select("file_path,expires_at,status")
        .eq("id", job_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    row = response.data[0] if response.data else None
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export job not found")
    if row.get("status") != "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Export not ready")
    expires_at = row.get("expires_at")
    if expires_at and datetime.fromisoformat(str(expires_at)) < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Export link expired")
    file_path = row.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export file missing")
    return FileResponse(file_path, filename="lifemosaic-data.zip")


@router.post("/account/delete", response_model=DeleteMessageOut)
def request_delete(payload: DeleteRequestIn, user_id: str = Depends(get_authenticated_user_id)):
    base_url = os.getenv("LIFEMOSAIC_APP_URL", "http://localhost:3000")
    try:
        request_account_deletion(user_id, payload.password, payload.confirmation, base_url)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    return DeleteMessageOut(message="Confirmation email sent")


@router.post("/account/delete/confirm", response_model=DeleteConfirmOut)
def confirm_delete(payload: DeleteConfirmIn, user_id: str = Depends(get_authenticated_user_id)):
    try:
        scheduled_for = delete_user_account(user_id, payload.token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    return DeleteConfirmOut(
        message="Account scheduled for deletion. You have 30 days to cancel.",
        scheduled_for=scheduled_for,
    )


@router.post("/account/delete/cancel", response_model=DeleteMessageOut)
def cancel_delete(user_id: str = Depends(get_authenticated_user_id)):
    try:
        restored = cancel_account_deletion(user_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    if not restored:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to restore account")
    return DeleteMessageOut(message="Account restored")
