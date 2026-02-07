"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

type MovementPattern = {
  date: string;
  steps: number;
  active_minutes: number;
  sedentary_minutes: number;
  workout_count: number;
  total_movement_score: number;
};

export function MovementHistoryChart() {
  const [data, setData] = useState<MovementPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 14);
        const res = await fetch(
          `${API_BASE}/movement/history?start=${start.toISOString().slice(0, 10)}&end=${end
            .toISOString()
            .slice(0, 10)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) {
          throw new Error("Unable to load movement history.");
        }
        const payload = (await res.json()) as MovementPattern[];
        setData(payload);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load movement history.";
        setError(message);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Movement history</CardTitle>
        <CardDescription>Last two weeks</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-slate-300">Loading chart…</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-slate-300">No movement data.</div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  tickMargin={8}
                  stroke="#475569"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  stroke="#475569"
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  stroke="#475569"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1f2937" }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Legend wrapperStyle={{ color: "#94a3b8" }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="steps"
                  stroke="#34d399"
                  dot={false}
                  name="Steps"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="active_minutes"
                  stroke="#38bdf8"
                  dot={false}
                  name="Active min"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="total_movement_score"
                  stroke="#f59e0b"
                  dot={false}
                  name="Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
