"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getWalletProjection } from "@/lib/digitalTwin";
import type { WalletProjection } from "@/types/digitalTwin";

type WalletSummaryCardProps = {
  days?: number;
  projection?: WalletProjection;
};

const formatCurrency = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function WalletSummaryCard({ days = 30, projection }: WalletSummaryCardProps) {
  const [data, setData] = useState<WalletProjection | null>(projection ?? null);
  const [loading, setLoading] = useState(!projection);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projection) {
      return;
    }
    setLoading(true);
    getWalletProjection(days)
      .then((payload) => {
        setData(payload);
        setError(null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load wallet projection.";
        setError(message);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [days, projection]);

  const endBalances = useMemo(() => {
    if (!data) {
      return null;
    }
    const currentPath = data.trajectories.current[data.trajectories.current.length - 1]?.balance ?? 0;
    const swapPath = data.trajectories.with_swaps[data.trajectories.with_swaps.length - 1]?.balance ?? 0;
    return { currentPath, swapPath };
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet snapshot</CardTitle>
        <CardDescription>Projected balance over the next {days} days.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-sm text-slate-300">Loading projection...</div>
        ) : error ? (
          <div className="text-sm text-rose-200">{error}</div>
        ) : data && endBalances ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Current balance</p>
                <p className="text-lg font-semibold text-slate-100">
                  {formatCurrency(data.current_balance)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Current path</p>
                <p className="text-lg font-semibold text-slate-100">
                  {formatCurrency(endBalances.currentPath)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-emerald-500/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-emerald-200">With swaps</p>
                <p className="text-lg font-semibold text-emerald-100">
                  {formatCurrency(endBalances.swapPath)}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              Savings potential: {formatCurrency(data.savings_potential)}
            </div>
          </>
        ) : (
          <div className="text-sm text-slate-300">No projection data yet.</div>
        )}
      </CardContent>
    </Card>
  );
}
