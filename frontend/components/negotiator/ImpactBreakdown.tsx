"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Leaf, Package, Sparkles, Star, TrendingDown, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CostImpact, HealthImpact, SustainabilityImpact } from "@/types/negotiator";

type ImpactBreakdownProps = {
  costImpact: CostImpact;
  healthImpact: HealthImpact;
  sustainabilityImpact: SustainabilityImpact;
  expandAll: boolean;
  onToggleExpand: () => void;
};

type Severity = "low" | "medium" | "high";

const severityStyles: Record<Severity, string> = {
  high: "border-rose-500/40 bg-rose-500/10 text-rose-100",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  low: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
};

const severityBar: Record<Severity, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-400",
  low: "bg-emerald-500",
};

const severityIndicator: Record<Severity, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🟢",
};

const clampPct = (value: number) => Math.max(0, Math.min(100, value));

export function ImpactBreakdown({
  costImpact,
  healthImpact,
  sustainabilityImpact,
  expandAll,
  onToggleExpand,
}: ImpactBreakdownProps) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState({
    cost: true,
    health: false,
    sustainability: false,
  });

  useEffect(() => {
    setVisible(true);
  }, []);

  useEffect(() => {
    if (expandAll) {
      setExpanded({ cost: true, health: true, sustainability: true });
    }
  }, [expandAll]);

  const costSeverity: Severity = costImpact.budget_pct >= 20 ? "high" : costImpact.budget_pct >= 10 ? "medium" : "low";
  const healthSeverity: Severity =
    healthImpact.wellness_change <= -10 ? "high" : healthImpact.wellness_change <= -3 ? "medium" : "low";
  const sustainabilitySeverity: Severity =
    sustainabilityImpact.score_change <= -10 ? "high" : sustainabilityImpact.score_change <= -3 ? "medium" : "low";
  const costPct = clampPct(costImpact.budget_pct);
  const nutritionStars = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => (
        <Star
          key={`star-${index}`}
          className={`h-3 w-3 ${index < healthImpact.nutrition_quality ? "text-amber-300" : "text-slate-600"}`}
        />
      )),
    [healthImpact.nutrition_quality]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-semibold text-slate-100">Impact breakdown</p>
          <p className="text-xs text-slate-400">Clear view of cost, health, sustainability</p>
        </div>
        <Button type="button" className="h-8 px-3 text-xs" onClick={onToggleExpand}>
          {expandAll ? "Hide details" : "Show details"}
        </Button>
      </div>

      <div
        className={`rounded-2xl border px-4 py-4 transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        } ${severityStyles[costSeverity]}`}
        style={{ transitionDelay: "0ms" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <p className="text-sm font-semibold">💰 Cost Impact</p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((prev) => ({ ...prev, cost: !prev.cost }))}
            className="text-xs underline"
          >
            {expanded.cost ? "Collapse" : "Expand"}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <p className="text-xl font-semibold">${costImpact.immediate.toFixed(2)}</p>
          <span className="text-xs">{severityIndicator[costSeverity]} {costSeverity}</span>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-200">
            <span>Budget impact</span>
            <span>{costImpact.budget_pct}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-800">
            <div className={`h-2 rounded-full ${severityBar[costSeverity]}`} style={{ width: `${costPct}%` }} />
          </div>
        </div>
        {expanded.cost ? (
          <div className="mt-3 space-y-2 text-xs text-slate-200">
            <p className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3" /> Opportunity: {costImpact.opportunity_cost}
            </p>
          </div>
        ) : null}
      </div>

      <div
        className={`rounded-2xl border px-4 py-4 transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        } ${severityStyles[healthSeverity]}`}
        style={{ transitionDelay: "200ms" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <p className="text-sm font-semibold">🏥 Health Impact</p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((prev) => ({ ...prev, health: !prev.health }))}
            className="text-xs underline"
          >
            {expanded.health ? "Collapse" : "Expand"}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <p className="text-xl font-semibold">{healthImpact.calories} cal</p>
          <span className="text-xs">{severityIndicator[healthSeverity]} {healthSeverity}</span>
        </div>
        {expanded.health ? (
          <div className="mt-3 space-y-2 text-xs text-slate-200">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3 w-3" />
              <div className="flex items-center gap-1">{nutritionStars}</div>
            </div>
            <p className="flex items-center gap-2">
              <TrendingDown className="h-3 w-3" />
              Wellness {healthImpact.wellness_change >= 0 ? "+" : ""}{healthImpact.wellness_change}
            </p>
          </div>
        ) : null}
      </div>

      <div
        className={`rounded-2xl border px-4 py-4 transition-all duration-500 ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        } ${severityStyles[sustainabilitySeverity]}`}
        style={{ transitionDelay: "400ms" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="h-4 w-4" />
            <p className="text-sm font-semibold">🌱 Sustainability Impact</p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((prev) => ({ ...prev, sustainability: !prev.sustainability }))}
            className="text-xs underline"
          >
            {expanded.sustainability ? "Collapse" : "Expand"}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <p className="text-xl font-semibold">{sustainabilityImpact.co2e_kg} kg CO₂e</p>
          <span className="text-xs">{severityIndicator[sustainabilitySeverity]} {sustainabilitySeverity}</span>
        </div>
        {expanded.sustainability ? (
          <div className="mt-3 space-y-2 text-xs text-slate-200">
            <p className="flex items-center gap-2">
              <Package className="h-3 w-3" /> Packaging waste: {sustainabilityImpact.packaging_waste}
            </p>
            <p className="flex items-center gap-2">
              <TrendingDown className="h-3 w-3" /> Score {sustainabilityImpact.score_change}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
