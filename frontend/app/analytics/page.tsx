"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

import { BreakdownsPanel } from "@/components/charts/BreakdownsPanel";
import { TrendsPanel } from "@/components/charts/TrendsPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { getScoreHistory } from "@/lib/analytics";
import type { ScoreHistoryPoint } from "@/types/analytics";

const toRange = (days: number): { start: string; end: string } => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const chartSeries = [
  { key: "wallet_score", label: "Wallet", color: "#f59e0b" },
  { key: "wellness_score", label: "Wellness", color: "#22c55e" },
  { key: "sustainability_score", label: "Sustainability", color: "#38bdf8" },
  { key: "movement_score", label: "Movement", color: "#a855f7" },
] as const;

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading } = useSupabaseSession();
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryPoint[]>([]);
  const [scoreLoading, setScoreLoading] = useState(true);
  const [scoreError, setScoreError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setScoreLoading(true);
      setScoreError(null);
      try {
        const { start, end } = toRange(30);
        const payload = await getScoreHistory(start, end);
        if (!active) {
          return;
        }
        setScoreHistory(payload);
      } catch (err) {
        if (!active) {
          return;
        }
        const message = err instanceof Error ? err.message : "Unable to load score history.";
        setScoreError(message);
        setScoreHistory([]);
      } finally {
        if (active) {
          setScoreLoading(false);
        }
      }
    };
    if (user) {
      load();
    }
    return () => {
      active = false;
    };
  }, [user]);

  const hasScoreHistory = useMemo(() => scoreHistory.length > 0, [scoreHistory.length]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-200 px-6 py-10">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 px-6 py-10">Redirecting...</div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Your Life Analytics</CardTitle>
            <CardDescription>Track trends and understand your breakdowns.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-10">
            <TrendsPanel />
            <section className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Score trends</h3>
                <p className="text-sm text-slate-400">Last 30 days of daily scores.</p>
              </div>
              {scoreLoading ? (
                <div className="text-sm text-slate-300">Loading score history...</div>
              ) : scoreError ? (
                <div className="text-sm text-rose-300">{scoreError}</div>
              ) : !hasScoreHistory ? (
                <div className="text-sm text-slate-300">No score history yet.</div>
              ) : (
                <div className="h-72 w-full rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={scoreHistory} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        tickMargin={8}
                        stroke="#475569"
                        tickFormatter={formatDate}
                      />
                      <YAxis
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        stroke="#475569"
                        domain={[0, 100]}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1f2937" }}
                        labelStyle={{ color: "#e2e8f0" }}
                        formatter={(value: number) => value.toFixed(1)}
                        labelFormatter={formatDate}
                      />
                      <Legend wrapperStyle={{ color: "#94a3b8" }} />
                      {chartSeries.map((series) => (
                        <Line
                          key={series.key}
                          type="monotone"
                          dataKey={series.key}
                          stroke={series.color}
                          dot={false}
                          name={series.label}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
            <BreakdownsPanel />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
