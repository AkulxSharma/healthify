"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { SwapFlow } from "@/components/swaps/SwapFlow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { getSwapFeedbackSummary, getSwapHistory } from "@/lib/swaps";
import type { SwapFeedbackSummary, SwapHistoryItem } from "@/types/swaps";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function SwapsPage() {
  const router = useRouter();
  const { user, loading } = useSupabaseSession();
  const [history, setHistory] = useState<SwapHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [feedbackSummary, setFeedbackSummary] = useState<SwapFeedbackSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    setLoadingHistory(true);
    Promise.all([getSwapHistory(60), getSwapFeedbackSummary(60)])
      .then(([rows, summary]) => {
        setHistory(rows);
        setFeedbackSummary(summary);
        setHistoryError(null);
        setSummaryError(null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load swap data.";
        setHistoryError(message);
        setSummaryError(message);
        setHistory([]);
        setFeedbackSummary(null);
      })
      .finally(() => setLoadingHistory(false));
  }, [user, acceptedCount]);

  const savingsTotal = useMemo(() => {
    return history.reduce((sum, item) => {
      const saved = Number(item.alternative_data?.savings ?? 0);
      return sum + (Number.isFinite(saved) ? saved : 0);
    }, 0);
  }, [history]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-200 px-6 py-10">Loading...</div>;
  }

  if (!user) {
    return <div className="min-h-screen bg-slate-950 text-slate-200 px-6 py-10">Redirecting...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Scan → Swap: Make Better Choices</CardTitle>
            <CardDescription>Analyze a meal and choose a better alternative.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <SwapFlow onAccepted={() => setAcceptedCount((n) => n + 1)} />
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-100">Your swap history</p>
                  <p className="text-xs text-slate-400">
                    {history.length} swaps accepted, saved ${savingsTotal.toFixed(2)}
                  </p>
                  {feedbackSummary ? (
                    <div className="mt-2 text-xs text-slate-400">
                      <div>
                        Swap acceptance rate: {Math.round(feedbackSummary.acceptance_rate * 100)}% (
                        {feedbackSummary.accepted_count}/
                        {feedbackSummary.accepted_count + feedbackSummary.rejected_count})
                      </div>
                      <div>
                        Most common rejection: {feedbackSummary.most_common_rejection ?? "—"}
                      </div>
                    </div>
                  ) : summaryError ? (
                    <div className="mt-2 text-xs text-rose-300">{summaryError}</div>
                  ) : null}
                </div>
                <Button type="button" onClick={() => setAcceptedCount((n) => n + 1)}>
                  Refresh
                </Button>
              </div>
              {loadingHistory ? (
                <div className="text-sm text-slate-300">Loading swap history…</div>
              ) : historyError ? (
                <div className="text-sm text-rose-300">{historyError}</div>
              ) : history.length === 0 ? (
                <div className="text-sm text-slate-300">No swaps yet.</div>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 px-3 py-2 text-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs">
                          {item.swap_type}
                        </span>
                        <span className="text-slate-100">
                          {item.alternative_data?.alternative ?? "Swap"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {item.alternative_data?.savings != null ? (
                          <span>Saved ${Number(item.alternative_data.savings).toFixed(2)}</span>
                        ) : null}
                        <span>{formatDate(item.accepted_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
