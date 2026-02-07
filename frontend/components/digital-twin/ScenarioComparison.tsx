"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getScenarioComparison } from "@/lib/digitalTwin";
import type { ScenarioComparison, DivergencePoint } from "@/types/digitalTwin";

type Metric = "wallet" | "wellness" | "sustainability";

type ScenarioComparisonProps = {
  defaultMetric?: Metric;
  height?: number;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const formatCurrency = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const metricLabel: Record<Metric, string> = {
  wallet: "Wallet",
  wellness: "Wellness",
  sustainability: "Sustainability",
};

const seriesColors: Record<string, string> = {
  current: "#f97316",
  with_swaps: "#22c55e",
  custom: "#38bdf8",
};

export function ScenarioComparison({ defaultMetric = "wallet", height = 280 }: ScenarioComparisonProps) {
  const [metric, setMetric] = useState<Metric>(defaultMetric);
  const [sleepHours, setSleepHours] = useState(7.5);
  const [exerciseDays, setExerciseDays] = useState(3);
  const [dailySpending, setDailySpending] = useState(80);
  const [mealQuality, setMealQuality] = useState(6);
  const [comparison, setComparison] = useState<ScenarioComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getScenarioComparison(
      [
        { name: "current" },
        { name: "with_swaps" },
        {
          name: "custom",
          inputs: {
            sleep_hours: sleepHours,
            exercise_days: exerciseDays,
            daily_spending: dailySpending,
            meal_quality: mealQuality,
          },
        },
      ],
      metric,
      30
    )
      .then((payload) => {
        setComparison(payload);
        setError(null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load scenario comparison.";
        setError(message);
        setComparison(null);
      })
      .finally(() => setLoading(false));
  }, [metric, sleepHours, exerciseDays, dailySpending, mealQuality]);

  const divergenceByDate = useMemo(() => {
    return (comparison?.divergence_points ?? []).reduce<Record<string, DivergencePoint>>((acc, point) => {
      acc[point.date] = point;
      return acc;
    }, {});
  }, [comparison]);

  const chartData = useMemo(() => {
    if (!comparison) {
      return [];
    }
    const merged: Record<string, { date: string; [key: string]: number | string }> = {};
    comparison.scenarios.forEach((scenario) => {
      scenario.data.forEach((point) => {
        if (!merged[point.date]) {
          merged[point.date] = { date: point.date };
        }
        merged[point.date][scenario.name] = point.value;
      });
    });
    return Object.values(merged).sort((a, b) => a.date.localeCompare(b.date));
  }, [comparison]);

  const summary = useMemo(() => {
    if (!comparison) {
      return "";
    }
    const current = comparison.scenarios.find((scenario) => scenario.name === "current");
    const custom = comparison.scenarios.find((scenario) => scenario.name === "custom");
    if (!current || !custom) {
      return "";
    }
    const delta = custom.final_value - current.final_value;
    if (metric === "wallet") {
      return `Custom scenario saves ${formatCurrency(delta)} more.`;
    }
    if (metric === "wellness") {
      return `Custom scenario improves wellness by ${delta.toFixed(1)} pts.`;
    }
    const percent = current.final_value === 0 ? 0 : (delta / current.final_value) * 100;
    return `Custom scenario reduces footprint by ${Math.abs(percent).toFixed(0)}%.`;
  }, [comparison, metric]);

  const divergenceMarkers = useMemo(() => {
    return (comparison?.divergence_points ?? []).map((point) => {
      const datum = chartData.find((row) => row.date === point.date);
      const value =
        (datum?.custom as number | undefined) ??
        (datum?.with_swaps as number | undefined) ??
        (datum?.current as number | undefined) ??
        0;
      return { date: point.date, value, impact: point.impact };
    });
  }, [comparison, chartData]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Compare scenarios</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-slate-400">Metric</p>
              <select
                value={metric}
                onChange={(event) => setMetric(event.target.value as Metric)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
              >
                {(["wallet", "wellness", "sustainability"] as Metric[]).map((option) => (
                  <option key={option} value={option}>
                    {metricLabel[option]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Sleep hours <span className="text-slate-200">{sleepHours.toFixed(1)}h</span>
              </p>
              <input
                type="range"
                min={5}
                max={9}
                step={0.5}
                value={sleepHours}
                onChange={(event) => setSleepHours(Number(event.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Exercise days <span className="text-slate-200">{exerciseDays} / week</span>
              </p>
              <input
                type="range"
                min={0}
                max={7}
                step={1}
                value={exerciseDays}
                onChange={(event) => setExerciseDays(Number(event.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Daily spending <span className="text-slate-200">{formatCurrency(dailySpending)}</span>
              </p>
              <input
                type="range"
                min={0}
                max={200}
                step={5}
                value={dailySpending}
                onChange={(event) => setDailySpending(Number(event.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Meal quality <span className="text-slate-200">{mealQuality} / 10</span>
              </p>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={mealQuality}
                onChange={(event) => setMealQuality(Number(event.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>
          </div>
        </div>
        {summary ? <div className="text-sm text-emerald-200">{summary}</div> : null}
        {loading ? (
          <div className="text-sm text-slate-300">Loading comparison...</div>
        ) : error ? (
          <div className="text-sm text-rose-200">{error}</div>
        ) : comparison ? (
          <>
            <div style={{ height }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    stroke="#475569"
                  />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} stroke="#475569" />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) {
                        return null;
                      }
                      const divergence = divergenceByDate[label as string];
                      return (
                        <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200">
                          <p className="text-slate-300">{formatDate(label as string)}</p>
                          <div className="mt-2 space-y-1">
                            {payload.map((entry) => (
                              <div key={entry.dataKey as string} className="flex items-center justify-between">
                                <span className="capitalize text-slate-300">
                                  {(entry.dataKey as string).replace("_", " ")}
                                </span>
                                <span>{Number(entry.value).toFixed(1)}</span>
                              </div>
                            ))}
                          </div>
                          {divergence ? (
                            <p className="mt-2 text-[11px] text-emerald-200">
                              Divergence impact {divergence.impact.toFixed(1)}
                            </p>
                          ) : null}
                        </div>
                      );
                    }}
                  />
                  {["current", "with_swaps", "custom"].map((key) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={seriesColors[key]}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                  {divergenceMarkers.map((marker) => (
                    <ReferenceDot
                      key={marker.date}
                      x={marker.date}
                      y={marker.value}
                      r={4}
                      fill="#facc15"
                      stroke="#facc15"
                      label={{ value: "★", position: "top", fill: "#facc15", fontSize: 10 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {comparison.divergence_points.length > 0 ? (
              <div className="space-y-2 text-xs text-slate-300">
                <p className="uppercase tracking-wide text-slate-400">Divergence points</p>
                <div className="flex flex-wrap gap-2">
                  {comparison.divergence_points.map((point) => (
                    <span
                      key={point.date}
                      className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1"
                    >
                      {formatDate(point.date)} · impact {point.impact.toFixed(1)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="text-sm text-slate-300">No scenario data yet.</div>
        )}
      </CardContent>
    </Card>
  );
}
