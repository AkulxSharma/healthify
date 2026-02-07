from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from middleware.api_auth import ApiKeyContext, require_api_key, require_scope
from services.pattern_detection import generate_insight_notifications

router = APIRouter(prefix="/v1")


class InsightNotification(BaseModel):
    type: str
    title: str
    message: str
    severity: str
    action: str
    link: str


@router.get("/insights", response_model=list[InsightNotification])
def list_insights(context: ApiKeyContext = Depends(require_api_key)):
    try:
        require_scope(context, "insights")
        return generate_insight_notifications(context.user_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
