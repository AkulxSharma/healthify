"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { WalletProjectionChart } from "@/components/digital-twin/WalletProjectionChart";
import { WalletSummaryCard } from "@/components/digital-twin/WalletSummaryCard";
import { SustainabilityProjectionChart } from "@/components/digital-twin/SustainabilityProjectionChart";
import { WellnessProjectionChart } from "@/components/digital-twin/WellnessProjectionChart";
import { ScenarioComparison } from "@/components/digital-twin/ScenarioComparison";
import { BreakdownPieChart } from "@/components/charts/BreakdownPieChart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import {
  getSustainabilityProjection,
  getWalletProjection,
  getWalletProjectionLong,
  getWellnessProjection,
} from "@/lib/digitalTwin";
import type {
  SustainabilityProjection,
  WalletLongTermProjection,
  WalletProjection,
  WellnessProjection,
} from "@/types/digitalTwin";

const formatCurrency = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function DigitalTwinPage() {
  const router = useRouter();
  const { user, loading } = useSupabaseSession();
  const [projection, setProjection] = useState<WalletProjection | null>(null);
  const [longProjection, setLongProjection] = useState<WalletLongTermProjection | null>(null);
  const [wellnessProjection, setWellnessProjection] = useState<WellnessProjection | null>(null);
  const [sustainabilityProjection, setSustainabilityProjection] =
    useState<SustainabilityProjection | null>(null);
  const [projectionError, setProjectionError] = useState<string | null>(null);
  const [longProjectionError, setLongProjectionError] = useState<string | null>(null);
  const [wellnessError, setWellnessError] = useState<string | null>(null);
  const [sustainabilityError, setSustainabilityError] = useState<string | null>(null);
  const [projectionLoading, setProjectionLoading] = useState(true);
  const [longProjectionLoading, setLongProjectionLoading] = useState(true);
  const [wellnessLoading, setWellnessLoading] = useState(true);
  const [sustainabilityLoading, setSustainabilityLoading] = useState(true);
  const [longTermMonths, setLongTermMonths] = useState(3);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  useEffect(() => {
    setProjectionLoading(true);
    getWalletProjection(30)
      .then((payload) => {
        setProjection(payload);
        setProjectionError(null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load wallet projection.";
        setProjectionError(message);
        setProjection(null);
      })
      .finally(() => setProjectionLoading(false));
  }, []);

  useEffect(() => {
    setLongProjectionLoading(true);
    getWalletProjectionLong(longTermMonths)
      .then((payload) => {
        setLongProjection(payload);
        setLongProjectionError(null);
      })
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : "Unable to load long-term wallet projection.";
        setLongProjectionError(message);
        setLongProjection(null);
      })
      .finally(() => setLongProjectionLoading(false));
  }, [longTermMonths]);

  useEffect(() => {
    setWellnessLoading(true);
    getWellnessProjection(60)
      .then((payload) => {
        setWellnessProjection(payload);
        setWellnessError(null);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load wellness projection.";
        setWellnessError(message);
        setWellnessProjection(null);
      })
      .finally(() => setWellnessLoading(false));
  }, []);

  useEffect(() => {
    setSustainabilityLoading(true);
    getSustainabilityProjection(30)
      .then((payload) => {
        setSustainabilityProjection(payload);
        setSustainabilityError(null);
      })
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : "Unable to load sustainability projection.";
        setSustainabilityError(message);
        setSustainabilityProjection(null);
      })
      .finally(() => setSustainabilityLoading(false));
  }, []);

  const recurringExpenses = useMemo(() => projection?.recurring_expenses ?? [], [projection]);
  const monthlyBreakdown = useMemo(
    () => longProjection?.monthly_breakdown ?? [],
    [longProjection]
  );
  const sustainabilityPie = useMemo(() => {
    if (!sustainabilityProjection) {
      return [];
    }
    return sustainabilityProjection.top_impact_areas.map((area) => ({
      name: area.name,
      value: area.impact,
      percentage: area.impact,
      color: area.name === "Food" ? "#c084fc" : area.name === "Transport" ? "#f59e0b" : "#38bdf8",
    }));
  }, [sustainabilityProjection]);

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
            <CardTitle>Digital twin</CardTitle>
            <CardDescription>Explore projections across wallet, wellness, and sustainability.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="wallet">
              <TabsList>
                <TabsTrigger value="wallet">Wallet</TabsTrigger>
                <TabsTrigger value="wellness">Wellness</TabsTrigger>
                <TabsTrigger value="sustainability">Sustainability</TabsTrigger>
              </TabsList>
              <TabsContent value="wallet" className="mt-6 space-y-6" id="wallet">
                {projectionLoading ? (
                  <div className="text-sm text-slate-300">Loading wallet projection...</div>
                ) : projectionError ? (
                  <div className="text-sm text-rose-200">{projectionError}</div>
                ) : projection ? (
                  <>
                    <WalletSummaryCard projection={projection} />
                    <WalletProjectionChart
                      shortProjection={projection}
                      longProjection={longProjectionLoading ? null : longProjection}
                      longTermMonths={longTermMonths}
                      onLongTermMonthsChange={setLongTermMonths}
                    />
                    {longProjectionLoading ? (
                      <div className="text-sm text-slate-300">Loading long-term totals...</div>
                    ) : longProjectionError ? (
                      <div className="text-sm text-rose-200">{longProjectionError}</div>
                    ) : monthlyBreakdown.length > 0 ? (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Monthly breakdown</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3 text-sm">
                            {monthlyBreakdown.map((item) => (
                              <div
                                key={item.month}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3"
                              >
                                <div>
                                  <p className="font-semibold text-slate-100">{item.month}</p>
                                  <p className="text-xs text-slate-400">
                                    Income {formatCurrency(item.projected_income)} · Spend{" "}
                                    {formatCurrency(item.projected_spend)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-slate-100">{formatCurrency(item.net)}</p>
                                  <p className="text-xs text-slate-400">
                                    Balance {formatCurrency(item.cumulative_balance)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Recurring expenses</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {recurringExpenses.length === 0 ? (
                            <div className="text-sm text-slate-300">No recurring expenses logged.</div>
                          ) : (
                            <div className="space-y-3 text-sm">
                              {recurringExpenses.map((expense) => (
                                <div
                                  key={`${expense.name}-${expense.next_due}`}
                                  className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3"
                                >
                                  <div>
                                    <p className="font-semibold text-slate-100">{expense.name}</p>
                                    <p className="text-xs text-slate-400">
                                      Next due {new Date(expense.next_due).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-slate-100">{formatCurrency(expense.amount)}</p>
                                    <p className="text-xs text-slate-400">
                                      Every {expense.cadence_days} days
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Wallet outlook</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-slate-300">
                          <p>
                            Current balance starts at {formatCurrency(projection.current_balance)}.
                          </p>
                          <p>
                            Savings potential over 30 days:{" "}
                            <span className="text-emerald-200">
                              {formatCurrency(projection.savings_potential)}
                            </span>
                          </p>
                          <p>
                            Add more swap events to strengthen the green trajectory line.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                    <ScenarioComparison defaultMetric="wallet" />
                  </>
                ) : (
                  <div className="text-sm text-slate-300">No wallet data yet.</div>
                )}
              </TabsContent>
              <TabsContent value="wellness" className="mt-6 space-y-6" id="wellness">
                {wellnessLoading ? (
                  <div className="text-sm text-slate-300">Loading wellness projection...</div>
                ) : wellnessError ? (
                  <div className="text-sm text-rose-200">{wellnessError}</div>
                ) : wellnessProjection ? (
                  <>
                    <WellnessProjectionChart projection={wellnessProjection} />
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Current vs improved</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-slate-300">
                          <p>
                            Current score:{" "}
                            <span className="text-slate-100">
                              {wellnessProjection.current_score.toFixed(1)}
                            </span>
                          </p>
                          <p>
                            Improved score:{" "}
                            <span className="text-emerald-200">
                              {wellnessProjection.trajectories.improved[
                                wellnessProjection.trajectories.improved.length - 1
                              ]?.score.toFixed(1)}
                            </span>
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Factor breakdown</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-slate-300">
                          {wellnessProjection.factors_impacting.length === 0 ? (
                            <p>No dominant factors detected.</p>
                          ) : (
                            wellnessProjection.factors_impacting.map((factor) => (
                              <div
                                key={factor.name}
                                className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3"
                              >
                                <div>
                                  <p className="font-semibold text-slate-100">{factor.name}</p>
                                  <p className="text-xs text-slate-400">{factor.detail}</p>
                                </div>
                                <span className="text-emerald-200">+{factor.impact}</span>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    </div>
                    <ScenarioComparison defaultMetric="wellness" />
                  </>
                ) : (
                  <div className="text-sm text-slate-300">No wellness data yet.</div>
                )}
              </TabsContent>
              <TabsContent value="sustainability" className="mt-6 space-y-6" id="sustainability">
                {sustainabilityLoading ? (
                  <div className="text-sm text-slate-300">Loading sustainability projection...</div>
                ) : sustainabilityError ? (
                  <div className="text-sm text-rose-200">{sustainabilityError}</div>
                ) : sustainabilityProjection ? (
                  <>
                    <SustainabilityProjectionChart projection={sustainabilityProjection} />
                    <div className="grid gap-4 md:grid-cols-2">
                      <BreakdownPieChart
                        data={sustainabilityPie}
                        title="Impact by category"
                        totalLabel="Projected footprint"
                        totalValue={sustainabilityProjection.projected_footprint.toFixed(1)}
                      />
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Swap suggestions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-slate-300">
                          {sustainabilityProjection.top_impact_areas.length === 0 ? (
                            <p>No dominant impact areas yet.</p>
                          ) : (
                            sustainabilityProjection.top_impact_areas.map((area) => (
                              <div
                                key={area.name}
                                className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3"
                              >
                                <div>
                                  <p className="font-semibold text-slate-100">{area.name}</p>
                                  <p className="text-xs text-slate-400">{area.detail}</p>
                                </div>
                                <span className="text-emerald-200">{area.impact.toFixed(0)}%</span>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    </div>
                    <ScenarioComparison defaultMetric="sustainability" />
                  </>
                ) : (
                  <div className="text-sm text-slate-300">No sustainability data yet.</div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
