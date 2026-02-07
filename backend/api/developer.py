import hashlib
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.events import get_authenticated_user_id
from db.supabase import get_supabase_client

router = APIRouter()
TABLE_NAME = "api_keys"


class ApiKeyCreateIn(BaseModel):
    name: str = Field(..., min_length=2)
    scopes: list[str] = Field(default_factory=list)


class ApiKeyCreateOut(BaseModel):
    id: str
    key: str
    name: str
    scopes: list[str]
    rate_limit: int
    created_at: str


class ApiKeyOut(BaseModel):
    id: str
    name: str
    scopes: list[str]
    rate_limit: int
    created_at: str
    last_used: str | None = None
    status: str


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not configured",
        )
    return supabase


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


@router.post("/developer/keys", response_model=ApiKeyCreateOut)
def create_api_key(payload: ApiKeyCreateIn, user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    raw_key = f"lm_{secrets.token_urlsafe(32)}"
    key_hash = _hash_key(raw_key)
    insert_payload = {
        "user_id": user_id,
        "name": payload.name,
        "key_hash": key_hash,
        "scopes": payload.scopes,
        "rate_limit": 1000,
        "created_at": datetime.utcnow().isoformat(),
        "status": "active",
    }
    response = supabase.table(TABLE_NAME).insert(insert_payload).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create key"
        )
    row = response.data[0]
    return ApiKeyCreateOut(
        id=row.get("id"),
        key=raw_key,
        name=row.get("name"),
        scopes=row.get("scopes") or [],
        rate_limit=int(row.get("rate_limit") or 1000),
        created_at=row.get("created_at"),
    )


@router.get("/developer/keys", response_model=list[ApiKeyOut])
def list_api_keys(user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    response = supabase.table(TABLE_NAME).select("*").eq("user_id", user_id).execute()
    rows = response.data or []
    return [
        ApiKeyOut(
            id=row.get("id"),
            name=row.get("name"),
            scopes=row.get("scopes") or [],
            rate_limit=int(row.get("rate_limit") or 1000),
            created_at=row.get("created_at"),
            last_used=row.get("last_used"),
            status=row.get("status"),
        )
        for row in rows
    ]


@router.delete("/developer/keys/{key_id}")
def revoke_api_key(key_id: str, user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    response = (
        supabase.table(TABLE_NAME)
        .update({"status": "revoked"})
        .eq("id", key_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Key not found")
    return {"status": "revoked"}
