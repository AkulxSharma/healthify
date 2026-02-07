"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { BadgeDisplay } from "@/components/achievements/BadgeDisplay";
import { BadgeNotification } from "@/components/achievements/BadgeNotification";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { supabase } from "@/lib/supabaseClient";
import type { BadgeProgress } from "@/types/achievements";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

const getToken = async (): Promise<string> => {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Authorization required");
  }
  return token;
};

export default function AchievementsPage() {
  const router = useRouter();
  const { user, loading } = useSupabaseSession();
  const [badges, setBadges] = useState<BadgeProgress[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [badgeToast, setBadgeToast] = useState<BadgeProgress | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const load = async () => {
      setStatus(null);
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE}/achievements/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Unable to load achievements.");
        }
        const payload = (await res.json()) as BadgeProgress[];
        setBadges(payload);
        const earned = payload.filter((badge) => badge.earned_at);
        const latest = earned.sort((a, b) => {
          const aTime = a.earned_at ? new Date(a.earned_at).getTime() : 0;
          const bTime = b.earned_at ? new Date(b.earned_at).getTime() : 0;
          return bTime - aTime;
        })[0];
        if (latest) {
          const stored = localStorage.getItem("lastBadgeSeen");
          if (stored !== latest.badge_name) {
            setBadgeToast(latest);
            localStorage.setItem("lastBadgeSeen", latest.badge_name);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load achievements.";
        setStatus(message);
        setBadges([]);
      }
    };
    void load();
  }, [user]);

  const earnedCount = useMemo(
    () => badges.filter((badge) => Boolean(badge.earned_at)).length,
    [badges]
  );

  const nextBadge = useMemo(() => {
    const locked = badges.filter((badge) => !badge.earned_at && badge.progress_target > 0);
    if (locked.length === 0) {
      return null;
    }
    return locked.reduce((best, current) => {
      const bestPct = best.progress_current / Math.max(1, best.progress_target);
      const currentPct = current.progress_current / Math.max(1, current.progress_target);
      return currentPct > bestPct ? current : best;
    });
  }, [badges]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-200 px-6 py-10">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Achievements</CardTitle>
            <CardDescription>Track your badge collection and next milestones.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">Badges earned</p>
                <p className="text-2xl font-semibold">
                  {earnedCount}/20
                </p>
              </div>
              <Button type="button" onClick={() => router.push("/dashboard")}>
                Back to dashboard
              </Button>
            </div>
            {nextBadge ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
                Next badge: {nextBadge.badge_name}: {nextBadge.progress_current}/
                {nextBadge.progress_target}
              </div>
            ) : null}
            {status ? <p className="text-sm text-rose-300">{status}</p> : null}
            <BadgeDisplay badges={badges} />
          </CardContent>
        </Card>
      </main>
      <BadgeNotification badge={badgeToast} open={Boolean(badgeToast)} onClose={() => setBadgeToast(null)} />
    </div>
  );
}
