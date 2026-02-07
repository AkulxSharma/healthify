"use client";

import { useState } from "react";
import { DollarSign, HeartPulse, Info, Leaf } from "lucide-react";

type ScoreBreakdownProps = {
  scores: {
    wellness_impact?: number;
    cost_impact?: number;
    sustainability_impact?: number;
  };
  explanations?: {
    wellness?: string;
    cost?: string;
    sustainability?: string;
  };
};

const labelOrder = [
  { key: "wellness", label: "Wellness", icon: HeartPulse, color: "text-emerald-200" },
  { key: "cost", label: "Cost", icon: DollarSign, color: "text-amber-200" },
  { key: "sustainability", label: "Sustainability", icon: Leaf, color: "text-sky-200" },
] as const;

export function ScoreBreakdown({ scores, explanations }: ScoreBreakdownProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {labelOrder.map((item) => {
        const Icon = item.icon;
        const value =
          item.key === "wellness"
            ? scores.wellness_impact ?? 0
            : item.key === "cost"
            ? scores.cost_impact ?? 0
            : scores.sustainability_impact ?? 0;
        const explanation =
          item.key === "wellness"
            ? explanations?.wellness
            : item.key === "cost"
            ? explanations?.cost
            : explanations?.sustainability;
        const isOpen = openKey === item.key;
        const formatted =
          item.key === "cost"
            ? `${value > 0 ? "+" : ""}$${Math.abs(Number(value)).toFixed(2)}`
            : `${value > 0 ? "+" : ""}${Math.round(Number(value))}`;
        return (
          <div key={item.key} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <button
              type="button"
              onClick={() => setOpenKey(isOpen ? null : item.key)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className={`flex items-center gap-2 text-sm ${item.color}`}>
                <Icon className="h-4 w-4" />
                <span>{item.label}: {formatted}</span>
              </div>
              <span className="text-xs text-slate-400">{isOpen ? "Hide" : "Explain"}</span>
            </button>
            {isOpen && explanation ? (
              <div className="mt-2 flex items-start gap-2 text-xs text-slate-300">
                <Info className="mt-0.5 h-3 w-3" />
                <span>{explanation}</span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
