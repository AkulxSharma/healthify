"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { LucideIcon } from "lucide-react";
import { Coffee, DollarSign, Droplet, Dumbbell, Moon, Pill, Timer, Users, Utensils } from "lucide-react";

import { EventScoreBadges } from "@/components/EventScoreBadges";
import { QuickTapLogger } from "@/components/QuickTapLogger";
import { ProjectionSummaryCards } from "@/components/digital-twin/ProjectionSummaryCards";
import { WalletSummaryCard } from "@/components/digital-twin/WalletSummaryCard";
import { DailyMosaic } from "@/components/mosaic/DailyMosaic";
import { InsightNotifications } from "@/components/insights/InsightNotifications";
import { PositivePatternsPanel } from "@/components/insights/PositivePatternsPanel";
import { AlertBell } from "@/components/notifications/AlertBell";
import { InAppAlert } from "@/components/notifications/InAppAlert";
import { RiskDashboard } from "@/components/risk/RiskDashboard";
import { StatsGrid } from "@/components/stats/StatsGrid";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import {
  endFocusSession,
  getActiveFocusSession,
  getLatestFocusSession,
  isFocusSessionIdle,
  recordFocusSessionActivity,
  startFocusSession,
} from "@/lib/activityTracker";
import { safeFetch } from "@/lib/api";
import { getEventsByDateRange, getRecentEvents } from "@/lib/events";
import { getTrendData } from "@/lib/analytics";
import { signOut } from "@/lib/supabaseClient";
import { getUserProfile } from "@/lib/profile";
import { getCorrelations } from "@/lib/insights";
import type { ActivityLog } from "@/types/activity";
import type { TrendData } from "@/types/analytics";
import type { Event } from "@/types/events";
import type { CorrelationInsight } from "@/types/insights";
import type { ProfileType } from "@/types/profile";
import { getUserSettings } from "@/lib/settings";
import type { UserSettings } from "@/types/profile";
import { getRecentVoiceCheckinsWithInsights, processVoiceCheckin } from "@/lib/voiceCheckins";
import type { VoiceCheckinWithInsight } from "@/types/voice";
import { getRecentMovementTestsWithInsights } from "@/lib/movementTests";
import type { MovementTestWithInsight } from "@/types/movement";
import { getSwapHistory } from "@/lib/swaps";
import type { SwapHistoryItem } from "@/types/swaps";
import type { BadgeProgress } from "@/types/achievements";
import type { SocialFeedEntry } from "@/types/social";

type MovementPattern = {
  date: string;
  steps: number;
  active_minutes: number;
  sedentary_minutes: number;
  workout_count: number;
  total_movement_score: number;
};

type RecentActivityItem = {
  id: number;
  type: string;
  icon: string;
  title: string;
  description: string;
  time: string;
  color: "orange" | "green" | "yellow" | "blue" | "cyan";
};

const recentActivityColorClasses: Record<RecentActivityItem["color"], string> = {
  orange: "border-orange-500/30 bg-orange-500/10 text-orange-200",
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  yellow: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  blue: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
};

const generateRecentActivity = (): RecentActivityItem[] => [
  {
    id: 1,
    type: "food",
    icon: "🍽️",
    title: "Logged lunch",
    description: "Grilled chicken salad - 450 cal",
    time: "2 hours ago",
    color: "orange",
  },
  {
    id: 2,
    type: "movement",
    icon: "👟",
    title: "Morning run",
    description: "5.2 km - 320 calories burned",
    time: "5 hours ago",
    color: "green",
  },
  {
    id: 3,
    type: "spending",
    icon: "💰",
    title: "Grocery shopping",
    description: "$45.30 at Whole Foods",
    time: "Yesterday",
    color: "yellow",
  },
  {
    id: 4,
    type: "water",
    icon: "💧",
    title: "Hydration goal",
    description: "8/8 glasses completed",
    time: "Yesterday",
    color: "blue",
  },
  {
    id: 5,
    type: "social",
    icon: "👥",
    title: "Completed group challenge",
    description: "10K steps with friends",
    time: "2 days ago",
    color: "cyan",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useSupabaseSession();
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileType[] | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [checkins, setCheckins] = useState<VoiceCheckinWithInsight[]>([]);
  const [loadingCheckins, setLoadingCheckins] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [checkinsError, setCheckinsError] = useState<string | null>(null);
  const [movementTests, setMovementTests] = useState<MovementTestWithInsight[]>([]);
  const [loadingMovement, setLoadingMovement] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [spendingEvents, setSpendingEvents] = useState<Event[]>([]);
  const [loadingSpending, setLoadingSpending] = useState(true);
  const [spendingError, setSpendingError] = useState<string | null>(null);
  const [foodEvents, setFoodEvents] = useState<Event[]>([]);
  const [loadingFood, setLoadingFood] = useState(true);
  const [foodError, setFoodError] = useState<string | null>(null);
  const [hasHighRisk, setHasHighRisk] = useState(false);
  const [movementDaily, setMovementDaily] = useState<MovementPattern | null>(null);
  const [loadingMovementDaily, setLoadingMovementDaily] = useState(true);
  const [movementError, setMovementError] = useState<string | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [spendingTrend, setSpendingTrend] = useState<TrendData[]>([]);
  const [wellnessTrend, setWellnessTrend] = useState<TrendData[]>([]);
  const [swapHistory, setSwapHistory] = useState<SwapHistoryItem[]>([]);
  const [swapHistoryError, setSwapHistoryError] = useState<string | null>(null);
  const [topInsight, setTopInsight] = useState<CorrelationInsight | null>(null);
  const [topInsightLoading, setTopInsightLoading] = useState(true);
  const [topInsightError, setTopInsightError] = useState<string | null>(null);
  const [socialGoalsCount, setSocialGoalsCount] = useState(0);
  const [socialGoalsLoading, setSocialGoalsLoading] = useState(true);
  const [socialGoalsError, setSocialGoalsError] = useState<string | null>(null);
  const [socialChallengeRank, setSocialChallengeRank] = useState<number | null>(null);
  const [socialChallengeTitle, setSocialChallengeTitle] = useState<string | null>(null);
  const [socialAchievements, setSocialAchievements] = useState<SocialFeedEntry[]>([]);
  const [socialFeedError, setSocialFeedError] = useState<string | null>(null);
  const [latestBadge, setLatestBadge] = useState<BadgeProgress | null>(null);
  const recentActivityFallback = useMemo(() => generateRecentActivity(), []);
  const [latestBadgeLoading, setLatestBadgeLoading] = useState(true);
  const [latestBadgeError, setLatestBadgeError] = useState<string | null>(null);
  const [focusActive, setFocusActive] = useState(false);
  const [focusStartTime, setFocusStartTime] = useState<string | null>(null);
  const [focusElapsedSeconds, setFocusElapsedSeconds] = useState(0);
  const [lastFocusSession, setLastFocusSession] = useState<ActivityLog | null>(null);
  const [focusSaving, setFocusSaving] = useState(false);
  const [focusError, setFocusError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  const handleSignOut = async () => {
    setError(null);
    try {
      await signOut();
      router.push("/auth");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign out failed.";
      setError(message);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    setLoadingProfile(true);
    getUserProfile(user.id)
      .then((data) => {
        setProfiles(data?.profile_types ?? null);
      })
      .catch(() => {
        setProfiles(null);
      })
      .finally(() => setLoadingProfile(false));

    setLoadingSettings(true);
    getUserSettings(user.id)
      .then((data) => {
        setSettings(data ?? null);
      })
      .catch(() => {
        setSettings(null);
      })
      .finally(() => setLoadingSettings(false));

    setLoadingCheckins(true);
    getRecentVoiceCheckinsWithInsights(user.id, 5)
      .then((data) => {
        setCheckins(data);
        setCheckinsError(null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load voice check-ins.";
        setCheckinsError(message);
        setCheckins([]);
      })
      .finally(() => setLoadingCheckins(false));

    setLoadingMovement(true);
    getRecentMovementTestsWithInsights(user.id, 5)
      .then((rows) => {
        setMovementTests(rows);
      })
      .catch(() => {
        setMovementTests([]);
      })
      .finally(() => setLoadingMovement(false));

    setLoadingEvents(true);
    getRecentEvents(user.id, 5)
      .then((rows) => {
        setEvents(rows);
        setEventsError(null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load events.";
        setEventsError(message);
        setEvents([]);
      })
      .finally(() => setLoadingEvents(false));

    setLoadingSpending(true);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    getEventsByDateRange(startDate.toISOString(), endDate.toISOString(), ["spending"])
      .then((result) => {
        setSpendingEvents(result.events);
        setSpendingError(null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load spending.";
        setSpendingError(message);
        setSpendingEvents([]);
      })
      .finally(() => setLoadingSpending(false));

    setLoadingFood(true);
    getEventsByDateRange(startDate.toISOString(), endDate.toISOString(), ["food"])
      .then((result) => {
        setFoodEvents(result.events);
        setFoodError(null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load food logs.";
        setFoodError(message);
        setFoodEvents([]);
      })
      .finally(() => setLoadingFood(false));

    getSwapHistory(14)
      .then((rows) => {
        setSwapHistory(rows);
        setSwapHistoryError(null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load swap history.";
        setSwapHistoryError(message);
        setSwapHistory([]);
      });

    setAnalyticsLoading(true);
    setTopInsightLoading(true);
    const analyticsEnd = new Date();
    const analyticsStart = new Date();
    analyticsStart.setDate(analyticsEnd.getDate() - 6);
    Promise.allSettled([
      getTrendData("spending", analyticsStart.toISOString(), analyticsEnd.toISOString()),
      getTrendData("wellness", analyticsStart.toISOString(), analyticsEnd.toISOString()),
      getCorrelations(30),
    ])
      .then(([spendingResult, wellnessResult, correlationsResult]) => {
        if (spendingResult.status === "fulfilled") {
          setSpendingTrend(spendingResult.value);
        } else {
          setSpendingTrend([]);
        }
        if (wellnessResult.status === "fulfilled") {
          setWellnessTrend(wellnessResult.value);
        } else {
          setWellnessTrend([]);
        }
        if (spendingResult.status === "rejected" || wellnessResult.status === "rejected") {
          const message = "Unable to load analytics preview.";
          setAnalyticsError(message);
        } else {
          setAnalyticsError(null);
        }
        if (correlationsResult.status === "fulfilled") {
          const top =
            correlationsResult.value
              ?.slice()
              .sort(
                (a, b) =>
                  Math.abs(Number(b.impact_value ?? 0)) - Math.abs(Number(a.impact_value ?? 0))
              )[0] ?? null;
          setTopInsight(top ?? null);
          setTopInsightError(null);
        } else {
          const message =
            correlationsResult.reason instanceof Error
              ? correlationsResult.reason.message
              : "Unable to load top insight.";
          setTopInsight(null);
          setTopInsightError(message);
        }
      })
      .finally(() => {
        setAnalyticsLoading(false);
        setTopInsightLoading(false);
      });

    const loadSocial = async () => {
      setSocialGoalsLoading(true);
      setSocialGoalsError(null);
      setSocialFeedError(null);
      setSocialChallengeRank(null);
      setSocialChallengeTitle(null);
      setLatestBadgeError(null);
      setLatestBadgeLoading(true);
      setLatestBadge(null);
      const goalsPayload = await safeFetch<Array<{ id: string }>>("/social/goals", [
        { id: "goal-1" },
        { id: "goal-2" },
      ]);
      setSocialGoalsCount(goalsPayload.length);
      const feedPayload = await safeFetch<SocialFeedEntry[]>("/social/feed", [
        {
          id: "feed-1",
          user_id: user.id,
          created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          achievement: "Completed a 5k run",
        },
        {
          id: "feed-2",
          user_id: "friend-1",
          created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          achievement: "Saved $20 on swaps",
        },
      ]);
      setSocialAchievements(feedPayload.slice(0, 3));
      const achievementsPayload = await safeFetch<BadgeProgress[]>(
        `/achievements/${user.id}`,
        [
          {
            badge_type: "wellness_warrior",
            badge_name: "Wellness Warrior",
            earned_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            progress_current: 10,
            progress_target: 10,
          },
        ]
      );
      const earned = achievementsPayload
        .filter((badge) => badge.earned_at)
        .sort((a, b) => {
          const aTime = a.earned_at ? new Date(a.earned_at).getTime() : 0;
          const bTime = b.earned_at ? new Date(b.earned_at).getTime() : 0;
          return bTime - aTime;
        });
      setLatestBadge(earned[0] ?? null);
      const challengePayload = await safeFetch<Array<{ id: string; title: string }>>(
        "/challenges",
        [{ id: "challenge-1", title: "10K steps challenge" }]
      );
      const primary = challengePayload[0];
      if (primary) {
        const entries = await safeFetch<Array<{ user: string; rank: number }>>(
          `/challenges/${primary.id}/leaderboard`,
          [
            { user: user.id, rank: 4 },
            { user: "friend-1", rank: 2 },
          ]
        );
        const me = entries.find((entry) => entry.user === user.id);
        setSocialChallengeRank(me?.rank ?? null);
        setSocialChallengeTitle(primary.title);
      }
      setSocialGoalsLoading(false);
      setLatestBadgeLoading(false);
    };

    void loadSocial();

    setLoadingMovementDaily(true);
    safeFetch<MovementPattern>("/movement/daily", {
      date: new Date().toISOString(),
      steps: 6420,
      active_minutes: 38,
      sedentary_minutes: 510,
      workout_count: 1,
      total_movement_score: 74,
    })
      .then((payload) => {
        setMovementDaily(payload);
        setMovementError(null);
      })
      .finally(() => setLoadingMovementDaily(false));
  }, [user]);

  useEffect(() => {
    if (!user || !settings?.notifications?.focusTracking) {
      return;
    }
    getLatestFocusSession(user.id)
      .then((session) => setLastFocusSession(session))
      .catch(() => setLastFocusSession(null));
    const existing = getActiveFocusSession();
    if (existing) {
      setFocusActive(true);
      setFocusStartTime(existing.startTime);
    }
  }, [settings?.notifications?.focusTracking, user]);

  useEffect(() => {
    if (settings?.notifications?.focusTracking) {
      return;
    }
    if (focusActive) {
      void endFocusSession().catch(() => null);
    }
    setFocusActive(false);
    setFocusStartTime(null);
    setFocusElapsedSeconds(0);
  }, [focusActive, settings?.notifications?.focusTracking]);

  useEffect(() => {
    if (!focusActive || !focusStartTime) {
      return;
    }
    const interval = window.setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - new Date(focusStartTime).getTime()) / 1000
      );
      setFocusElapsedSeconds(Math.max(0, elapsed));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [focusActive, focusStartTime]);

  useEffect(() => {
    if (!focusActive) {
      return;
    }
    const handleActivity = () => recordFocusSessionActivity();
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("touchstart", handleActivity, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, [focusActive]);


  const handleLoggedEvent = (event: Event) => {
    setEvents((prev) => [event, ...prev].slice(0, 5));
  };

  const formatRelativeTime = (dateString: string) => {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
    if (seconds < 60) {
      return `${seconds} second${seconds === 1 ? "" : "s"} ago`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };

  const eventIcons: Record<Event["event_type"], LucideIcon> = {
    spending: DollarSign,
    food: Utensils,
    movement: Dumbbell,
    habit: Timer,
    mood: Moon,
    sleep: Moon,
    social: Users,
    meds: Pill,
    work: Timer,
    study: Timer,
    break: Coffee,
    water: Droplet,
  };

  const eventLabels: Record<Event["event_type"], string> = {
    spending: "Spending",
    food: "Food",
    movement: "Movement",
    habit: "Habit",
    mood: "Mood",
    sleep: "Sleep",
    social: "Social",
    meds: "Meds",
    work: "Work",
    study: "Study",
    break: "Break",
    water: "Water",
  };

  const focusTrackingEnabled = settings?.notifications?.focusTracking ?? false;

  const topInsightText = useMemo(() => {
    if (!topInsight) {
      return "💡 When you meal prep Sundays, you save $45/week";
    }
    const impact = topInsight.impact_description || "";
    return `💡 ${topInsight.pattern}: ${impact}`;
  }, [topInsight]);

  const weeklySpendingTotal = useMemo(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    return spendingEvents.reduce((sum, event) => {
      const timestamp = new Date(event.timestamp);
      if (timestamp < weekStart) {
        return sum;
      }
      const amount = Number(event.amount ?? 0);
      return sum + (Number.isNaN(amount) ? 0 : amount);
    }, 0);
  }, [spendingEvents]);

  const topSpendingCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    spendingEvents.forEach((event) => {
      const category = event.metadata?.category ?? "Other";
      counts[category] = (counts[category] ?? 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? "None";
  }, [spendingEvents]);

  const recentSpending = useMemo<Event[]>(() => {
    return [...spendingEvents]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3);
  }, [spendingEvents]);

  const todayStart = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
  }, []);

  const todayFoodEvents = useMemo(() => {
    return foodEvents.filter((event) => new Date(event.timestamp) >= todayStart);
  }, [foodEvents, todayStart]);

  const totalCaloriesToday = useMemo(() => {
    return todayFoodEvents.reduce((sum, event) => {
      const amount = Number(event.amount ?? 0);
      return sum + (Number.isNaN(amount) ? 0 : amount);
    }, 0);
  }, [todayFoodEvents]);

  const avgNutritionQuality = useMemo(() => {
    const scores = todayFoodEvents
      .map((event) => Number(event.metadata?.nutrition_quality_score ?? event.scores?.wellness_impact))
      .filter((value) => !Number.isNaN(value));
    if (scores.length === 0) {
      return null;
    }
    return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  }, [todayFoodEvents]);

  const recentMeals = useMemo<Event[]>(() => {
    return [...foodEvents]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3);
  }, [foodEvents]);

  const scoreBadgeClass = (score?: number | null) => {
    const s = score ?? 0;
    if (s >= 8) return "border-emerald-400 bg-emerald-500/15 text-emerald-100";
    if (s >= 5) return "border-amber-400 bg-amber-500/15 text-amber-100";
    return "border-rose-400 bg-rose-500/15 text-rose-100";
  };

  const movementBadgeClass = (score?: number | null) => {
    const s = score ?? 0;
    if (s >= 80) return "border-emerald-400 bg-emerald-500/15 text-emerald-100";
    if (s >= 50) return "border-amber-400 bg-amber-500/15 text-amber-100";
    return "border-rose-400 bg-rose-500/15 text-rose-100";
  };

  const formatElapsed = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remaining = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${remaining}s`;
  };

  const handleStartFocusSession = useCallback(() => {
    setFocusError(null);
    startFocusSession();
    const existing = getActiveFocusSession();
    setFocusActive(true);
    setFocusStartTime(existing?.startTime ?? new Date().toISOString());
    setFocusElapsedSeconds(0);
  }, []);

  const handleEndFocusSession = useCallback(async () => {
    setFocusError(null);
    if (!focusActive) {
      return;
    }
    try {
      setFocusSaving(true);
      await endFocusSession();
      setFocusActive(false);
      setFocusStartTime(null);
      setFocusElapsedSeconds(0);
      if (user) {
        const latest = await getLatestFocusSession(user.id);
        setLastFocusSession(latest);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save focus session.";
      setFocusError(message);
    } finally {
      setFocusSaving(false);
    }
  }, [focusActive, user]);

  useEffect(() => {
    if (!focusActive) {
      return;
    }
    const interval = window.setInterval(() => {
      if (isFocusSessionIdle(5)) {
        void handleEndFocusSession();
      }
    }, 60000);
    return () => window.clearInterval(interval);
  }, [focusActive, handleEndFocusSession]);

  const handleProcessCheckin = async (checkinId: string) => {
    setCheckinsError(null);
    try {
      setProcessingId(checkinId);
      const insight = await processVoiceCheckin(checkinId);
      setCheckins((prev) =>
        prev.map((checkin) =>
          checkin.id === checkinId ? { ...checkin, insight } : checkin
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to process check-in.";
      setCheckinsError(message);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-200 px-6 py-10">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 px-6 py-10">Redirecting...</div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <InAppAlert />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <Card>
          <CardHeader className="space-y-3 sm:flex sm:items-center sm:justify-between sm:space-y-0">
            <div className="space-y-2">
              <CardTitle>Dashboard</CardTitle>
              <CardDescription>Authenticated session details.</CardDescription>
            </div>
            <AlertBell />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm">
              Logged in as {user.email ?? "Unknown"}
            </div>
            <StatsGrid />
            <ProjectionSummaryCards />
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-100">Top insight</p>
                  <p className="text-xs text-slate-400">Your strongest recent signal</p>
                </div>
                <Button type="button" onClick={() => router.push("/insights")} className="h-8 px-3 text-xs">
                  View all insights
                </Button>
              </div>
              <div className="mt-4">
                {topInsightLoading ? (
                  <p className="text-slate-300">Loading insight…</p>
                ) : topInsightError ? (
                  <p className="text-rose-300">{topInsightError}</p>
                ) : (
                  <p className="text-sm text-slate-200">{topInsightText}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4 text-sm">
              <div>
                <p className="text-base font-semibold text-slate-100">AI Coach</p>
                <p className="text-xs text-slate-400">Get a fast decision recommendation</p>
              </div>
              <Button type="button" onClick={() => router.push("/negotiator")} className="h-8 px-3 text-xs">
                Ask AI Coach
              </Button>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-100">Social</p>
                  <p className="text-xs text-slate-400">Shared goals and group challenges</p>
                </div>
                <Button type="button" onClick={() => router.push("/social")} className="h-8 px-3 text-xs">
                  Open social
                </Button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                  <p className="text-xs text-slate-400">Active shared goals</p>
                  <p className="text-lg font-semibold text-slate-100">
                    {socialGoalsLoading ? "Loading..." : socialGoalsCount}
                  </p>
                  {socialGoalsError ? (
                    <p className="text-xs text-rose-300">{socialGoalsError}</p>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                  <p className="text-xs text-slate-400">Current challenge rank</p>
                  <p className="text-lg font-semibold text-slate-100">
                    {socialChallengeRank ? `#${socialChallengeRank}` : "—"}
                  </p>
                  <p className="text-xs text-slate-400">{socialChallengeTitle ?? "No active challenge"}</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Latest badge earned</p>
                  <Button type="button" onClick={() => router.push("/achievements")} className="h-8 px-3 text-xs">
                    View badges
                  </Button>
                </div>
                {latestBadgeError ? (
                  <p className="mt-2 text-xs text-rose-300">{latestBadgeError}</p>
                ) : latestBadgeLoading ? (
                  <p className="mt-2 text-xs text-slate-400">Loading badge...</p>
                ) : latestBadge ? (
                  <div className="mt-2 flex items-center justify-between text-sm text-slate-200">
                    <span className="font-semibold">{latestBadge.badge_name}</span>
                    <span className="text-xs text-slate-400">
                      {latestBadge.earned_at ? new Date(latestBadge.earned_at).toLocaleDateString() : "—"}
                    </span>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">No badges earned yet.</p>
                )}
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-400">Recent friend achievements</p>
                {socialFeedError ? (
                  <p className="text-xs text-rose-300">{socialFeedError}</p>
                ) : socialGoalsLoading ? (
                  <p className="text-xs text-slate-400">Loading achievements...</p>
                ) : socialAchievements.length === 0 ? (
                  <p className="text-xs text-slate-400">No updates yet.</p>
                ) : (
                  socialAchievements.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-xl border border-slate-800 px-3 py-2 text-xs text-slate-200"
                    >
                      <span>{entry.achievement}</span>
                      <span className="text-slate-400">{entry.user_id.slice(0, 6)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <InsightNotifications limit={3} />
              <PositivePatternsPanel limit={1} />
            </div>
            {hasHighRisk ? (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                High risk detected. Consider adjusting load and prioritizing recovery today.
              </div>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span className="text-slate-100">Risk snapshot</span>
                  <button
                    type="button"
                    className="text-xs text-slate-300 hover:text-slate-100"
                    onClick={() => router.push("/risk")}
                  >
                    View all risks
                  </button>
                </div>
                <RiskDashboard compact onHighRisk={setHasHighRisk} />
              </div>
              <WalletSummaryCard />
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-100">Today’s mosaic</p>
                  <p className="text-xs text-slate-400">Your daily balance across eight tiles</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={() => router.push("/mosaic#comparisons")}>
                    View comparisons
                  </Button>
                  <Button type="button" onClick={() => router.push("/mosaic")}>
                    Open mosaic
                  </Button>
                </div>
              </div>
              <div className="mt-4">
                <DailyMosaic date={new Date().toISOString().slice(0, 10)} showHeader={false} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-100">Quick Log</p>
                  <p className="text-xs text-slate-400">Tap to log a moment</p>
                </div>
                <button
                  type="button"
                  className="text-xs text-slate-300 hover:text-slate-100"
                  onClick={() => router.push("/timeline")}
                >
                  View all
                </button>
              </div>
              <div className="mt-4">
                <QuickTapLogger userId={user.id} onLogged={handleLoggedEvent} />
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Recent activity</p>
                  <Button
                    type="button"
                    onClick={() => router.push("/timeline")}
                    className="h-7 px-3 text-xs"
                  >
                    View timeline
                  </Button>
                </div>
                {loadingEvents ? (
                  <span>Loading…</span>
                ) : eventsError || events.length === 0 ? (
                  recentActivityFallback.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 px-3 py-2 text-slate-200"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full border text-base ${recentActivityColorClasses[activity.color]}`}
                        >
                          {activity.icon}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{activity.title}</p>
                          <p className="text-xs text-slate-400">{activity.description}</p>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">{activity.time}</span>
                    </div>
                  ))
                ) : (
                  events.map((event) => {
                    const Icon = eventIcons[event.event_type] ?? Pill;
                    return (
                      <div
                        key={event.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 px-3 py-2 text-slate-200"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{event.title || eventLabels[event.event_type]}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <EventScoreBadges scores={event.scores ?? {}} event={event} />
                          <span>{formatRelativeTime(event.timestamp)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-100">Spending snapshot</p>
                  <p className="text-xs text-slate-400">Quick view of recent spending</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" onClick={() => router.push("/swaps")}>
                    Quick Swap
                  </Button>
                  <Button type="button" onClick={() => router.push("/spending/log")}>
                    Log spending
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                  <p className="text-xs text-slate-400">Spent this week</p>
                  <p className="text-lg font-semibold text-slate-100">
                    ${weeklySpendingTotal.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                  <p className="text-xs text-slate-400">Top category</p>
                  <p className="text-lg font-semibold text-slate-100">{topSpendingCategory}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-400">Swap stats (last 14 days)</p>
                {swapHistoryError ? (
                  <span className="text-rose-300">{swapHistoryError}</span>
                ) : swapHistory.length === 0 ? (
                  <span>No swaps yet</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                    <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1">
                      {swapHistory.length} swaps
                    </span>
                    <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1">
                      Saved $
                      {swapHistory
                        .reduce((sum, item) => sum + Number(item.alternative_data?.savings ?? 0), 0)
                        .toFixed(2)}
                    </span>
                    <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1">
                      {Math.round(
                        swapHistory.reduce(
                          (sum, item) =>
                            sum +
                            Number(
                              (item.alternative_data?.comparison as Record<string, number> | undefined)
                                ?.calories_saved ?? 0
                            ),
                          0
                        )
                      )}{" "}
                      cal saved
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-400">Last 3 spending events</p>
                {loadingSpending ? (
                  <span>Loading…</span>
                ) : recentSpending.length === 0 ? (
                  <span>No spending yet</span>
                ) : (
                  recentSpending.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between rounded-xl border border-slate-800 px-3 py-2 text-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        <span>{event.title}</span>
                      </div>
                      <span className="text-xs text-slate-400">
                        ${Number(event.amount ?? 0).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
                {spendingError ? <p className="text-rose-300">{spendingError}</p> : null}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-100">Food summary</p>
                  <p className="text-xs text-slate-400">Today’s meals and quality</p>
                </div>
                <Button type="button" onClick={() => router.push("/food/log")}>
                  Log meal
                </Button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                  <p className="text-xs text-slate-400">Calories today</p>
                  <p className="text-lg font-semibold text-slate-100">
                    {Math.round(totalCaloriesToday)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                  <p className="text-xs text-slate-400">Meals today</p>
                  <p className="text-lg font-semibold text-slate-100">{todayFoodEvents.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                  <p className="text-xs text-slate-400">Avg nutrition quality</p>
                  <p className="text-lg font-semibold text-slate-100">
                    {avgNutritionQuality ?? "—"}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-400">Last 3 meals</p>
                {loadingFood ? (
                  <span>Loading…</span>
                ) : recentMeals.length === 0 ? (
                  <span>No meals logged yet</span>
                ) : (
                  recentMeals.map((event) => {
                    const nutritionScore = Number(
                      event.metadata?.nutrition_quality_score ?? event.scores?.wellness_impact
                    );
                    const sustainabilityScore = Number(
                      event.metadata?.sustainability_score ?? event.scores?.sustainability_impact
                    );
                    return (
                      <div
                        key={event.id}
                        className="flex items-center justify-between rounded-xl border border-slate-800 px-3 py-2 text-slate-200"
                      >
                        <div className="flex items-center gap-2">
                          <Utensils className="h-4 w-4" />
                          <span>{event.title}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          {Number.isNaN(nutritionScore) ? null : (
                            <span
                              className={`rounded-full border px-2 py-0.5 ${scoreBadgeClass(
                                nutritionScore
                              )}`}
                            >
                              Quality {nutritionScore}
                            </span>
                          )}
                          {Number.isNaN(sustainabilityScore) ? null : (
                            <span
                              className={`rounded-full border px-2 py-0.5 ${scoreBadgeClass(
                                sustainabilityScore
                              )}`}
                            >
                              Sustain {sustainabilityScore}
                            </span>
                          )}
                          <span>{event.amount ? `${Math.round(Number(event.amount))} cal` : "—"}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                {foodError ? <p className="text-rose-300">{foodError}</p> : null}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-100">Movement summary</p>
                  <p className="text-xs text-slate-400">Today’s steps and activity</p>
                </div>
                <Button type="button" onClick={() => router.push("/movement")}>
                  Open movement
                </Button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                  <p className="text-xs text-slate-400">Steps</p>
                  <p className="text-lg font-semibold text-slate-100">
                    {loadingMovementDaily ? "—" : movementDaily?.steps ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                  <p className="text-xs text-slate-400">Active minutes</p>
                  <p className="text-lg font-semibold text-slate-100">
                    {loadingMovementDaily ? "—" : movementDaily?.active_minutes ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                  <p className="text-xs text-slate-400">Workouts</p>
                  <p className="text-lg font-semibold text-slate-100">
                    {loadingMovementDaily ? "—" : movementDaily?.workout_count ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                  <p className="text-xs text-slate-400">Movement score</p>
                  <span
                    className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs ${movementBadgeClass(
                      movementDaily?.total_movement_score
                    )}`}
                  >
                    {loadingMovementDaily
                      ? "—"
                      : `${movementDaily?.total_movement_score ?? 0} / 100`}
                  </span>
                </div>
              </div>
              {movementError ? <p className="mt-2 text-rose-300">{movementError}</p> : null}
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-100">Analytics preview</p>
                  <p className="text-xs text-slate-400">Last 7 days at a glance</p>
                </div>
                <Button type="button" onClick={() => router.push("/analytics")}>
                  View full analytics
                </Button>
              </div>
              <div className="mt-4">
                {analyticsLoading ? <span>Loading…</span> : null}
                {analyticsError ? <p className="text-rose-300">{analyticsError}</p> : null}
                {!analyticsLoading && !analyticsError ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    <TrendLineChart
                      data={spendingTrend}
                      metric="spending"
                      title="Spending trend"
                      color="#fb923c"
                      height={160}
                    />
                    <TrendLineChart
                      data={wellnessTrend}
                      metric="wellness"
                      title="Wellness trend"
                      color="#22c55e"
                      height={160}
                    />
                  </div>
                ) : null}
              </div>
            </div>
            {focusTrackingEnabled ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-slate-100">Focus session</p>
                    <p className="text-xs text-slate-400">Track time spent in focused work</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {focusActive ? (
                      <p className="text-lg font-semibold text-emerald-200">
                        {formatElapsed(focusElapsedSeconds)}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-300">No active session</p>
                    )}
                    {lastFocusSession ? (
                      <p className="text-xs text-slate-400">
                        Last focus session: {formatRelativeTime(lastFocusSession.end_time)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    {focusActive ? (
                      <Button type="button" disabled={focusSaving} onClick={handleEndFocusSession}>
                        {focusSaving ? "Saving..." : "End session"}
                      </Button>
                    ) : (
                      <Button type="button" onClick={handleStartFocusSession}>
                        Start focus session
                      </Button>
                    )}
                  </div>
                </div>
                {focusError ? <p className="mt-2 text-rose-300">{focusError}</p> : null}
              </div>
            ) : null}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Voice check-ins</span>
                <Button type="button" onClick={() => router.push("/checkin/voice")}>
                  Record today’s check-in
                </Button>
              </div>
              <div className="mt-3 space-y-3">
                {loadingCheckins ? (
                  <span>Loading…</span>
                ) : checkins.length === 0 ? (
                  <span>No check-ins yet</span>
                ) : (
                  checkins.map((checkin) => (
                    <div key={checkin.id} className="rounded-xl border border-slate-800 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span>{new Date(checkin.created_at).toLocaleString()}</span>
                        {!checkin.insight ? (
                          <Button
                            type="button"
                            onClick={() => handleProcessCheckin(checkin.id)}
                            disabled={processingId === checkin.id}
                          >
                            {processingId === checkin.id ? "Processing..." : "Process check-in"}
                          </Button>
                        ) : null}
                      </div>
                      {checkin.insight ? (
                        <div className="mt-2 space-y-1 text-slate-200">
                          <p>Mood: {checkin.insight.mood_score}/10</p>
                          <p>Stress: {checkin.insight.stress_score}/10</p>
                          <p>Symptoms: {checkin.insight.symptoms.join(", ") || "None"}</p>
                          <p>{checkin.insight.summary}</p>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
                {checkinsError ? <p className="text-rose-300">{checkinsError}</p> : null}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Movement tests</span>
                <Button type="button" onClick={() => router.push("/checkin/movement")}>
                  Record movement test
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {loadingMovement ? (
                  <span>Loading…</span>
                ) : movementTests.length === 0 ? (
                  <span>No movement tests yet</span>
                ) : (
                  movementTests.map((row) => (
                    <div key={row.id} className="rounded-xl border border-slate-800 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span>{row.test_type}</span>
                        <span>{new Date(row.created_at).toLocaleString()}</span>
                      </div>
                      {row.insight ? (
                        <div className="mt-2 text-slate-200">
                          Form: {row.insight.form_score}, Symmetry: {row.insight.symmetry_score}, ROM:{" "}
                          {row.insight.rom_score}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm">
              {loadingProfile ? (
                <span>Loading profile…</span>
              ) : profiles && profiles.length > 0 ? (
                <span>Your profiles: {profiles.join(", ")}</span>
              ) : (
                <span className="flex items-center justify-between">
                  <span>No profile set</span>
                  <Button
                    className="ml-3"
                    onClick={() => router.push("/onboarding/profile")}
                    type="button"
                  >
                    Set your profile
                  </Button>
                </span>
              )}
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm">
              {loadingSettings ? (
                <span>Loading settings…</span>
              ) : settings ? (
                <div className="space-y-1">
                  <p>Active tiles: {settings.active_tiles.join(", ")}</p>
                  <p>
                    Weekly goals: {settings.weekly_goals.sleepHours}h sleep,{" "}
                    {settings.weekly_goals.workoutsPerWeek} workouts,{" "}
                    {settings.weekly_goals.socialEventsPerWeek} social events
                  </p>
                  <Button
                    className="mt-2"
                    type="button"
                    onClick={() => router.push("/settings/profile")}
                  >
                    Edit settings
                  </Button>
                </div>
              ) : (
                <span className="flex items-center justify-between">
                  <span>No settings yet</span>
                  <Button className="ml-3" type="button" onClick={() => router.push("/settings/profile")}>
                    Create settings
                  </Button>
                </span>
              )}
            </div>
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            <Button onClick={handleSignOut} className="w-full">
              Sign out
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
