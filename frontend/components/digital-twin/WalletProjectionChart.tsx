"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  RecurringExpense,
  WalletLongTermProjection,
  WalletProjection,
  WalletTrajectoryPoint,
} from "@/types/digitalTwin";

type WalletProjectionChartProps = {
  shortProjection: WalletProjection;
  longProjection: WalletLongTermProjection | null;
  longTermMonths: number;
  onLongTermMonthsChange: (months: number) => void;
  height?: number;
};

type ChartPoint = {
  date: string;
  current: number;
  with_swaps: number;
  current_low: number;
  current_band: number;
  swaps_low: number;
  swaps_band: number;
};

const formatCurrency = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const buildMap = (points: WalletTrajectoryPoint[]) =>
  points.reduce<Record<string, number>>((acc, point) => {
    acc[point.date] = point.balance;
    return acc;
  }, {});

const buildMarkerPoints = (
  expenses: RecurringExpense[],
  map: Record<string, number>
): Array<{ x: string; y: number; name: string }> => {
  return expenses
    .map((expense) => {
      const balance = map[expense.next_due];
      if (balance === undefined) {
        return null;
      }
      return { x: expense.next_due, y: balance, name: expense.name };
    })
    .filter((item): item is { x: string; y: number; name: string } => item !== null);
};

const ranges = [
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
  { label: "180d", value: "180" },
];

const buildConfidence = (point: WalletTrajectoryPoint) => {
  const lower = point.balance * 0.9;
  const upper = point.balance * 1.1;
  return {
    low: lower,
    band: Math.max(0, upper - lower),
  };
};

export function WalletProjectionChart({
  shortProjection,
  longProjection,
  longTermMonths,
  onLongTermMonthsChange,
  height = 320,
}: WalletProjectionChartProps) {
  const [range, setRange] = useState("30");

  const isLong = range !== "30";
  const activeProjection = isLong ? longProjection : shortProjection;

  const data = useMemo<ChartPoint[]>(() => {
    if (!activeProjection) {
      return [];
    }
    const current = activeProjection.trajectories.current;
    const withSwaps = activeProjection.trajectories.with_swaps;
    const withSwapsMap = buildMap(withSwaps);
    const withSwapPoints = withSwaps.reduce<Record<string, WalletTrajectoryPoint>>((acc, point) => {
      acc[point.date] = point;
      return acc;
    }, {});
    return current.map((point) => {
      const swapPoint = withSwapPoints[point.date] ?? point;
      const currentBand = buildConfidence(point);
      const swapBand = buildConfidence(swapPoint);
      return {
        date: point.date,
        current: point.balance,
        with_swaps: withSwapsMap[point.date] ?? point.balance,
        current_low: currentBand.low,
        current_band: currentBand.band,
        swaps_low: swapBand.low,
        swaps_band: swapBand.band,
      };
    });
  }, [activeProjection]);

  const markerPoints = useMemo(() => {
    if (isLong || !shortProjection) {
      return [];
    }
    const withSwapsMap = buildMap(shortProjection.trajectories.with_swaps);
    return buildMarkerPoints(shortProjection.recurring_expenses, withSwapsMap);
  }, [isLong, shortProjection]);

  const decisionPoints = useMemo(() => {
    if (!data.length) {
      return [];
    }
    const ranked = data
      .map((point) => ({
        date: point.date,
        value: point.with_swaps,
        delta: point.with_swaps - point.current,
      }))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 3);
    return ranked;
  }, [data]);

  const decisionLookup = useMemo(() => {
    return decisionPoints.reduce<Record<string, number>>((acc, point) => {
      acc[point.date] = point.delta;
      return acc;
    }, {});
  }, [decisionPoints]);

  const title = isLong
    ? `${longTermMonths * 30}-day wallet projection`
    : "30-day wallet projection";

  const monthlyTotals = longProjection?.monthly_breakdown ?? [];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex gap-2">
            {ranges.map((option) => {
              const active = range === option.value;
              return (
                <Button
                  key={option.value}
                  type="button"
                  className={`h-7 px-3 text-xs ${active ? "" : "bg-slate-900 text-slate-300"}`}
                  onClick={() => {
                    setRange(option.value);
                    if (option.value === "90") {
                      onLongTermMonthsChange(3);
                    }
                    if (option.value === "180") {
                      onLongTermMonthsChange(6);
                    }
                  }}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!activeProjection ? (
          <div className="text-sm text-slate-300">Loading projection...</div>
        ) : (
          <>
            <div style={{ height }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    stroke="#475569"
                  />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    stroke="#475569"
                    tickFormatter={(value) => formatCurrency(Number(value))}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) {
                        return null;
                      }
                      const date = label as string;
                      const delta = decisionLookup[date];
                      return (
                        <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200">
                          <p className="text-slate-300">{formatDate(date)}</p>
                          <div className="mt-2 space-y-1">
                            {payload
                              .filter((entry) => entry.dataKey === "current" || entry.dataKey === "with_swaps")
                              .map((entry) => (
                                <div key={entry.dataKey as string} className="flex items-center justify-between">
                                  <span className="capitalize text-slate-300">
                                    {(entry.dataKey as string).replace("_", " ")}
                                  </span>
                                  <span>{formatCurrency(Number(entry.value))}</span>
                                </div>
                              ))}
                          </div>
                          {delta !== undefined ? (
                            <p className="mt-2 text-[11px] text-emerald-200">
                              If you start meal prep here, save {formatCurrency(Math.max(0, delta))} over 30 days.
                            </p>
                          ) : null}
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="current_low"
                    stackId="currentBand"
                    stroke="none"
                    fill="none"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="current_band"
                    stackId="currentBand"
                    stroke="none"
                    fill="#f87171"
                    fillOpacity={0.12}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="swaps_low"
                    stackId="swapBand"
                    stroke="none"
                    fill="none"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="swaps_band"
                    stackId="swapBand"
                    stroke="none"
                    fill="#22c55e"
                    fillOpacity={0.12}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke="#f87171"
                    strokeDasharray="6 6"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="with_swaps"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  {markerPoints.map((marker) => (
                    <ReferenceDot
                      key={`${marker.name}-${marker.x}`}
                      x={marker.x}
                      y={marker.y}
                      r={4}
                      fill="#facc15"
                      stroke="#facc15"
                    />
                  ))}
                  {decisionPoints.map((marker) => (
                    <ReferenceDot
                      key={`decision-${marker.date}`}
                      x={marker.date}
                      y={marker.value}
                      r={4}
                      fill="#38bdf8"
                      stroke="#38bdf8"
                      label={{ value: "✦", position: "top", fill: "#38bdf8", fontSize: 10 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {isLong && monthlyTotals.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {monthlyTotals.slice(0, 3).map((month) => (
                  <div
                    key={month.month}
                    className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-200"
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-400">{month.month}</p>
                    <p className="mt-1 text-base font-semibold text-slate-100">
                      {formatCurrency(month.net)}
                    </p>
                    <p className="text-xs text-slate-400">
                      Income {formatCurrency(month.projected_income)} · Spend{" "}
                      {formatCurrency(month.projected_spend)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
