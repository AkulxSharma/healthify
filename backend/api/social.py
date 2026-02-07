from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from api.events import get_authenticated_user_id
from db.supabase import get_supabase_client
from services.achievements import get_badge_progress
from services.alert_service import create_alert
from services.push_service import notify_friend_challenge, notify_goal_milestone

router = APIRouter()


GoalType = Literal["savings", "wellness", "sustainability", "habit"]
ChallengeType = Literal["savings", "wellness", "sustainability", "habit"]
ActivityType = Literal["goal_completed", "milestone", "swap_accepted", "streak"]
VisibilityType = Literal["public", "friends", "private"]
BadgeType = Literal[
    "savings_master",
    "wellness_warrior",
    "eco_champion",
    "streak_king",
    "swap_expert",
]


class SharedGoalCreateIn(BaseModel):
    title: str
    description: str | None = None
    goal_type: GoalType
    target_value: float
    target_date: str | None = None
    invite_users: list[str] = Field(default_factory=list)


class SharedGoalOut(BaseModel):
    id: str
    creator_id: str
    title: str
    description: str | None = None
    goal_type: GoalType
    target_value: float
    target_date: str | None = None
    participants: list[str]
    created_at: str


class GoalParticipantOut(BaseModel):
    id: str
    goal_id: str
    user_id: str
    joined_at: str
    current_progress: float
    last_updated: str


class GoalProgressEntry(BaseModel):
    user: str
    current: float
    target: float
    pct: float
    last_update: str | None = None


class ShareProgressIn(BaseModel):
    goal_id: str | None = None
    achievement: str
    message: str | None = None
    image: str | None = None


class ShareProgressOut(BaseModel):
    id: str
    message: str


class ChallengeCreateIn(BaseModel):
    title: str
    type: ChallengeType
    start: str
    end: str
    participants: list[str] = Field(default_factory=list)
    prize: str | None = None


class GroupChallengeOut(BaseModel):
    id: str
    title: str
    challenge_type: ChallengeType
    start_date: str
    end_date: str
    participants: list[str]
    leaderboard: list[dict[str, Any]]
    prize: str | None = None
    status: str


class LeaderboardEntry(BaseModel):
    rank: int
    user: str
    score: float
    achievements: list[str]


class SocialFeedEntry(BaseModel):
    id: str
    user_id: str
    created_at: str
    achievement: str
    message: str | None = None
    image: str | None = None
    goal_id: str | None = None


class ActivityCreateIn(BaseModel):
    type: ActivityType
    title: str
    description: str | None = None
    metadata: dict[str, Any] | None = None
    visibility: VisibilityType = "friends"


class ActivityCreateOut(BaseModel):
    id: str
    created_at: str


class ActivityFeedEntry(BaseModel):
    user: str
    activity_type: ActivityType
    title: str
    description: str | None = None
    timestamp: str
    reactions: dict[str, int]


class AchievementProgressOut(BaseModel):
    badge_type: BadgeType
    badge_name: str
    earned_at: str | None = None
    progress_current: float
    progress_target: float


class CompareStats(BaseModel):
    savings: float
    wellness: float
    sustainability: float


class ComparisonOut(BaseModel):
    me: CompareStats
    friend: CompareStats
    differences: CompareStats


def _require_supabase():
    supabase = get_supabase_client()
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not configured",
        )
    return supabase


def _coerce_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if item is not None]
    if value is None:
        return []
    return [str(value)]


def _friend_ids(user_id: str) -> set[str]:
    supabase = _require_supabase()
    friends: set[str] = set()
    direct = (
        supabase.table("friendships")
        .select("friend_id")
        .eq("user_id", user_id)
        .eq("status", "accepted")
        .execute()
        .data
        or []
    )
    reverse = (
        supabase.table("friendships")
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


def _latest_scores(user_id: str) -> dict[str, float]:
    supabase = _require_supabase()
    response = (
        supabase.table("score_snapshots")
        .select("wallet_score,wellness_score,sustainability_score,date")
        .eq("user_id", user_id)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    row = response.data[0] if response.data else {}
    return {
        "savings": float(row.get("wallet_score") or 0),
        "wellness": float(row.get("wellness_score") or 0),
        "sustainability": float(row.get("sustainability_score") or 0),
    }


@router.post("/social/goals/create", response_model=SharedGoalOut)
def create_shared_goal(payload: SharedGoalCreateIn, user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    participants = [user_id]
    for invitee in payload.invite_users:
        trimmed = invitee.strip()
        if trimmed and trimmed not in participants:
            participants.append(trimmed)
    insert_payload = {
        "creator_id": user_id,
        "title": payload.title,
        "description": payload.description,
        "goal_type": payload.goal_type,
        "target_value": payload.target_value,
        "target_date": payload.target_date,
        "participants": participants,
    }
    response = supabase.table("shared_goals").insert(insert_payload).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create shared goal"
        )
    goal = response.data[0]
    supabase.table("goal_participants").insert(
        {
            "goal_id": goal["id"],
            "user_id": user_id,
            "current_progress": 0,
            "last_updated": datetime.utcnow().isoformat(),
        }
    ).execute()
    return SharedGoalOut(**goal)


@router.get("/social/goals", response_model=list[SharedGoalOut])
def list_shared_goals(user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    created = supabase.table("shared_goals").select("*").eq("creator_id", user_id).execute()
    created_rows = created.data or []
    participant_rows = (
        supabase.table("goal_participants").select("goal_id").eq("user_id", user_id).execute().data
        or []
    )
    goal_ids = {row.get("goal_id") for row in participant_rows if row.get("goal_id")}
    joined_rows: list[dict[str, Any]] = []
    if goal_ids:
        joined = supabase.table("shared_goals").select("*").in_("id", list(goal_ids)).execute()
        joined_rows = joined.data or []
    merged: dict[str, dict[str, Any]] = {}
    for row in created_rows + joined_rows:
        merged[str(row.get("id"))] = row
    return [SharedGoalOut(**row) for row in merged.values()]


@router.post("/social/goals/{goal_id}/join", response_model=GoalParticipantOut)
def join_shared_goal(goal_id: str, user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    existing = (
        supabase.table("goal_participants")
        .select("*")
        .eq("goal_id", goal_id)
        .eq("user_id", user_id)
        .execute()
    )
    if existing.data:
        return GoalParticipantOut(**existing.data[0])
    goal_response = supabase.table("shared_goals").select("*").eq("id", goal_id).execute()
    if not goal_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared goal not found")
    goal = goal_response.data[0]
    participants = _coerce_list(goal.get("participants"))
    if user_id not in participants:
        participants.append(user_id)
        supabase.table("shared_goals").update({"participants": participants}).eq("id", goal_id).execute()
    insert_payload = {
        "goal_id": goal_id,
        "user_id": user_id,
        "current_progress": 0,
        "last_updated": datetime.utcnow().isoformat(),
    }
    response = supabase.table("goal_participants").insert(insert_payload).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Join failed")
    return GoalParticipantOut(**response.data[0])


@router.get("/social/goals/{goal_id}/progress", response_model=list[GoalProgressEntry])
def goal_progress(goal_id: str, user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    goal_response = supabase.table("shared_goals").select("*").eq("id", goal_id).execute()
    if not goal_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared goal not found")
    goal = goal_response.data[0]
    target = float(goal.get("target_value") or 0)
    participants = (
        supabase.table("goal_participants").select("*").eq("goal_id", goal_id).execute().data or []
    )
    entries: list[GoalProgressEntry] = []
    for row in participants:
        current = float(row.get("current_progress") or 0)
        pct = (current / target * 100) if target > 0 else 0.0
        entries.append(
            GoalProgressEntry(
                user=row.get("user_id"),
                current=current,
                target=target,
                pct=round(pct, 2),
                last_update=row.get("last_updated"),
            )
        )
    return entries


@router.post("/social/share-progress", response_model=ShareProgressOut)
def share_progress(payload: ShareProgressIn, user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    insert_payload = {
        "user_id": user_id,
        "event_type": "social",
        "category": "social",
        "title": payload.achievement,
        "timestamp": datetime.utcnow().isoformat(),
        "metadata": {
            "goal_id": payload.goal_id,
            "message": payload.message,
            "image": payload.image,
            "achievement": payload.achievement,
        },
    }
    response = supabase.table("events").insert(insert_payload).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to share progress"
        )
    row = response.data[0]
    supabase.table("user_activities").insert(
        {
            "user_id": user_id,
            "activity_type": "milestone",
            "title": payload.achievement,
            "description": payload.message,
            "metadata": {"goal_id": payload.goal_id, "image": payload.image},
            "visibility": "friends",
        }
    ).execute()
    if payload.goal_id:
        participant = (
            supabase.table("goal_participants")
            .select("current_progress")
            .eq("goal_id", payload.goal_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        goal_rows = (
            supabase.table("shared_goals")
            .select("title,target_value")
            .eq("id", payload.goal_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if participant and goal_rows:
            current = float(participant[0].get("current_progress") or 0)
            target = float(goal_rows[0].get("target_value") or 0)
            title = goal_rows[0].get("title") or "Goal"
            pct = (current / target * 100) if target > 0 else 0.0
            if pct >= 100:
                create_alert(
                    user_id,
                    "goals",
                    "Goal milestone reached",
                    f"{title} is {pct:.0f}% complete",
                    "/social",
                )
                notify_goal_milestone(user_id, title, pct)
    friends = _friend_ids(user_id)
    if friends:
        profile = (
            supabase.table("profiles")
            .select("display_name")
            .eq("id", user_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        display_name = profile[0].get("display_name") if profile else None
        friend_name = str(display_name or user_id)[:16]
        for fid in friends:
            create_alert(
                fid,
                "social",
                "Friend completed a challenge",
                f"{friend_name}: {payload.achievement}",
                "/social",
            )
            notify_friend_challenge(fid, friend_name, payload.achievement)
    return ShareProgressOut(id=row.get("id"), message="Progress shared")


@router.post("/challenges/create", response_model=GroupChallengeOut)
def create_group_challenge(payload: ChallengeCreateIn, user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    participants = [user_id]
    for invitee in payload.participants:
        trimmed = invitee.strip()
        if trimmed and trimmed not in participants:
            participants.append(trimmed)
    leaderboard = [
        {"user": participant, "score": 0, "achievements": []} for participant in participants
    ]
    insert_payload = {
        "title": payload.title,
        "challenge_type": payload.type,
        "start_date": payload.start,
        "end_date": payload.end,
        "participants": participants,
        "leaderboard": leaderboard,
        "prize": payload.prize,
        "status": "active",
    }
    response = supabase.table("group_challenges").insert(insert_payload).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create challenge",
        )
    return GroupChallengeOut(**response.data[0])


@router.get("/challenges", response_model=list[GroupChallengeOut])
def list_challenges(status_filter: str | None = Query(None), user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    query = supabase.table("group_challenges").select("*")
    if status_filter:
        query = query.eq("status", status_filter)
    rows = query.execute().data or []
    visible: list[GroupChallengeOut] = []
    for row in rows:
        participants = _coerce_list(row.get("participants"))
        if user_id not in participants:
            continue
        visible.append(GroupChallengeOut(**row))
    return visible


@router.post("/challenges/{challenge_id}/join", response_model=GroupChallengeOut)
def join_challenge(challenge_id: str, user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    response = supabase.table("group_challenges").select("*").eq("id", challenge_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")
    row = response.data[0]
    participants = _coerce_list(row.get("participants"))
    leaderboard = row.get("leaderboard") or []
    if user_id not in participants:
        participants.append(user_id)
        leaderboard.append({"user": user_id, "score": 0, "achievements": []})
        supabase.table("group_challenges").update(
            {"participants": participants, "leaderboard": leaderboard}
        ).eq("id", challenge_id).execute()
        row["participants"] = participants
        row["leaderboard"] = leaderboard
    return GroupChallengeOut(**row)


@router.get("/challenges/{challenge_id}/leaderboard", response_model=list[LeaderboardEntry])
def challenge_leaderboard(challenge_id: str, user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    response = supabase.table("group_challenges").select("*").eq("id", challenge_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")
    row = response.data[0]
    raw = row.get("leaderboard") or []
    entries = []
    for item in raw:
        entries.append(
            {
                "user": str(item.get("user")),
                "score": float(item.get("score") or 0),
                "achievements": item.get("achievements") or [],
            }
        )
    entries.sort(key=lambda item: item["score"], reverse=True)
    ranked: list[LeaderboardEntry] = []
    for index, item in enumerate(entries):
        ranked.append(
            LeaderboardEntry(
                rank=index + 1,
                user=item["user"],
                score=item["score"],
                achievements=item["achievements"],
            )
        )
    return ranked


@router.get("/social/feed", response_model=list[ActivityFeedEntry])
def social_feed(limit: int = Query(20, ge=1, le=100), user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    friend_ids = _friend_ids(user_id)
    if not friend_ids:
        return []
    privacy_rows = (
        supabase.table("privacy_settings")
        .select("user_id,profile_visibility,activity_sharing")
        .in_("user_id", list(friend_ids))
        .execute()
        .data
        or []
    )
    privacy_map = {str(row.get("user_id")): row for row in privacy_rows}
    allowed_ids: list[str] = []
    for fid in friend_ids:
        settings = privacy_map.get(str(fid))
        if settings:
            if settings.get("activity_sharing") is False:
                continue
            if settings.get("profile_visibility") == "private":
                continue
        allowed_ids.append(str(fid))
    if not allowed_ids:
        return []
    response = (
        supabase.table("user_activities")
        .select("user_id,activity_type,title,description,metadata,created_at,visibility")
        .in_("user_id", allowed_ids)
        .in_("visibility", ["public", "friends"])
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    rows = response.data or []
    payload: list[ActivityFeedEntry] = []
    for row in rows:
        metadata = row.get("metadata") or {}
        reactions = metadata.get("reactions")
        payload.append(
            ActivityFeedEntry(
                user=row.get("user_id"),
                activity_type=row.get("activity_type"),
                title=row.get("title") or "",
                description=row.get("description"),
                timestamp=row.get("created_at"),
                reactions=reactions if isinstance(reactions, dict) else {},
            )
        )
    return payload


@router.post("/social/activities", response_model=ActivityCreateOut)
def create_activity(payload: ActivityCreateIn, user_id: str = Depends(get_authenticated_user_id)):
    supabase = _require_supabase()
    metadata = payload.metadata or {}
    if "reactions" not in metadata:
        metadata["reactions"] = {"👏": 0, "💪": 0, "🔥": 0}
    response = (
        supabase.table("user_activities")
        .insert(
            {
                "user_id": user_id,
                "activity_type": payload.type,
                "title": payload.title,
                "description": payload.description,
                "metadata": metadata,
                "visibility": payload.visibility,
            }
        )
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create activity"
        )
    row = response.data[0]
    return ActivityCreateOut(id=row.get("id"), created_at=row.get("created_at"))


@router.get("/achievements/{target_user_id}", response_model=list[AchievementProgressOut])
def achievements_for_user(
    target_user_id: str, user_id: str = Depends(get_authenticated_user_id)
):
    if target_user_id != user_id:
        friends = _friend_ids(user_id)
        if target_user_id not in friends:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    progress = get_badge_progress(target_user_id)
    return [AchievementProgressOut(**row) for row in progress]


@router.get("/social/compare", response_model=ComparisonOut)
def compare_friend(friend_id: str, user_id: str = Depends(get_authenticated_user_id)):
    friends = _friend_ids(user_id)
    if friend_id not in friends:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Friend not found")
    me = _latest_scores(user_id)
    friend = _latest_scores(friend_id)
    differences = {
        "savings": round(me["savings"] - friend["savings"], 2),
        "wellness": round(me["wellness"] - friend["wellness"], 2),
        "sustainability": round(me["sustainability"] - friend["sustainability"], 2),
    }
    return ComparisonOut(
        me=CompareStats(**me),
        friend=CompareStats(**friend),
        differences=CompareStats(**differences),
    )
