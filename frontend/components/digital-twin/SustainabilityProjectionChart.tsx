"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SustainabilityProjection } from "@/types/digitalTwin";

type SustainabilityProjectionChartProps = {
  projection: SustainabilityProjection;
  height?: number;
};

type ChartPoint = {
  date: string;
  current_co2e: number;
  current_water: number;
  current_waste: number;
  green_co2e: number;
  green_water: number;
  green_waste: number;
  current_total_low: number;
  current_total_band: number;
  green_total_low: number;
  green_total_band: number;
  current_total: number;
  green_total: number;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function SustainabilityProjectionChart({
  projection,
  height = 320,
}: SustainabilityProjectionChartProps) {
  const data: ChartPoint[] = projection.trajectories.current.map((point, index) => {
    const improved = projection.trajectories.green_swaps[index] ?? point;
    const currentTotal = point.co2e + point.water + point.waste;
    const greenTotal = improved.co2e + improved.water + improved.waste;
    const currentLow = currentTotal * 0.9;
    const greenLow = greenTotal * 0.9;
    return {
      date: point.date,
      current_co2e: point.co2e,
      current_water: point.water,
      current_waste: point.waste,
      green_co2e: improved.co2e,
      green_water: improved.water,
      green_waste: improved.waste,
      current_total_low: currentLow,
      current_total_band: Math.max(0, currentTotal * 1.1 - currentLow),
      green_total_low: greenLow,
      green_total_band: Math.max(0, greenTotal * 1.1 - greenLow),
      current_total: currentTotal,
      green_total: greenTotal,
    };
  });

  const decisionPoints = data
    .map((point) => ({
      date: point.date,
      value: point.green_total,
      delta: point.current_total - point.green_total,
    }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 2);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Sustainability projection</CardTitle>
          <span className="text-xs text-emerald-300">
            Impact reduction {projection.improvement_potential.toFixed(0)}%
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                stroke="#475569"
              />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} stroke="#475569" />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1f2937" }}
                labelStyle={{ color: "#e2e8f0" }}
                labelFormatter={formatDate}
              />
              <Area
                type="monotone"
                dataKey="current_total_low"
                stackId="currentBand"
                stroke="none"
                fill="none"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="current_total_band"
                stackId="currentBand"
                stroke="none"
                fill="#94a3b8"
                fillOpacity={0.12}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="green_total_low"
                stackId="greenBand"
                stroke="none"
                fill="none"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="green_total_band"
                stackId="greenBand"
                stroke="none"
                fill="#22c55e"
                fillOpacity={0.12}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="current_co2e"
                stackId="current"
                stroke="#8b5e3c"
                fill="#8b5e3c"
                fillOpacity={0.35}
              />
              <Area
                type="monotone"
                dataKey="current_water"
                stackId="current"
                stroke="#6b7280"
                fill="#6b7280"
                fillOpacity={0.3}
              />
              <Area
                type="monotone"
                dataKey="current_waste"
                stackId="current"
                stroke="#4b5563"
                fill="#4b5563"
                fillOpacity={0.25}
              />
              <Area
                type="monotone"
                dataKey="green_co2e"
                stackId="green"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.35}
              />
              <Area
                type="monotone"
                dataKey="green_water"
                stackId="green"
                stroke="#16a34a"
                fill="#16a34a"
                fillOpacity={0.3}
              />
              <Area
                type="monotone"
                dataKey="green_waste"
                stackId="green"
                stroke="#15803d"
                fill="#15803d"
                fillOpacity={0.25}
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
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
