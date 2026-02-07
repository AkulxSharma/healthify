"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Flame, Leaf, Medal, PiggyBank, Repeat } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BadgeProgress, BadgeType } from "@/types/achievements";

type BadgeDisplayProps = {
  badges: BadgeProgress[];
};

const iconMap: Record<BadgeType, ReactNode> = {
  savings_master: <PiggyBank className="h-5 w-5" />,
  wellness_warrior: <Medal className="h-5 w-5" />,
  eco_champion: <Leaf className="h-5 w-5" />,
  streak_king: <Flame className="h-5 w-5" />,
  swap_expert: <Repeat className="h-5 w-5" />,
};

export function BadgeDisplay({ badges }: BadgeDisplayProps) {
  const [selected, setSelected] = useState<BadgeProgress | null>(null);

  const sorted = useMemo(() => {
    return [...badges].sort((a, b) => {
      if (a.earned_at && !b.earned_at) return -1;
      if (!a.earned_at && b.earned_at) return 1;
      return a.badge_name.localeCompare(b.badge_name);
    });
  }, [badges]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((badge) => {
          const earned = Boolean(badge.earned_at);
          const progressPct =
            badge.progress_target > 0
              ? Math.min(100, Math.round((badge.progress_current / badge.progress_target) * 100))
              : 0;
          return (
            <button
              key={badge.badge_name}
              type="button"
              onClick={() => setSelected(badge)}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                earned
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                  : "border-slate-800 bg-slate-950/60 text-slate-400"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                    earned ? "border-emerald-500/40 bg-emerald-500/20" : "border-slate-800 bg-slate-900/60"
                  }`}
                >
                  {iconMap[badge.badge_type]}
                </div>
                <div>
                  <p className="text-sm font-semibold">{badge.badge_name}</p>
                  <p className="text-xs text-slate-400">
                    {earned && badge.earned_at
                      ? `Earned ${new Date(badge.earned_at).toLocaleDateString()}`
                      : "In progress"}
                  </p>
                </div>
              </div>
              {!earned ? (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {badge.progress_current}/{badge.progress_target}
                    </span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-slate-900">
                    <div
                      className="h-2 rounded-full bg-emerald-500/60"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold">{selected.badge_name}</p>
                <p className="text-sm text-slate-400">{selected.badge_type.replace("_", " ")}</p>
              </div>
              <Button
                type="button"
                className="border border-slate-800 bg-transparent text-slate-200 hover:bg-slate-900"
                onClick={() => setSelected(null)}
              >
                Close
              </Button>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm">
              {selected.earned_at ? (
                <p>Earned on {new Date(selected.earned_at).toLocaleDateString()}</p>
              ) : (
                <p>
                  Progress {selected.progress_current}/{selected.progress_target}
                </p>
              )}
            </div>
            <div className="mt-4 text-sm text-slate-300">
              Keep stacking progress to unlock this badge.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
