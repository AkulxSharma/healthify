"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, MapPin, Smile, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTriggers } from "@/lib/insights";
import type { TriggerEntry, TriggerInsightResponse } from "@/types/insights";

type PatternOption = {
  label: string;
  value: string;
};

const patterns: PatternOption[] = [
  { label: "Overspending", value: "overspending" },
  { label: "Skipped workouts", value: "skipped workouts" },
  { label: "Poor food choices", value: "poor food choices" },
  { label: "Low mood", value: "low mood" },
];

const triggerIcon = (type: TriggerEntry["type"]) => {
  switch (type) {
    case "location":
      return MapPin;
    case "mood":
      return Smile;
    case "social":
      return Users;
    case "time":
    default:
      return Clock;
  }
};

export function TriggersPanel() {
  const [pattern, setPattern] = useState(patterns[0].value);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TriggerInsightResponse | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getTriggers(pattern, 30);
        if (!active) {
          return;
        }
        setData(payload);
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load triggers.");
        setData(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [pattern]);

  const triggers = useMemo(() => data?.triggers ?? [], [data]);
  const recommendations = useMemo(() => data?.recommendations ?? [], [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Find your triggers</CardTitle>
        <p className="text-sm text-slate-400">Surface the contexts that amplify patterns.</p>
        <div className="mt-2">
          <select
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          >
            {patterns.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-200">
        {loading ? <div>Loading triggers…</div> : null}
        {error ? <div className="text-rose-300">{error}</div> : null}
        {!loading && !error && triggers.length === 0 ? (
          <div className="text-slate-300">No triggers detected yet.</div>
        ) : null}
        {triggers.map((trigger) => {
          const Icon = triggerIcon(trigger.type);
          const pct = Math.round(trigger.occurrence_rate * 100);
          return (
            <div
              key={`${trigger.type}-${trigger.value}`}
              className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-slate-300" />
                  <span className="text-sm text-slate-100">{trigger.value}</span>
                </div>
                <span className="text-xs text-slate-400">{pct}%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-900">
                <div
                  className="h-2 rounded-full bg-emerald-500/70"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Impact: {trigger.impact_metric.replace("_", " ")} {trigger.impact_value.toFixed(1)}
              </div>
            </div>
          );
        })}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">Recommendations</p>
          {recommendations.length === 0 ? (
            <div className="text-sm text-slate-300">No recommendations yet.</div>
          ) : (
            <ul className="space-y-2 text-sm text-slate-200">
              {recommendations.map((item) => (
                <li key={item} className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
