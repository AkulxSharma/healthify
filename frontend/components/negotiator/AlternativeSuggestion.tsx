"use client";

import { Leaf, Sparkles, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { NegotiatorAlternative } from "@/types/negotiator";

type AlternativeSuggestionProps = {
  alternative: NegotiatorAlternative;
  onChoose?: () => void;
};

export function AlternativeSuggestion({ alternative, onChoose }: AlternativeSuggestionProps) {
  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-50">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">💡 Better Option</p>
        <span className="rounded-full border border-emerald-500/40 px-2 py-1 text-xs">
          ${alternative.cost.toFixed(2)} · {alternative.calories} cal
        </span>
      </div>
      <p className="mt-3 text-lg font-semibold text-emerald-100">{alternative.suggestion}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-200">
            <Wallet className="h-3 w-3" /> Cost saved
          </p>
          <p className="mt-1 text-base font-semibold">${alternative.cost_saved.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-200">
            <Sparkles className="h-3 w-3" /> Health
          </p>
          <p className="mt-1 text-base font-semibold">
            {alternative.health_improvement >= 0 ? "+" : ""}
            {alternative.health_improvement} improvement
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-200">
            <Leaf className="h-3 w-3" /> Sustainability
          </p>
          <p className="mt-1 text-base font-semibold">
            {alternative.sustainability_improvement >= 0 ? "+" : ""}
            {alternative.sustainability_improvement} improvement
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-emerald-200">{alternative.reasoning}</p>
      <Button type="button" className="mt-4 h-9 px-4 text-xs" onClick={onChoose}>
        Choose this
      </Button>
    </div>
  );
}
