from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from db.supabase import get_supabase_client
from middleware.api_auth import ApiKeyContext, require_api_key, require_scope

router = APIRouter(prefix="/v1")


class SharedGoalOut(BaseModel):
    id: str
    creator_id: str
    title: str
    description: str | None = None
    goal_type: str
    target_value: float
    target_date: str | None = None
    participants: list[str]
    created_at: str


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not configured",
        )
    return supabase


@router.get("/goals", response_model=list[SharedGoalOut])
def list_goals(context: ApiKeyContext = Depends(require_api_key)):
    try:
        require_scope(context, "goals")
        supabase = _require_supabase()
        created = supabase.table("shared_goals").select("*").eq("creator_id", context.user_id).execute()
        created_rows = created.data or []
        participant_rows = (
            supabase.table("goal_participants").select("goal_id").eq("user_id", context.user_id).execute().data
            or []
        )
        goal_ids = {row.get("goal_id") for row in participant_rows if row.get("goal_id")}
        joined_rows: list[dict[str, object]] = []
        if goal_ids:
            joined = supabase.table("shared_goals").select("*").in_("id", list(goal_ids)).execute()
            joined_rows = joined.data or []
        merged: dict[str, dict[str, object]] = {}
        for row in created_rows + joined_rows:
            merged[str(row.get("id"))] = row
        return [SharedGoalOut(**row) for row in merged.values()]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
