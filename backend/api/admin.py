from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from services.config_loader import get_scoring_rules, update_scoring_rules

router = APIRouter()


class ScoringRulesPayload(BaseModel):
    rules: dict[str, Any]


@router.get("/admin/scoring-rules")
def admin_get_scoring_rules():
    try:
        return get_scoring_rules()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


@router.put("/admin/scoring-rules")
def admin_update_scoring_rules(payload: ScoringRulesPayload):
    try:
        return update_scoring_rules(payload.rules)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc
