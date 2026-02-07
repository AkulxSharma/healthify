"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getSustainabilityProjection,
  getWalletProjectionLong,
  getWellnessProjection,
} from "@/lib/digitalTwin";
import type {
  SustainabilityProjection,
  WalletLongTermProjection,
  WellnessProjection,
} from "@/types/digitalTwin";

const formatCurrency = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function ProjectionSummaryCards() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletLongTermProjection | null>(null);
  const [wellness, setWellness] = useState<WellnessProjection | null>(null);
  const [sustainability, setSustainability] = useState<SustainabilityProjection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getWalletProjectionLong(3),
      getWellnessProjection(30),
      getSustainabilityProjection(30),
    ])
      .then(([walletData, wellnessData, sustainabilityData]) => {
        setWallet(walletData);
        setWellness(wellnessData);
        setSustainability(sustainabilityData);
        setError(null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load projections.";
        setError(message);
      });
  }, []);

  const walletSummary = useMemo(() => {
    if (!wallet) {
      return null;
    }
    const currentEnd = wallet.trajectories.current[wallet.trajectories.current.length - 1]?.balance ?? 0;
    const swapEnd = wallet.trajectories.with_swaps[wallet.trajectories.with_swaps.length - 1]?.balance ?? 0;
    const savings = swapEnd - currentEnd;
    return { currentEnd, savings };
  }, [wallet]);

  const wellnessSummary = useMemo(() => {
    if (!wellness) {
      return null;
    }
    const endScore = wellness.trajectories.improved[wellness.trajectories.improved.length - 1]?.score ?? 0;
    const delta = endScore - wellness.current_score;
    return { endScore, delta };
  }, [wellness]);

  const sustainabilitySummary = useMemo(() => {
    if (!sustainability) {
      return null;
    }
    return sustainability.improvement_potential;
  }, [sustainability]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {error ? <div className="text-sm text-rose-200">{error}</div> : null}
      <Card className="cursor-pointer" onClick={() => router.push("/digital-twin")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Wallet outlook</CardTitle>
        </CardHeader>
        <CardContent>
          {walletSummary ? (
            <div className="space-y-1 text-sm text-slate-300">
              <p>In 3 months: {formatCurrency(walletSummary.currentEnd)}</p>
              <p className="text-emerald-200">
                Save {formatCurrency(walletSummary.savings)} with swaps
              </p>
            </div>
          ) : (
            <div className="text-sm text-slate-300">Loading projection...</div>
          )}
        </CardContent>
      </Card>
      <Card className="cursor-pointer" onClick={() => router.push("/digital-twin#wellness")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Wellness lift</CardTitle>
        </CardHeader>
        <CardContent>
          {wellnessSummary ? (
            <div className="space-y-1 text-sm text-slate-300">
              <p>In 30 days: score {wellnessSummary.endScore.toFixed(0)}</p>
              <p className="text-emerald-200">
                +{wellnessSummary.delta.toFixed(0)} from today
              </p>
            </div>
          ) : (
            <div className="text-sm text-slate-300">Loading projection...</div>
          )}
        </CardContent>
      </Card>
      <Card className="cursor-pointer" onClick={() => router.push("/digital-twin#sustainability")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sustainability shift</CardTitle>
        </CardHeader>
        <CardContent>
          {sustainabilitySummary !== null ? (
            <div className="space-y-1 text-sm text-slate-300">
              <p>In 30 days: reduce footprint</p>
              <p className="text-emerald-200">{sustainabilitySummary.toFixed(0)}%</p>
            </div>
          ) : (
            <div className="text-sm text-slate-300">Loading projection...</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
