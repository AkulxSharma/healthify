from fastapi import APIRouter

from api import (
    account,
    admin,
    analytics,
    auth,
    digital_twin,
    events,
    food,
    health,
    insights,
    integrations,
    negotiator,
    notifications,
    privacy,
    developer,
    mosaic,
    movement,
    receipts,
    risk,
    social,
    swaps,
    voice_insights,
    webhooks,
)
from api.v1 import events as v1_events
from api.v1 import goals as v1_goals
from api.v1 import insights as v1_insights

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(events.router, tags=["events"])
api_router.include_router(admin.router, tags=["admin"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(voice_insights.router, tags=["voice-insights"])
api_router.include_router(receipts.router, tags=["receipts"])
api_router.include_router(food.router, tags=["food"])
api_router.include_router(movement.router, tags=["movement"])
api_router.include_router(analytics.router, tags=["analytics"])
api_router.include_router(insights.router, tags=["insights"])
api_router.include_router(negotiator.router, tags=["negotiator"])
api_router.include_router(mosaic.router, tags=["mosaic"])
api_router.include_router(risk.router, tags=["risk"])
api_router.include_router(digital_twin.router, tags=["digital-twin"])
api_router.include_router(swaps.router, tags=["swaps"])
api_router.include_router(social.router, tags=["social"])
api_router.include_router(notifications.router, tags=["notifications"])
api_router.include_router(account.router, tags=["account"])
api_router.include_router(privacy.router, tags=["privacy"])
api_router.include_router(integrations.router, tags=["integrations"])
api_router.include_router(developer.router, tags=["developer"])
api_router.include_router(webhooks.router, tags=["webhooks"])
api_router.include_router(v1_events.router, tags=["v1"])
api_router.include_router(v1_insights.router, tags=["v1"])
api_router.include_router(v1_goals.router, tags=["v1"])
