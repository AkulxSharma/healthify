import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import HTTPException, Query, status

from db.supabase import get_supabase_client

TABLE_NAME = "api_keys"


@dataclass(frozen=True)
class ApiKeyContext:
    user_id: str
    scopes: list[str]
    key_hash: str
    rate_limit: int


_rate_limits: dict[str, dict[str, object]] = {}


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


def _enforce_rate_limit(key_hash: str, limit: int) -> None:
    now = datetime.utcnow()
    bucket = _rate_limits.get(key_hash)
    if not bucket:
        _rate_limits[key_hash] = {"window_start": now, "count": 1}
        return
    window_start = bucket.get("window_start")
    count = int(bucket.get("count") or 0)
    if not isinstance(window_start, datetime):
        _rate_limits[key_hash] = {"window_start": now, "count": 1}
        return
    if now - window_start >= timedelta(hours=1):
        _rate_limits[key_hash] = {"window_start": now, "count": 1}
        return
    if count >= limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")
    bucket["count"] = count + 1


def require_api_key(
    api_key: str | None = Query(None),
    x_api_key: str | None = None,
) -> ApiKeyContext:
    raw_key = api_key or x_api_key
    if not raw_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key required")
    key_hash = _hash_key(raw_key)
    supabase = _require_supabase()
    response = (
        supabase.table(TABLE_NAME)
        .select("*")
        .eq("key_hash", key_hash)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    row = response.data[0]
    scopes = row.get("scopes") or []
    rate_limit = int(row.get("rate_limit") or 1000)
    _enforce_rate_limit(key_hash, rate_limit)
    supabase.table(TABLE_NAME).update({"last_used": datetime.utcnow().isoformat()}).eq(
        "id", row.get("id")
    ).execute()
    return ApiKeyContext(
        user_id=str(row.get("user_id")),
        scopes=[str(scope) for scope in scopes],
        key_hash=key_hash,
        rate_limit=rate_limit,
    )


def require_scope(context: ApiKeyContext, scope: str) -> None:
    if not context.scopes:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Scope not permitted")
    if scope in context.scopes or "all" in context.scopes:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Scope not permitted")
