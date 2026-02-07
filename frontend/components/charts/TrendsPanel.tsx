"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { getTrendData } from "@/lib/analytics";
import type { TrendData } from "@/types/analytics";
import { TrendLineChart } from "@/components/charts/TrendLineChart";

type RangeOption = {
  label: string;
  days: number;
};

const ranges: RangeOption[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

const toRange = (days: number): { start: string; end: string } => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);
  return { start: start.toISOString(), end: end.toISOString() };
};

export function TrendsPanel() {
  const [rangeDays, setRangeDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spending, setSpending] = useState<TrendData[]>([]);
  const [wellness, setWellness] = useState<TrendData[]>([]);
  const [sustainability, setSustainability] = useState<TrendData[]>([]);
  const [movement, setMovement] = useState<TrendData[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { start, end } = toRange(rangeDays);
        const [spendingData, wellnessData, sustainabilityData, movementData] =
          await Promise.all([
            getTrendData("spending", start, end),
            getTrendData("wellness", start, end),
            getTrendData("sustainability", start, end),
            getTrendData("movement_minutes", start, end),
          ]);
        if (!active) {
          return;
        }
        setSpending(spendingData);
        setWellness(wellnessData);
        setSustainability(sustainabilityData);
        setMovement(movementData);
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load trends.");
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
    return selected ? `Last ${selected.label.toLowerCase()}` : "Recent trends";
  }, [rangeDays]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Trends over time</h3>
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
      </div>
      {loading ? <div className="text-sm text-slate-300">Loading trends…</div> : null}
      {error ? <div className="text-sm text-rose-300">{error}</div> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendLineChart
          data={spending}
          metric="spending"
          title="Spending trajectory"
          color="#fb923c"
        />
        <TrendLineChart
          data={wellness}
          metric="wellness"
          title="Wellness score"
          color="#22c55e"
        />
        <TrendLineChart
          data={sustainability}
          metric="sustainability"
          title="Sustainability score"
          color="#38bdf8"
        />
        <TrendLineChart
          data={movement}
          metric="movement_minutes"
          title="Movement minutes"
          color="#a855f7"
        />
      </div>
    </section>
  );
}
