"use client";

import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MealAnalysis } from "@/types/swaps";

type MealAnalysisCardProps = {
  mealData: MealAnalysis;
  imageUrl?: string | null;
  onRequestAlternatives?: () => void;
  actionLabel?: string;
};

const formatNumber = (value?: number | null, suffix?: string) => {
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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function MealAnalysisCard({
  mealData,
  imageUrl,
  onRequestAlternatives,
  actionLabel = "Get alternatives",
}: MealAnalysisCardProps) {
  const ingredients = mealData.ingredients?.filter(Boolean) ?? [];
  const quality = typeof mealData.nutrition_quality === "number" ? mealData.nutrition_quality : null;
  const sustainability =
    typeof mealData.sustainability_score === "number" ? mealData.sustainability_score : null;
  const qualityPercent = quality != null ? clamp((quality / 10) * 100, 0, 100) : 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Meal analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-200">
        <div className="grid gap-4 md:grid-cols-[140px,1fr]">
          <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
            {imageUrl ? (
              <Image src={imageUrl} alt="Meal" fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                No photo
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-lg font-semibold text-slate-100">
                {mealData.meal_name || "Meal"}
              </p>
              <p className="text-xs text-slate-400">
                {ingredients.length > 0 ? ingredients.join(", ") : "Ingredients unavailable"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs">
                {formatNumber(mealData.estimated_calories, " cal")}
              </span>
              <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs">
                Protein {formatNumber(mealData.protein_g, "g")}
              </span>
              <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs">
                Sugar {formatNumber(mealData.sugar_g, "g")}
              </span>
              <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs">
                Fat {formatNumber(mealData.fat_g, "g")}
              </span>
              <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs">
                Cost {formatCurrency(mealData.cost_estimate)}
              </span>
              <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs">
                Sustainability {sustainability != null ? sustainability : "—"}/10
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Nutrition quality</span>
                <span>{quality != null ? `${quality}/10` : "—"}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800">
                <div
                  className="h-2 rounded-full bg-emerald-400"
                  style={{ width: `${qualityPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        {onRequestAlternatives ? (
          <Button type="button" onClick={onRequestAlternatives} className="w-full">
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
