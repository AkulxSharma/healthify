"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInsightNotifications } from "@/lib/insights";
import type { InsightNotification } from "@/types/insights";

const severityStyles: Record<InsightNotification["severity"], string> = {
  high: "border-rose-500/40 bg-rose-500/10 text-rose-100",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  low: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
};

const severityIcon = (severity: InsightNotification["severity"]) => {
  switch (severity) {
    case "high":
      return AlertTriangle;
    case "medium":
      return Info;
    case "low":
    default:
      return CheckCircle;
  }
};

type InsightNotificationsProps = {
  limit?: number;
};

export function InsightNotifications({ limit = 3 }: InsightNotificationsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<InsightNotification[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getInsightNotifications()
      .then((data) => {
        if (!active) {
          return;
        }
        setRows(data.slice(0, limit));
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load notifications.");
        setRows([]);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [limit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <p className="text-sm text-slate-300">Loading…</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {!loading &&
          !error &&
          rows
            .filter((row) => !dismissed[row.title])
            .map((row) => {
              const Icon = severityIcon(row.severity);
              return (
                <div
                  key={`${row.type}-${row.title}`}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${severityStyles[row.severity]}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <div>
                      <p className="text-sm font-semibold">{row.title}</p>
                      <p className="text-xs">{row.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => (window.location.href = row.link)}
                      className="h-8 px-3 text-xs"
                    >
                      {row.action}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setDismissed((prev) => ({ ...prev, [row.title]: true }))}
                      className="text-xs underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })}
        {!loading && !error && rows.length === 0 ? (
          <p className="text-sm text-slate-300">No notifications yet.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
