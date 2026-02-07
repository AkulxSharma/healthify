"use client";

import { Pie, PieChart, ResponsiveContainer, Tooltip, Legend, Cell } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BreakdownData } from "@/types/analytics";

type BreakdownPieChartProps = {
  data: BreakdownData[];
  title: string;
  totalLabel?: string;
  totalValue?: string;
  height?: number;
};

const palette = ["#38bdf8", "#f97316", "#22c55e", "#a855f7", "#facc15", "#ec4899"];

const formatPercent = (value: number): string => `${value.toFixed(0)}%`;

export function BreakdownPieChart({
  data,
  title,
  totalLabel,
  totalValue,
  height = 260,
}: BreakdownPieChartProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {totalLabel && totalValue ? (
          <p className="text-xs text-slate-400">
            {totalLabel}: {totalValue}
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-slate-300">No data yet.</div>
        ) : (
          <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  outerRadius="80%"
                  label={({ percentage }) => formatPercent(Number(percentage))}
                  labelLine={false}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={entry.color ?? palette[index % palette.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1f2937" }}
                  labelStyle={{ color: "#e2e8f0" }}
                  formatter={(value: number, name: string, props) => {
                    const percent = (props.payload?.percentage as number | undefined) ?? 0;
                    return [`${value} (${formatPercent(percent)})`, name];
                  }}
                />
                <Legend wrapperStyle={{ color: "#94a3b8" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
