from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from api.events import get_authenticated_user_id
from services.webhooks import delete_webhook, list_webhooks, register_webhook, trigger_webhook

router = APIRouter()


class WebhookCreateIn(BaseModel):
    url: str = Field(..., min_length=5)
    events: list[str] = Field(default_factory=list)
    secret: str | None = None


class WebhookOut(BaseModel):
    id: str
    url: str
    events: list[str]
    status: str
    created_at: str
    last_triggered: str | None = None


@router.post("/webhooks", response_model=WebhookOut)
def create_webhook(payload: WebhookCreateIn, user_id: str = Depends(get_authenticated_user_id)):
    try:
        row = register_webhook(user_id, payload.url, payload.events, payload.secret)
        return WebhookOut(**row)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.get("/webhooks", response_model=list[WebhookOut])
def get_webhooks(user_id: str = Depends(get_authenticated_user_id)):
    try:
        rows = list_webhooks(user_id)
        return [WebhookOut(**row) for row in rows]
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.delete("/webhooks/{webhook_id}")
def remove_webhook(webhook_id: str, user_id: str = Depends(get_authenticated_user_id)):
    ok = delete_webhook(user_id, webhook_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
    return {"status": "deleted"}


@router.post("/webhooks/{webhook_id}/test")
def test_webhook(webhook_id: str, user_id: str = Depends(get_authenticated_user_id)):
    try:
        results = trigger_webhook(user_id, "webhook.test", {"id": webhook_id})
        match = [row for row in results if row.get("id") == webhook_id]
        if not match:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found")
        return {"status": "sent", "result": match[0]}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
