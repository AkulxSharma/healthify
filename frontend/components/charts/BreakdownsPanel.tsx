"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { getBreakdownData } from "@/lib/analytics";
import type { BreakdownData } from "@/types/analytics";
import { BreakdownPieChart } from "@/components/charts/BreakdownPieChart";

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

const sumValues = (data: BreakdownData[]): number =>
  data.reduce((total, item) => total + (Number(item.value) || 0), 0);

export function BreakdownsPanel() {
  const [rangeDays, setRangeDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spending, setSpending] = useState<BreakdownData[]>([]);
  const [food, setFood] = useState<BreakdownData[]>([]);
  const [time, setTime] = useState<BreakdownData[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { start, end } = toRange(rangeDays);
        const [spendingData, foodData, timeData] = await Promise.all([
          getBreakdownData("spending_by_category", start, end),
          getBreakdownData("food_by_quality", start, end),
          getBreakdownData("time_by_activity", start, end),
        ]);
        if (!active) {
          return;
        }
        setSpending(spendingData);
        setFood(foodData);
        setTime(timeData);
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load breakdowns.");
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
    return selected ? `Last ${selected.label.toLowerCase()}` : "Recent breakdowns";
  }, [rangeDays]);

  const spendingTotal = sumValues(spending);
  const foodTotal = sumValues(food);
  const timeTotal = sumValues(time);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Breakdowns</h3>
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
      {loading ? <div className="text-sm text-slate-300">Loading breakdowns…</div> : null}
      {error ? <div className="text-sm text-rose-300">{error}</div> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownPieChart
          data={spending}
          title="Spending by category"
          totalLabel="Total"
          totalValue={`$${spendingTotal.toFixed(2)}`}
        />
        <BreakdownPieChart
          data={food}
          title="Food choices by quality"
          totalLabel="Entries"
          totalValue={`${Math.round(foodTotal)}`}
        />
        <BreakdownPieChart
          data={time}
          title="Time allocation"
          totalLabel="Minutes"
          totalValue={`${Math.round(timeTotal)}`}
        />
      </div>
    </section>
  );
}
