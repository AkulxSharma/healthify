"use client";

import { useMemo } from "react";

import type { ComparisonStats } from "@/types/social";

type ComparisonViewProps = {
  myStats: ComparisonStats;
  friendStats: ComparisonStats;
};

const metrics: Array<{ key: keyof ComparisonStats; label: string; unit?: string }> = [
  { key: "savings", label: "Savings", unit: "$" },
  { key: "wellness", label: "Wellness" },
  { key: "sustainability", label: "Sustainability" },
];

export function ComparisonView({ myStats, friendStats }: ComparisonViewProps) {
  const message = useMemo(() => {
    const diff = myStats.savings - friendStats.savings;
    if (diff > 0) {
      return "You're ahead in savings! 💰";
    }
    if (diff < 0) {
      return "Your friend is ahead in savings. Keep going! 💪";
    }
    return "You're neck and neck on savings. Nice!";
  }, [friendStats.savings, myStats.savings]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
        {message}
      </div>
      <div className="space-y-4">
        {metrics.map((metric) => {
          const myValue = myStats[metric.key];
          const friendValue = friendStats[metric.key];
          const max = Math.max(Math.abs(myValue), Math.abs(friendValue), 1);
          const myPct = Math.round((Math.abs(myValue) / max) * 100);
          const friendPct = Math.round((Math.abs(friendValue) / max) * 100);
          const diff = Math.round((myValue - friendValue) * 100) / 100;
          const diffLabel = diff >= 0 ? `+${diff}` : `${diff}`;
          return (
            <div key={metric.key} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
              <div className="flex items-center justify-between text-sm text-slate-200">
                <span>{metric.label}</span>
                <span className="text-xs text-slate-400">{diffLabel}</span>
              </div>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Me</span>
                  <span>
                    {metric.unit ? metric.unit : ""}
                    {myValue}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-900">
                  <div className="h-2 rounded-full bg-emerald-500/70" style={{ width: `${myPct}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Friend</span>
                  <span>
                    {metric.unit ? metric.unit : ""}
                    {friendValue}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-900">
                  <div className="h-2 rounded-full bg-sky-500/70" style={{ width: `${friendPct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
