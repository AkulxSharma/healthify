"use client";

import { useId } from "react";
import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrendData, TrendMetric } from "@/types/analytics";

type TrendLineChartProps = {
  data: TrendData[];
  metric: TrendMetric;
  title: string;
  color: string;
  height?: number;
};

const formatValue = (metric: TrendMetric, value: number): string => {
  if (metric === "spending") {
    return `$${value.toFixed(2)}`;
  }
  if (metric === "movement_minutes") {
    return `${Math.round(value)} min`;
  }
  return `${Math.round(value)}`;
};

export function TrendLineChart({
  data,
  metric,
  title,
  color,
  height = 240,
}: TrendLineChartProps) {
  const gradientId = useId();
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-slate-300">No data yet.</div>
        ) : (
          <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  tickMargin={8}
                  stroke="#475569"
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  stroke="#475569"
                  width={40}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1f2937" }}
                  labelStyle={{ color: "#e2e8f0" }}
                  formatter={(value: number) => formatValue(metric, value)}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="transparent"
                  fill={`url(#${gradientId})`}
                  fillOpacity={1}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
