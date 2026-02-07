"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BeforeAfterComparison } from "@/types/analytics";

type BeforeAfterChartProps = {
  title: string;
  comparison: BeforeAfterComparison;
  height?: number;
};

type ChartPoint = {
  date: string;
  before?: number;
  after?: number;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function BeforeAfterChart({ title, comparison, height = 220 }: BeforeAfterChartProps) {
  const map = new Map<string, ChartPoint>();
  comparison.before_data.forEach((point) => {
    map.set(point.date, { date: point.date, before: point.value });
  });
  comparison.after_data.forEach((point) => {
    const existing = map.get(point.date) ?? { date: point.date };
    map.set(point.date, { ...existing, after: point.value });
  });
  const data = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Before avg: {comparison.before_avg.toFixed(1)}</span>
          <span>After avg: {comparison.after_avg.toFixed(1)}</span>
          <span className={comparison.change_percent >= 0 ? "text-emerald-300" : "text-rose-300"}>
            {comparison.change_percent >= 0 ? "+" : ""}
            {comparison.change_percent.toFixed(1)}%
          </span>
        </div>
        <div style={{ height }} className="mt-3 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
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
                formatter={(value: number) => value.toFixed(1)}
                labelFormatter={formatDate}
              />
              <ReferenceLine
                x={comparison.intervention_date}
                stroke="#22c55e"
                strokeDasharray="4 4"
              />
              <Area
                type="monotone"
                dataKey="before"
                stroke="#64748b"
                fill="#64748b"
                fillOpacity={0.2}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="after"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.25}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
