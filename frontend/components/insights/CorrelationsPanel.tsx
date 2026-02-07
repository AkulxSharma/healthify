"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCorrelations } from "@/lib/insights";
import type { CorrelationInsight } from "@/types/insights";

type RangeOption = {
  label: string;
  days: number;
};

const ranges: RangeOption[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

const formatConfidence = (value: number) => `${Math.round(value * 100)}% confidence`;

export function CorrelationsPanel() {
  const [rangeDays, setRangeDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<CorrelationInsight[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getCorrelations(rangeDays);
        if (!active) {
          return;
        }
        setInsights(data);
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load correlations.");
        setInsights([]);
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
  }, [rangeDays]);

  const subtitle = useMemo(() => {
    const selected = ranges.find((range) => range.days === rangeDays);
    return selected ? `Last ${selected.label.toLowerCase()}` : "Recent insights";
  }, [rangeDays]);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-lg">What’s affecting your life</CardTitle>
          <p className="text-sm text-slate-400">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ranges.map((range) => (
            <Button
              key={range.days}
              type="button"
              onClick={() => setRangeDays(range.days)}
              className={
                range.days === rangeDays
                  ? "bg-slate-200 text-slate-900 hover:bg-slate-100"
                  : "bg-slate-900 text-slate-200"
              }
            >
              {range.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-200">
        {loading ? <div>Loading correlations…</div> : null}
        {error ? <div className="text-rose-300">{error}</div> : null}
        {!loading && !error && insights.length === 0 ? (
          <div className="text-slate-300">No correlations detected yet.</div>
        ) : null}
        {insights.map((insight) => {
          const positive = insight.impact_value >= 0;
          const impactClass = positive ? "text-emerald-300" : "text-rose-300";
          const arrow = positive ? "↑" : "↓";
          return (
            <div
              key={`${insight.pattern}-${insight.impact_metric}`}
              className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-100">{insight.pattern}</p>
                  <p className={`mt-1 text-sm ${impactClass}`}>
                    {arrow} {insight.impact_description}
                  </p>
                </div>
                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-200">
                  {formatConfidence(insight.confidence)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1">
                  {insight.frequency} times
                </span>
                <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1">
                  Impact: {insight.impact_metric.replace("_", " ")}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-300">Recommendation: {insight.recommendation}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
