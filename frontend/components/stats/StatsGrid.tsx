"use client";

import { useEffect, useMemo, useState } from "react";

import type { LucideIcon } from "lucide-react";
import { DollarSign, Dumbbell, Footprints, HeartPulse, PiggyBank, Repeat, Utensils } from "lucide-react";

import { StatTile } from "@/components/stats/StatTile";
import { Button } from "@/components/ui/button";
import { getDashboardStats } from "@/lib/analytics";
import type { DashboardPeriod, DashboardStats, StatKey } from "@/types/analytics";

type StatTileConfig = {
  key: StatKey;
  title: string;
  unit?: string;
  color: string;
  icon: LucideIcon;
};

const tiles: StatTileConfig[] = [
  {
    key: "spending_total",
    title: "Spending",
    unit: "$",
    color: "bg-orange-500/20 text-orange-200",
    icon: DollarSign,
  },
  {
    key: "steps_total",
    title: "Steps",
    unit: "steps",
    color: "bg-emerald-500/20 text-emerald-200",
    icon: Footprints,
  },
  {
    key: "meals_logged",
    title: "Meals",
    unit: "meals",
    color: "bg-sky-500/20 text-sky-200",
    icon: Utensils,
  },
  {
    key: "workouts_completed",
    title: "Workouts",
    unit: "workouts",
    color: "bg-purple-500/20 text-purple-200",
    icon: Dumbbell,
  },
  {
    key: "wellness_score_avg",
    title: "Wellness",
    unit: "avg",
    color: "bg-emerald-500/20 text-emerald-200",
    icon: HeartPulse,
  },
  {
    key: "swaps_accepted",
    title: "Swaps",
    unit: "swaps",
    color: "bg-amber-500/20 text-amber-200",
    icon: Repeat,
  },
  {
    key: "money_saved_via_swaps",
    title: "Savings",
    unit: "$",
    color: "bg-teal-500/20 text-teal-200",
    icon: PiggyBank,
  },
];

const periodOptions: Array<{ label: string; value: DashboardPeriod }> = [
  { label: "This week", value: "week" },
  { label: "This month", value: "month" },
];

export function StatsGrid() {
  const [period, setPeriod] = useState<DashboardPeriod>("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getDashboardStats(period);
        if (!active) {
          return;
        }
        setStats(payload);
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load dashboard stats.");
        setStats(null);
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
  }, [period]);

  const subtitle = useMemo(() => {
    const selected = periodOptions.find((option) => option.value === period);
    return selected ? selected.label : "Stats overview";
  }, [period]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Stats tiles</h3>
          <p className="text-sm text-slate-400">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {periodOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              className={
                option.value === period
                  ? "bg-slate-200 text-slate-900 hover:bg-slate-100"
                  : "bg-slate-900 text-slate-200"
              }
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
      {loading ? <div className="text-sm text-slate-300">Loading stats…</div> : null}
      {error ? <div className="text-sm text-rose-300">{error}</div> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => {
          const stat = stats?.stats[tile.key];
          return (
            <StatTile
              key={tile.key}
              title={tile.title}
              value={stat?.value ?? 0}
              unit={tile.unit}
              change={stat?.change_percent}
              icon={tile.icon}
              color={tile.color}
            />
          );
        })}
      </div>
    </section>
  );
}
