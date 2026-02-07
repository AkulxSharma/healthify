"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BellRing, CheckCircle, Flame, HandMetal, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import type { ActivityFeedEntry, ActivityType } from "@/types/social";

type ActivityFeedProps = {
  limit?: number;
  onLoaded?: (entries: ActivityFeedEntry[]) => void;
};

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

const iconMap: Record<ActivityType, ReactNode> = {
  goal_completed: <Trophy className="h-4 w-4 text-amber-200" />,
  milestone: <CheckCircle className="h-4 w-4 text-emerald-200" />,
  swap_accepted: <HandMetal className="h-4 w-4 text-sky-200" />,
  streak: <Flame className="h-4 w-4 text-rose-200" />,
};

const reactionOrder = ["👏", "💪", "🔥"];

export function ActivityFeed({ limit = 20, onLoaded }: ActivityFeedProps) {
  const [entries, setEntries] = useState<ActivityFeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/social/feed?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Unable to load activity feed.");
      }
      const payload = (await res.json()) as ActivityFeedEntry[];
      setEntries(payload);
      onLoaded?.(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load activity feed.";
      setError(message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [limit, onLoaded]);

  useEffect(() => {
    void fetchFeed();
    const interval = setInterval(() => {
      void fetchFeed();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  const handleReact = (index: number, emoji: string) => {
    setEntries((prev) => {
      const next = [...prev];
      const entry = { ...next[index] };
      const reactions = { ...entry.reactions };
      reactions[emoji] = (reactions[emoji] || 0) + 1;
      entry.reactions = reactions;
      next[index] = entry;
      return next;
    });
  };

  const rendered = useMemo(() => {
    if (loading) {
      return <p className="text-sm text-slate-300">Loading feed...</p>;
    }
    if (error) {
      return <p className="text-sm text-rose-300">{error}</p>;
    }
    if (entries.length === 0) {
      return <p className="text-sm text-slate-400">No activity yet.</p>;
    }
    return (
      <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
        {entries.map((entry, index) => (
          <div
            key={`${entry.user}-${entry.timestamp}-${index}`}
            className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-100"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs uppercase">
                  {entry.user.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{entry.user.slice(0, 8)}</span>
                    <span>•</span>
                    <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-300">
                      {entry.activity_type.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="rounded-full border border-slate-800 bg-slate-900/60 p-2">
                {iconMap[entry.activity_type]}
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm font-semibold text-slate-100">{entry.title}</p>
              {entry.description ? (
                <p className="mt-1 text-xs text-slate-300">{entry.description}</p>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                {reactionOrder.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReact(index, emoji)}
                    className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/60 px-2 py-1"
                  >
                    <span>{emoji}</span>
                    <span>{entry.reactions?.[emoji] ?? 0}</span>
                  </button>
                ))}
              </div>
              <Button
                type="button"
                onClick={() => handleReact(index, "👏")}
                className="h-8 px-3 text-xs"
              >
                <BellRing className="mr-1 h-3 w-3" />
                React
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }, [entries, error, loading]);

  return <div>{rendered}</div>;
}
