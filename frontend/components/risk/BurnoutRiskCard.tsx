"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBurnoutRisk } from "@/lib/risk";
import type { BurnoutRisk } from "@/types/risk";

type BurnoutRiskCardProps = {
  days?: number;
  onRiskLoad?: (risk: BurnoutRisk | null) => void;
};

const levelStyles: Record<BurnoutRisk["level"], string> = {
  low: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  medium: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  high: "bg-rose-500/20 text-rose-200 border-rose-500/40",
};

const gaugeStyles: Record<BurnoutRisk["level"], string> = {
  low: "bg-emerald-400",
  medium: "bg-amber-400",
  high: "bg-rose-400",
};

export function BurnoutRiskCard({ days = 7, onRiskLoad }: BurnoutRiskCardProps) {
  const [data, setData] = useState<BurnoutRisk | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setLoading(true);
    getBurnoutRisk(days)
      .then((payload) => {
        setData(payload);
        setError(null);
        onRiskLoad?.(payload);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load burnout risk.";
        setError(message);
        setData(null);
        onRiskLoad?.(null);
      })
      .finally(() => setLoading(false));
  }, [days, onRiskLoad]);

  const topFactors = useMemo(() => data?.factors.slice(0, 3) ?? [], [data]);
  const maxImpact = useMemo(
    () => Math.max(1, ...(data?.factors.map((factor) => factor.impact) ?? [1])),
    [data]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Burnout risk</CardTitle>
        <CardDescription>Signals from the last {days} days.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="text-sm text-slate-300">Loading risk score...</div>
        ) : error ? (
          <div className="text-sm text-rose-200">{error}</div>
        ) : data ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Risk score</p>
                <p className="text-3xl font-semibold text-slate-100">{Math.round(data.risk)}</p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${levelStyles[data.level]}`}
              >
                {data.level}
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-800/60">
              <div
                className={`h-3 rounded-full ${gaugeStyles[data.level]}`}
                style={{ width: `${Math.min(100, Math.max(0, data.risk))}%` }}
              />
            </div>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Top factors</p>
              {topFactors.length === 0 ? (
                <div className="text-sm text-slate-300">No dominant factors yet.</div>
              ) : (
                topFactors.map((factor) => (
                  <div key={factor.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>{factor.name}</span>
                      <span>{factor.details}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800/60">
                      <div
                        className="h-2 rounded-full bg-indigo-400"
                        style={{
                          width: `${Math.min(100, Math.max(0, (factor.impact / maxImpact) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">Recommendations</p>
              {data.recommendations.length === 0 ? (
                <div className="text-sm text-slate-300">You are trending well this week.</div>
              ) : (
                <div className="space-y-2">
                  {data.recommendations.map((item) => (
                    <label key={item} className="flex items-center gap-2 text-sm text-slate-200">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-700 bg-slate-900" />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowDetails((prev) => !prev)}
                className="text-xs uppercase tracking-wide text-slate-400"
              >
                {showDetails ? "Hide details" : "View details"}
              </button>
              {showDetails ? (
                <div className="space-y-2 text-sm text-slate-200">
                  {data.factors.length === 0 ? (
                    <div className="text-slate-300">No additional factors.</div>
                  ) : (
                    data.factors.map((factor) => (
                      <div
                        key={factor.name}
                        className="flex items-center justify-between rounded-xl border border-slate-800 px-3 py-2"
                      >
                        <span>{factor.name}</span>
                        <span className="text-slate-400">{factor.details}</span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-300">No data yet.</div>
        )}
      </CardContent>
    </Card>
  );
}
