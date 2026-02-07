"use client";

import { useEffect, useMemo, useState } from "react";

import { BeforeAfterChart } from "@/components/charts/BeforeAfterChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBeforeAfterComparison } from "@/lib/analytics";
import type { BeforeAfterComparison, ComparisonMetric } from "@/types/analytics";

const metrics: Array<{ metric: ComparisonMetric; title: string }> = [
  { metric: "wellness", title: "Wellness score" },
  { metric: "spending", title: "Spending" },
  { metric: "movement_minutes", title: "Movement minutes" },
];

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

export function ComparisonsPanel() {
  const [interventionDate, setInterventionDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return toDateInput(date);
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comparisons, setComparisons] = useState<Record<ComparisonMetric, BeforeAfterComparison | null>>({
    wellness: null,
    spending: null,
    movement_minutes: null,
    steps: null,
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.all(
          metrics.map((entry) => getBeforeAfterComparison(entry.metric, interventionDate))
        );
        if (!active) {
          return;
        }
        setComparisons((prev) => ({
          ...prev,
          wellness: results[0],
          spending: results[1],
          movement_minutes: results[2],
        }));
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load comparisons.");
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
  }, [interventionDate]);

  const subtitle = useMemo(
    () => `Comparing 14 days before vs after ${interventionDate}`,
    [interventionDate]
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Before & after</h3>
          <p className="text-sm text-slate-400">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={interventionDate}
            onChange={(event) => setInterventionDate(event.target.value)}
            className="w-[160px]"
          />
          <Button type="button" onClick={() => setInterventionDate(toDateInput(new Date()))}>
            Today
          </Button>
        </div>
      </div>
      {loading ? <div className="text-sm text-slate-300">Loading comparisons…</div> : null}
      {error ? <div className="text-sm text-rose-300">{error}</div> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        {metrics.map((entry) => {
          const comparison = comparisons[entry.metric];
          return comparison ? (
            <BeforeAfterChart key={entry.metric} title={entry.title} comparison={comparison} />
          ) : (
            <div
              key={entry.metric}
              className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-sm text-slate-300"
            >
              No data yet.
            </div>
          );
        })}
      </div>
    </section>
  );
}
