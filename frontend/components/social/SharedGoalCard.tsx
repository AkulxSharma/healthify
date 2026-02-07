"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GoalProgressEntry, SharedGoal } from "@/types/social";

type SharedGoalCardProps = {
  goal: SharedGoal;
  progress: GoalProgressEntry[];
  onShare?: (goal: SharedGoal) => void;
};

const getInitials = (value: string) => value.slice(0, 2).toUpperCase();

export function SharedGoalCard({ goal, progress, onShare }: SharedGoalCardProps) {
  const teamProgress = useMemo(() => {
    if (progress.length === 0) {
      return 0;
    }
    const total = progress.reduce((sum, entry) => sum + entry.pct, 0);
    return Math.round(total / progress.length);
  }, [progress]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{goal.title}</CardTitle>
          <CardDescription>{goal.description || "Shared goal"}</CardDescription>
        </div>
        <Button type="button" onClick={() => onShare?.(goal)} className="h-8 px-3 text-xs">
          Share update
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-200">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Team: {teamProgress}% complete
          </p>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-900">
            <div
              className="h-2 rounded-full bg-emerald-500"
              style={{ width: `${teamProgress}%` }}
            />
          </div>
        </div>
        <div className="space-y-3">
          {progress.length === 0 ? (
            <p className="text-sm text-slate-400">No participant updates yet.</p>
          ) : (
            progress.map((entry) => (
              <div
                key={entry.user}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-100">
                    {getInitials(entry.user)}
                    <span className="absolute -bottom-2 -right-2 rounded-full border border-slate-800 bg-slate-900 px-1 text-[10px] text-emerald-200">
                      {Math.round(entry.pct)}%
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {entry.user.slice(0, 8)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {entry.current} / {entry.target}
                    </p>
                  </div>
                </div>
                <div className="w-32">
                  <div className="h-2 w-full rounded-full bg-slate-900">
                    <div
                      className="h-2 rounded-full bg-emerald-400"
                      style={{ width: `${Math.round(entry.pct)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
