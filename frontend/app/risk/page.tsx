"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { RiskDashboard } from "@/components/risk/RiskDashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { getRiskHistory } from "@/lib/risk";
import type { RiskHistoryPoint } from "@/types/risk";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const chartConfig = [
  { key: "burnout_risk", label: "Burnout", color: "#f97316" },
  { key: "injury_risk", label: "Injury", color: "#38bdf8" },
  { key: "isolation_risk", label: "Isolation", color: "#a855f7" },
  { key: "financial_risk", label: "Financial", color: "#22c55e" },
] as const;

export default function RiskPage() {
  const router = useRouter();
  const { user, loading } = useSupabaseSession();
  const [history, setHistory] = useState<RiskHistoryPoint[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  useEffect(() => {
    setHistoryLoading(true);
    getRiskHistory(30)
      .then((rows) => {
        setHistory(rows);
        setHistoryError(null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load risk history.";
        setHistoryError(message);
      })
      .finally(() => setHistoryLoading(false));
  }, []);

  const exportPayload = useMemo(() => {
    return {
      generated_at: new Date().toISOString(),
      history,
    };
  }, [history]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "risk-report.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-100">Risk Assessment</h1>
            <p className="text-sm text-slate-400">Monitor burnout, injury, isolation, and financial risks.</p>
          </div>
          <Button type="button" onClick={handleExport} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export report
          </Button>
        </div>

        <RiskDashboard />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Risk trends (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {historyLoading ? (
              <div className="text-sm text-slate-300">Loading risk history...</div>
            ) : historyError ? (
              <div className="text-sm text-rose-200">{historyError}</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-slate-300">No risk history yet.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {chartConfig.map((config) => (
                  <div key={config.key} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                    <p className="text-sm font-semibold text-slate-100">{config.label}</p>
                    <div className="mt-3 h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={history}>
                          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={formatDate}
                            tick={{ fill: "#94a3b8", fontSize: 12 }}
                            stroke="#475569"
                          />
                          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} stroke="#475569" domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1f2937" }}
                            labelStyle={{ color: "#e2e8f0" }}
                            labelFormatter={formatDate}
                          />
                          <Line
                            type="monotone"
                            dataKey={config.key}
                            stroke={config.color}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
