"use client";

import { useEffect, useState } from "react";
import { Flame, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPositivePatterns } from "@/lib/insights";
import type { PositivePattern } from "@/types/insights";

type PositivePatternsPanelProps = {
  limit?: number;
};

export function PositivePatternsPanel({ limit = 3 }: PositivePatternsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patterns, setPatterns] = useState<PositivePattern[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getPositivePatterns(30)
      .then((data) => {
        if (!active) {
          return;
        }
        setPatterns(data.slice(0, limit));
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load positive patterns.");
        setPatterns([]);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [limit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Positive patterns</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <p className="text-sm text-slate-300">Loading…</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {!loading &&
          !error &&
          patterns.map((pattern) => (
            <div
              key={`${pattern.pattern}-${pattern.started_date}`}
              className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-emerald-50">{pattern.pattern}</p>
                  <p className="text-xs text-emerald-200">{pattern.message}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-100">
                  <span className="rounded-full border border-emerald-500/40 px-2 py-1">
                    {pattern.improvement}
                  </span>
                  <span className="flex items-center gap-1">
                    <Flame className="h-3 w-3" /> {pattern.streak}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-emerald-100">{pattern.encouragement}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-emerald-200">Since {pattern.started_date}</span>
                <Button type="button" className="h-8 px-3 text-xs">
                  <Share2 className="mr-1 h-3 w-3" /> Share achievement
                </Button>
              </div>
            </div>
          ))}
        {!loading && !error && patterns.length === 0 ? (
          <p className="text-sm text-slate-300">No positive patterns yet.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
