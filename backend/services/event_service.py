from datetime import datetime, timedelta

from db.supabase import get_supabase_client
from models.events import EventCreate, EventOut
from services.analytics_service import save_daily_snapshot
from services.event_scoring import compute_event_scores
from services.movement_service import update_daily_movement
from services.achievements import check_and_award_achievements
from services.alert_service import create_alert
from services.push_service import notify_spending_alert

TABLE_NAME = "events"


def create_event(event: EventCreate) -> EventOut:
    supabase = get_supabase_client()
    metadata = (
        event.metadata.model_dump()
        if hasattr(event.metadata, "model_dump")
        else (event.metadata or None)
    )
    scores = compute_event_scores(event.event_type, event.category, event.amount, metadata)
    payload = event.model_dump()
    payload["scores"] = scores
    if supabase is None:
        return EventOut(id="evt_placeholder", created_at=datetime.utcnow(), **payload)
    response = supabase.table(TABLE_NAME).insert(payload).execute()
    if not response.data:
        raise RuntimeError("Failed to create event")
    created = EventOut(**response.data[0])
    try:
        event_date = (event.timestamp or datetime.utcnow()).date()
        save_daily_snapshot(event.user_id, datetime.combine(event_date, datetime.min.time()))
        if (event.event_type or "").lower() == "movement":
            update_daily_movement(event.user_id, event_date)
        check_and_award_achievements(event.user_id)
        if (event.event_type or "").lower() == "spending":
            _maybe_spending_alert(event.user_id, event.amount, event.timestamp)
    except Exception:
        pass
    return created


def _maybe_spending_alert(user_id: str, amount: float | None, timestamp: datetime | None) -> None:
    if amount is None:
        return
    supabase = get_supabase_client()
    if supabase is None:
        return
    end = timestamp or datetime.utcnow()
    start = end - timedelta(days=7)
    response = (
        supabase.table(TABLE_NAME)
        .select("amount,timestamp")
        .eq("user_id", user_id)
        .gte("timestamp", start.isoformat())
        .lte("timestamp", end.isoformat())
        .execute()
    )
    rows = response.data or []
    daily_totals: dict[str, float] = {}
    for row in rows:
        ts = row.get("timestamp")
        if not ts:
            continue
        try:
            day = datetime.fromisoformat(str(ts).replace("Z", "+00:00")).date().isoformat()
        except Exception:
            continue
        val = row.get("amount")
        if val is None:
            continue
        daily_totals[day] = daily_totals.get(day, 0.0) + abs(float(val))
    if not daily_totals:
        return
    avg_daily = sum(daily_totals.values()) / max(1, len(daily_totals))
    current_amount = abs(float(amount))
    if avg_daily <= 0:
        return
    if current_amount < avg_daily * 1.4:
        return
    overage = max(0.0, current_amount - avg_daily)
    create_alert(
        user_id,
        "reminders",
        "Spending alert",
        f"Spending hit ${current_amount:.2f} today",
        "/analytics",
    )
    notify_spending_alert(user_id, overage)


def get_events(
    user_id: str,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    event_types: list[str] | None = None,
    categories: list[str] | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, object]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    query = supabase.table(TABLE_NAME).select("*", count="exact").eq("user_id", user_id)
    if start_date is not None:
        query = query.gte("timestamp", start_date.isoformat())
    if end_date is not None:
        query = query.lte("timestamp", end_date.isoformat())
    if event_types:
        query = query.in_("event_type", event_types)
    if categories:
        query = query.in_("category", categories)
    query = query.order("timestamp", desc=True)
    query = query.range(offset, offset + limit - 1)
    response = query.execute()
    rows = response.data or []
    total = int(response.count or 0)
    if total == 0 and rows:
        total = offset + len(rows)
    has_more = offset + len(rows) < total
    return {
        "events": [EventOut(**row) for row in rows],
        "total": total,
        "has_more": has_more,
    }


def rescore_events(
    user_id: str,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    event_types: list[str] | None = None,
    categories: list[str] | None = None,
) -> int:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    query = (
        supabase.table(TABLE_NAME)
        .select("id,event_type,category,amount,metadata,timestamp")
        .eq("user_id", user_id)
    )
    if start_date is not None:
        query = query.gte("timestamp", start_date.isoformat())
    if end_date is not None:
        query = query.lte("timestamp", end_date.isoformat())
    if event_types:
        query = query.in_("event_type", event_types)
    if categories:
        query = query.in_("category", categories)
    response = query.execute()
    rows = response.data or []
    if not rows:
        return 0
    updates = []
    for row in rows:
        scores = compute_event_scores(
            row.get("event_type", ""),
            row.get("category", ""),
            row.get("amount"),
            row.get("metadata") or {},
        )
        updates.append({"id": row.get("id"), "scores": scores})
    upsert_resp = supabase.table(TABLE_NAME).upsert(updates, on_conflict="id").execute()
    if upsert_resp.error:
        raise RuntimeError(str(upsert_resp.error))
    return len(updates)


def get_event_stats(
    user_id: str,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> dict[str, dict[str, dict[str, float | int]]]:
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    query = supabase.table(TABLE_NAME).select("event_type,category,amount").eq("user_id", user_id)
    if start_date is not None:
        query = query.gte("timestamp", start_date.isoformat())
    if end_date is not None:
        query = query.lte("timestamp", end_date.isoformat())
    response = query.execute()
    rows = response.data or []

    by_type: dict[str, dict[str, float | int]] = {}
    by_category: dict[str, dict[str, float | int]] = {}

    for row in rows:
        event_type = row.get("event_type")
        category = row.get("category")
        amount = row.get("amount")

        if event_type:
            current = by_type.setdefault(event_type, {"count": 0, "total_amount": 0.0})
            current["count"] = int(current["count"]) + 1
            if isinstance(amount, (int, float)):
                current["total_amount"] = float(current["total_amount"]) + float(amount)

        if category:
            current = by_category.setdefault(category, {"count": 0, "total_amount": 0.0})
            current["count"] = int(current["count"]) + 1
            if isinstance(amount, (int, float)):
                current["total_amount"] = float(current["total_amount"]) + float(amount)

    return {"by_type": by_type, "by_category": by_category}
