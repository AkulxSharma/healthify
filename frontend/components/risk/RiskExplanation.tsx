"use client";

import { useState } from "react";
import { Info } from "lucide-react";

import type { BurnoutFactor, RiskType } from "@/types/risk";

type RiskExplanationProps = {
  riskType: RiskType;
  factors: BurnoutFactor[];
};

const labelMap: Record<RiskType, string> = {
  burnout: "Burnout",
  injury: "Injury",
  isolation: "Isolation",
  financial: "Financial",
};

const whyText = "Higher impact factors contribute more to the risk score.";

export function RiskExplanation({ riskType, factors }: RiskExplanationProps) {
  const [openFactor, setOpenFactor] = useState<string | null>(null);
  const maxImpact = Math.max(1, ...factors.map((factor) => factor.impact));

  if (!factors.length) {
    return <div className="text-xs text-slate-400">No factors to explain yet.</div>;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {labelMap[riskType]} factors
      </div>
      {factors.map((factor) => {
        const isOpen = openFactor === factor.name;
        return (
          <div key={factor.name} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <button
              type="button"
              onClick={() => setOpenFactor(isOpen ? null : factor.name)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <span>{factor.name}</span>
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-300"
                >
                  Impact {factor.impact.toFixed(1)}
                </span>
              </div>
              <span className="text-xs text-slate-400">{isOpen ? "Hide" : "Explain"}</span>
            </button>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-800/60">
              <div
                className="h-2 rounded-full bg-indigo-400"
                style={{
                  width: `${Math.min(100, Math.max(0, (factor.impact / maxImpact) * 100))}%`,
                }}
              />
            </div>
            {isOpen ? (
              <div className="mt-3 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2 text-slate-200">
                  <span>{factor.details}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400" title={whyText}>
                    <Info className="h-3 w-3" />
                    Why this matters
                  </span>
                </div>
                <a href="/timeline" className="text-xs text-emerald-200 hover:text-emerald-100">
                  View related events
                </a>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
