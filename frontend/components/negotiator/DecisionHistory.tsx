"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDecisionHistory } from "@/lib/negotiator";
import type { DecisionHistoryEntry } from "@/types/negotiator";

type DecisionFilter = "all" | "did_it" | "took_alternative" | "skipped";

const filterLabels: Record<DecisionFilter, string> = {
  all: "All",
  did_it: "Did it",
  took_alternative: "Alternative",
  skipped: "Skipped",
};

const decisionBadge: Record<DecisionHistoryEntry["decision"], string> = {
  did_it: "bg-rose-500/20 text-rose-200",
  took_alternative: "bg-emerald-500/20 text-emerald-200",
  skipped: "bg-slate-700/30 text-slate-200",
};

export function DecisionHistory() {
  const [history, setHistory] = useState<DecisionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DecisionFilter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    setError(null);
    getDecisionHistory(40, 0)
      .then((rows) => setHistory(rows))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Unable to load decision history.")
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return history;
    return history.filter((entry) => entry.decision === filter);
  }, [filter, history]);

  const stats = useMemo(() => {
    const totalSaved = history.reduce((sum, entry) => sum + (entry.savings || 0), 0);
    const altCount = history.filter((entry) => entry.decision === "took_alternative").length;
    const skippedCount = history.filter((entry) => entry.decision === "skipped").length;
    const skipRate = history.length ? Math.round((skippedCount / history.length) * 100) : 0;
    return {
      totalSaved: totalSaved.toFixed(2),
      altCount,
      skipRate,
    };
  }, [history]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Decision history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-400">Total saved</p>
            <p className="text-lg font-semibold text-emerald-200">${stats.totalSaved}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Alternatives taken</p>
            <p className="text-lg font-semibold text-slate-100">{stats.altCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Skip rate</p>
            <p className="text-lg font-semibold text-slate-100">{stats.skipRate}%</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(filterLabels).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              className={
                filter === key
                  ? "h-8 px-3 text-xs bg-slate-200 text-slate-900 hover:bg-slate-100"
                  : "h-8 px-3 text-xs bg-slate-900 text-slate-200"
              }
              onClick={() => setFilter(key as DecisionFilter)}
            >
              {label}
            </Button>
          ))}
        </div>
        {loading ? <p className="text-sm text-slate-300">Loading history…</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {!loading && !error && filtered.length === 0 ? (
          <p className="text-sm text-slate-300">No decisions logged yet.</p>
        ) : null}
        <div className="space-y-3">
          {filtered.map((entry) => {
            const key = `${entry.query}-${entry.date}`;
            const impacts = entry.impacts || {};
            const health = impacts.health_impact || {};
            const sustainability = impacts.sustainability_impact || {};
            const cost = impacts.cost_impact || {};
            const summaryLine = `$${(entry.savings ?? 0).toFixed(2)} saved · ${health.calories ?? 0} cal · ${sustainability.co2e_kg ?? 0}kg CO₂`;
            return (
              <div key={key} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-400">{new Date(entry.date).toLocaleString()}</p>
                    <p className="text-sm font-semibold text-slate-100">{entry.query}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs ${decisionBadge[entry.decision]}`}>
                    {entry.decision === "did_it" ? "Did it" : entry.decision === "took_alternative" ? "Alternative" : "Skipped"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-300">{summaryLine}</p>
                <button
                  type="button"
                  className="mt-2 text-xs underline"
                  onClick={() => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))}
                >
                  {expanded[key] ? "Hide details" : "View details"}
                </button>
                {expanded[key] ? (
                  <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
                    <div>
                      <p className="text-slate-400">Cost</p>
                      <p>${cost.immediate ?? 0} · {cost.budget_pct ?? 0}%</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Health</p>
                      <p>{health.calories ?? 0} cal · {health.wellness_change ?? 0} wellness</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Sustainability</p>
                      <p>{sustainability.co2e_kg ?? 0}kg · {sustainability.score_change ?? 0} score</p>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
