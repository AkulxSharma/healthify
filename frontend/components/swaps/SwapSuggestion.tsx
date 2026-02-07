"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MealAnalysis, SwapAlternative, SwapPreference } from "@/types/swaps";

type SwapSuggestionProps = {
  original: MealAnalysis;
  alternatives: Record<SwapPreference, SwapAlternative>;
  bestBalanced: SwapPreference;
  selected: SwapPreference;
  onSelect: (value: SwapPreference) => void;
  onAcceptSelected: () => void;
  onRejectAll: () => void;
  accepting?: boolean;
};

const formatValue = (value?: number | null, suffix?: string) => {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `${value}${suffix ?? ""}`;
};

const formatCurrency = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `$${value.toFixed(2)}`;
};

const formatCo2 = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `${value} kg CO₂`;
};

const titleMap: Record<SwapPreference, string> = {
  healthier: "Healthier",
  cheaper: "Cheaper",
  eco: "Eco-friendly",
};

export function SwapSuggestion({
  original,
  alternatives,
  bestBalanced,
  selected,
  onSelect,
  onAcceptSelected,
  onRejectAll,
  accepting,
}: SwapSuggestionProps) {
  const originalMetrics = [
    `Calories ${formatValue(original.estimated_calories, " cal")}`,
    `Sugar ${formatValue(original.sugar_g, "g")}`,
    `Protein ${formatValue(original.protein_g, "g")}`,
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Your alternatives</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-200">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Original meal</p>
          <p className="mt-2 text-base font-semibold text-slate-100">
            {original.meal_name || "Original meal"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
            {originalMetrics.map((metric) => (
              <span
                key={metric}
                className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1"
              >
                {metric}
              </span>
            ))}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {(Object.keys(alternatives) as SwapPreference[]).map((key) => {
            const alternative = alternatives[key];
            const isBest = bestBalanced === key;
            const metrics = [
              `Calories ${formatValue(alternative.calories, " cal")}`,
              `Quality ${formatValue(alternative.nutrition_quality, "/10")}`,
              `Cost ${formatCurrency(alternative.cost_estimate)}`,
              `CO₂ ${formatCo2(alternative.co2_saved)}`,
            ].filter((metric) => !metric.endsWith("—"));
            return (
              <label
                key={key}
                className={`cursor-pointer rounded-2xl border px-4 py-3 ${
                  selected === key
                    ? "border-emerald-400/60 bg-emerald-500/10"
                    : "border-slate-800 bg-slate-950/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="swap-choice"
                      value={key}
                      checked={selected === key}
                      onChange={() => onSelect(key)}
                      className="h-4 w-4 rounded-full border border-slate-700"
                    />
                    <span className="text-sm font-semibold text-slate-100">
                      {titleMap[key]}
                    </span>
                  </div>
                  {isBest ? (
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-100">
                      Best balanced
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-base font-semibold text-slate-100">
                  {alternative.alternative}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                  {metrics.map((metric) => (
                    <span
                      key={metric}
                      className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1"
                    >
                      {metric}
                    </span>
                  ))}
                </div>
                {alternative.availability ? (
                  <p className="mt-2 text-xs text-slate-400">{alternative.availability}</p>
                ) : null}
                {alternative.reasoning ? (
                  <p className="mt-2 text-xs text-slate-400">{alternative.reasoning}</p>
                ) : null}
              </label>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onAcceptSelected} disabled={accepting}>
            {accepting ? "Saving..." : "Accept selected swap"}
          </Button>
          <Button
            type="button"
            onClick={onRejectAll}
            className="bg-transparent text-slate-300 hover:bg-slate-900"
          >
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
