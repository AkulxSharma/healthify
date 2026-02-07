"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskExplanation } from "@/components/risk/RiskExplanation";
import type { BurnoutRisk, RiskType } from "@/types/risk";

type RiskCardProps = {
  type: RiskType;
  riskData: BurnoutRisk | null;
  icon: LucideIcon;
  compact?: boolean;
};

const levelStyles: Record<BurnoutRisk["level"], string> = {
  low: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  medium: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  high: "bg-rose-500/20 text-rose-200 border-rose-500/40",
};

const gaugeStyles: Record<BurnoutRisk["level"], string> = {
  low: "bg-emerald-400",
  medium: "bg-amber-400",
  high: "bg-rose-400",
};

const typeLabels: Record<RiskType, string> = {
  burnout: "Burnout",
  injury: "Injury",
  isolation: "Isolation",
  financial: "Financial",
};

export function RiskCard({ type, riskData, icon: Icon, compact = false }: RiskCardProps) {
  const [expandDetails, setExpandDetails] = useState(false);
  const topFactors = useMemo(() => (riskData?.factors ?? []).slice(0, compact ? 2 : 3), [riskData, compact]);
  const maxImpact = useMemo(
    () => Math.max(1, ...topFactors.map((factor) => factor.impact)),
    [topFactors]
  );

  return (
    <Card className={compact ? "h-full" : undefined}>
      <CardHeader className={compact ? "pb-2" : undefined}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-slate-200" />
          {typeLabels[type]} risk
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!riskData ? (
          <div className="text-sm text-slate-300">Loading risk...</div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Risk score</p>
                <p className="text-3xl font-semibold text-slate-100">{Math.round(riskData.risk)}</p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${levelStyles[riskData.level]}`}
              >
                {riskData.level}
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-800/60">
              <div
                className={`h-3 rounded-full ${gaugeStyles[riskData.level]}`}
                style={{ width: `${Math.min(100, Math.max(0, riskData.risk))}%` }}
              />
            </div>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">Top factors</p>
              {topFactors.length === 0 ? (
                <div className="text-sm text-slate-300">No dominant factors yet.</div>
              ) : (
                topFactors.map((factor) => (
                  <div key={factor.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>{factor.name}</span>
                      <span>{factor.details}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800/60">
                      <div
                        className="h-2 rounded-full bg-indigo-400"
                        style={{
                          width: `${Math.min(100, Math.max(0, (factor.impact / maxImpact) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
            {!compact ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-400">Recommendations</p>
                {riskData.recommendations.length === 0 ? (
                  <div className="text-sm text-slate-300">You are trending well.</div>
                ) : (
                  <div className="space-y-2">
                    {riskData.recommendations.map((item) => (
                      <label key={item} className="flex items-center gap-2 text-sm text-slate-200">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-700 bg-slate-900" />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            <div className="space-y-2">
              <button
                type="button"
                className="text-xs text-slate-300 hover:text-slate-100"
                onClick={() => setExpandDetails((value) => !value)}
              >
                {expandDetails ? "Hide details" : "View details"}
              </button>
              {expandDetails && riskData ? (
                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Days analyzed</span>
                    <span>{riskData.days}</span>
                  </div>
                  <RiskExplanation riskType={type} factors={riskData.factors} />
                </div>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
