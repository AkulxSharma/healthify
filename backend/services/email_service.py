from __future__ import annotations

import os
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any

from db.supabase import get_supabase_client
from services.analytics_service import get_dashboard_stats
from services.pattern_detection import generate_insight_notifications

EVENTS_TABLE = "events"
GOAL_PARTICIPANTS_TABLE = "goal_participants"
SHARED_GOALS_TABLE = "shared_goals"
USER_ACTIVITIES_TABLE = "user_activities"
PREFERENCES_TABLE = "notification_preferences"
FRIENDSHIPS_TABLE = "friendships"


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise RuntimeError("Supabase client is not configured")
    return supabase


def _week_window() -> tuple[datetime, datetime]:
    end = datetime.utcnow()
    start = end - timedelta(days=7)
    return start, end


def _fetch_events(user_id: str, start: datetime, end: datetime) -> list[dict[str, Any]]:
    supabase = _require_supabase()
    response = (
        supabase.table(EVENTS_TABLE)
        .select("scores,timestamp")
        .eq("user_id", user_id)
        .gte("timestamp", start.isoformat())
        .lte("timestamp", end.isoformat())
        .execute()
    )
    return response.data or []


def _sum_sustainability(events: list[dict[str, Any]]) -> float:
    total = 0.0
    for row in events:
        scores = row.get("scores") or {}
        value = scores.get("sustainability_impact")
        if isinstance(value, (int, float)):
            total += float(value)
    return round(total, 2)


def _friend_ids(user_id: str) -> set[str]:
    supabase = _require_supabase()
    friends: set[str] = set()
    direct = (
        supabase.table(FRIENDSHIPS_TABLE)
        .select("friend_id")
        .eq("user_id", user_id)
        .eq("status", "accepted")
        .execute()
        .data
        or []
    )
    reverse = (
        supabase.table(FRIENDSHIPS_TABLE)
        .select("user_id")
        .eq("friend_id", user_id)
        .eq("status", "accepted")
        .execute()
        .data
        or []
    )
    for row in direct:
        fid = row.get("friend_id")
        if fid:
            friends.add(str(fid))
    for row in reverse:
        fid = row.get("user_id")
        if fid:
            friends.add(str(fid))
    return friends


def _goal_progress(user_id: str) -> list[dict[str, Any]]:
    supabase = _require_supabase()
    participants = (
        supabase.table(GOAL_PARTICIPANTS_TABLE)
        .select("goal_id,current_progress,last_updated")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    goal_ids = [row.get("goal_id") for row in participants if row.get("goal_id")]
    if not goal_ids:
        return []
    goals = (
        supabase.table(SHARED_GOALS_TABLE)
        .select("id,title,target_value")
        .in_("id", goal_ids)
        .execute()
        .data
        or []
    )
    goals_by_id = {str(row.get("id")): row for row in goals}
    results: list[dict[str, Any]] = []
    for row in participants:
        goal_id = str(row.get("goal_id"))
        goal = goals_by_id.get(goal_id)
        if not goal:
            continue
        target = float(goal.get("target_value") or 0)
        current = float(row.get("current_progress") or 0)
        pct = round((current / target * 100) if target > 0 else 0.0, 2)
        results.append(
            {
                "title": goal.get("title") or "Goal",
                "current": current,
                "target": target,
                "pct": pct,
            }
        )
    return results


def _friend_achievements(user_id: str) -> list[dict[str, Any]]:
    supabase = _require_supabase()
    friend_ids = _friend_ids(user_id)
    if not friend_ids:
        return []
    response = (
        supabase.table(USER_ACTIVITIES_TABLE)
        .select("user_id,title,description,created_at")
        .in_("user_id", list(friend_ids))
        .order("created_at", desc=True)
        .limit(3)
        .execute()
    )
    return response.data or []


def generate_weekly_summary(user_id: str) -> dict[str, Any]:
    start, end = _week_window()
    events = _fetch_events(user_id, start, end)
    sustainability = _sum_sustainability(events)
    stats_payload = get_dashboard_stats(user_id, "week")
    stats = stats_payload.get("stats") or {}
    spending_total = float(stats.get("spending_total", {}).get("value") or 0)
    spending_change = float(stats.get("spending_total", {}).get("change") or 0)
    savings_total = float(stats.get("money_saved_via_swaps", {}).get("value") or 0)
    wellness_change = float(stats.get("wellness_score_avg", {}).get("change") or 0)
    insights = generate_insight_notifications(user_id)[:3]
    goals = _goal_progress(user_id)
    friends = _friend_achievements(user_id)
    return {
        "week_start": start.date().isoformat(),
        "week_end": end.date().isoformat(),
        "savings_total": round(savings_total, 2),
        "spending_total": round(spending_total, 2),
        "spending_vs_budget": round(spending_change, 2),
        "wellness_change": round(wellness_change, 2),
        "sustainability_total": sustainability,
        "insights": insights,
        "goals": goals,
        "friends": friends,
    }


def _render_template(summary: dict[str, Any]) -> str:
    template_path = Path(__file__).resolve().parent.parent / "templates" / "weekly_summary.html"
    template = template_path.read_text(encoding="utf-8")
    highlights = [
        f"Saved ${summary['savings_total']:.2f} through swaps",
        f"Spent ${summary['spending_total']:.2f} ({summary['spending_vs_budget']:+.2f} vs last week)",
        f"Wellness change {summary['wellness_change']:+.1f} pts",
    ]
    highlights_html = "".join(f"<li>{item}</li>" for item in highlights)
    insights_html = "".join(
        f"<li><strong>{row.get('title')}</strong> — {row.get('message')}</li>"
        for row in summary["insights"]
    )
    goals_html = "".join(
        (
            "<div class='goal-row'>"
            f"<div class='goal-title'>{row['title']}</div>"
            f"<div class='goal-bar'><span style='width:{row['pct']}%'></span></div>"
            f"<div class='goal-meta'>{row['current']}/{row['target']}</div>"
            "</div>"
        )
        for row in summary["goals"]
    )
    friends_html = "".join(
        f"<li>{row.get('title')} — {row.get('description') or ''}</li>"
        for row in summary["friends"]
    )
    return template.format(
        week_range=f"{summary['week_start']} to {summary['week_end']}",
        savings_total=f"${summary['savings_total']:.2f}",
        spending_total=f"${summary['spending_total']:.2f}",
        spending_vs_budget=f"{summary['spending_vs_budget']:+.2f}",
        wellness_change=f"{summary['wellness_change']:+.1f}",
        sustainability_total=f"{summary['sustainability_total']:.1f} kg CO₂",
        highlights_html=highlights_html or "<li>No highlights yet.</li>",
        insights_html=insights_html or "<li>No insights yet.</li>",
        goals_html=goals_html or "<div class='empty'>No goals this week.</div>",
        friends_html=friends_html or "<li>No friend activity yet.</li>",
        cta_url=os.getenv("LIFEMOSAIC_APP_URL", "https://lifemosaic.app"),
    )


def _get_user_email(user_id: str) -> str | None:
    supabase = _require_supabase()
    try:
        auth_response = supabase.auth.admin.get_user_by_id(user_id)
        user = auth_response.user if hasattr(auth_response, "user") else auth_response.get("user")
        email = user.email if hasattr(user, "email") else user.get("email")
        return str(email) if email else None
    except Exception:
        return None


def send_email_verification_email(user_id: str, verify_url: str) -> dict[str, Any]:
    email = _get_user_email(user_id)
    if not email:
        return {"status": "skipped", "reason": "no_email"}
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USERNAME")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_user or "no-reply@lifemosaic.app")
    if not smtp_host or not smtp_user or not smtp_pass:
        return {"status": "skipped", "reason": "smtp_not_configured"}
    subject = "Verify your LifeMosaic email"
    html = (
        "<html><body style='font-family:Arial,sans-serif;'>"
        "<h2>Verify your email</h2>"
        "<p>Use the link below to verify your LifeMosaic account.</p>"
        f"<p><a href='{verify_url}'>Verify email</a></p>"
        "<p>If you did not create this account, you can ignore this email.</p>"
        "</body></html>"
    )
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = smtp_from
    message["To"] = email
    message.attach(MIMEText(html, "html"))
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() != "false"
    with smtplib.SMTP(smtp_host, smtp_port) as server:
        if use_tls:
            server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_from, [email], message.as_string())
    return {"status": "sent", "email": email}


def send_account_deletion_email(user_id: str, confirm_url: str) -> dict[str, Any]:
    email = _get_user_email(user_id)
    if not email:
        return {"status": "skipped", "reason": "no_email"}
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USERNAME")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_user or "no-reply@lifemosaic.app")
    if not smtp_host or not smtp_user or not smtp_pass:
        return {"status": "skipped", "reason": "smtp_not_configured"}
    subject = "Confirm your LifeMosaic account deletion"
    html = (
        "<html><body style='font-family:Arial,sans-serif;'>"
        "<h2>Confirm your account deletion</h2>"
        "<p>You requested to delete your LifeMosaic account. This action schedules deletion "
        "in 30 days. You can cancel anytime before then.</p>"
        f"<p><a href='{confirm_url}'>Confirm deletion</a></p>"
        "<p>If you did not request this, you can ignore this email.</p>"
        "</body></html>"
    )
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = smtp_from
    message["To"] = email
    message.attach(MIMEText(html, "html"))
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() != "false"
    with smtplib.SMTP(smtp_host, smtp_port) as server:
        if use_tls:
            server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_from, [email], message.as_string())
    return {"status": "sent", "email": email}


def send_weekly_email(user_id: str) -> dict[str, Any]:
    summary = generate_weekly_summary(user_id)
    email = _get_user_email(user_id)
    if not email:
        return {"status": "skipped", "reason": "no_email"}
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USERNAME")
    smtp_pass = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_user or "no-reply@lifemosaic.app")
    if not smtp_host or not smtp_user or not smtp_pass:
        return {"status": "skipped", "reason": "smtp_not_configured"}
    subject = f"Your LifeMosaic Week: ${summary['savings_total']:.0f} saved, {summary['wellness_change']:+.0f} wellness pts"
    html = _render_template(summary)
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = smtp_from
    message["To"] = email
    message.attach(MIMEText(html, "html"))
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() != "false"
    with smtplib.SMTP(smtp_host, smtp_port) as server:
        if use_tls:
            server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_from, [email], message.as_string())
    return {"status": "sent", "email": email}
