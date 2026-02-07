"use client";

import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WellnessProjection } from "@/types/digitalTwin";

type WellnessProjectionChartProps = {
  projection: WellnessProjection;
  height?: number;
};

type ChartPoint = {
  date: string;
  current: number;
  improved: number;
  current_low: number;
  current_band: number;
  improved_low: number;
  improved_band: number;
  sleep: number;
  diet: number;
  movement: number;
  stress: number;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function WellnessProjectionChart({ projection, height = 320 }: WellnessProjectionChartProps) {
  const data: ChartPoint[] = projection.trajectories.current.map((point, index) => {
    const improved = projection.trajectories.improved[index] ?? point;
    const currentLow = point.score * 0.9;
    const currentHigh = point.score * 1.1;
    const improvedLow = improved.score * 0.9;
    const improvedHigh = improved.score * 1.1;
    return {
      date: point.date,
      current: point.score,
      improved: improved.score,
      current_low: currentLow,
      current_band: Math.max(0, currentHigh - currentLow),
      improved_low: improvedLow,
      improved_band: Math.max(0, improvedHigh - improvedLow),
      sleep: point.sleep,
      diet: point.diet,
      movement: point.movement,
      stress: point.stress,
    };
  });

  const decisionPoints = data
    .map((point) => ({
      date: point.date,
      value: point.improved,
      delta: point.improved - point.current,
    }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 2);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Wellness score projection</CardTitle>
      </CardHeader>
      <CardContent>
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
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} stroke="#475569" domain={[0, 100]} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) {
                    return null;
                  }
                  const datum = payload[0]?.payload as ChartPoint;
                  return (
                    <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200">
                      <p className="text-slate-300">{formatDate(label as string)}</p>
                      <p className="mt-1 text-sm text-orange-200">
                        Current {datum.current.toFixed(1)}
                      </p>
                      <p className="text-sm text-emerald-200">
                        Improved {datum.improved.toFixed(1)}
                      </p>
                      <p className="mt-2 text-[11px] text-slate-400">
                        Sleep {datum.sleep.toFixed(0)} · Diet {datum.diet.toFixed(0)} · Movement{" "}
                        {datum.movement.toFixed(0)}
                      </p>
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
                fill="#f97316"
                fillOpacity={0.12}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="improved_low"
                stackId="improvedBand"
                stroke="none"
                fill="none"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="improved_band"
                stackId="improvedBand"
                stroke="none"
                fill="#22c55e"
                fillOpacity={0.12}
                isAnimationActive={false}
              />
              {[50, 75, 90].map((threshold) => (
                <ReferenceLine
                  key={threshold}
                  y={threshold}
                  stroke="#334155"
                  strokeDasharray="4 4"
                />
              ))}
              <Line
                type="monotone"
                dataKey="current"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="improved"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {decisionPoints.map((point) => (
                <ReferenceDot
                  key={point.date}
                  x={point.date}
                  y={point.value}
                  r={4}
                  fill="#38bdf8"
                  stroke="#38bdf8"
                  label={{ value: "✦", position: "top", fill: "#38bdf8", fontSize: 10 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
