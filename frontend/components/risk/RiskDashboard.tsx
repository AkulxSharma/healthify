"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, DollarSign, Flame, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RiskCard } from "@/components/risk/RiskCard";
import {
  getBurnoutRisk,
  getFinancialRisk,
  getInjuryRisk,
  getIsolationRisk,
} from "@/lib/risk";
import type { BurnoutRisk } from "@/types/risk";

type RiskDashboardProps = {
  compact?: boolean;
  onAggregate?: (value: number | null) => void;
  onHighRisk?: (value: boolean) => void;
};

const ranges = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
];

export function RiskDashboard({ compact = false, onAggregate, onHighRisk }: RiskDashboardProps) {
  const [days, setDays] = useState(7);
  const [burnout, setBurnout] = useState<BurnoutRisk | null>(null);
  const [injury, setInjury] = useState<BurnoutRisk | null>(null);
  const [isolation, setIsolation] = useState<BurnoutRisk | null>(null);
  const [financial, setFinancial] = useState<BurnoutRisk | null>(null);

  useEffect(() => {
    getBurnoutRisk(days).then(setBurnout).catch(() => setBurnout(null));
    getInjuryRisk(days).then(setInjury).catch(() => setInjury(null));
    getIsolationRisk(days).then(setIsolation).catch(() => setIsolation(null));
    getFinancialRisk(days === 7 ? 30 : days).then(setFinancial).catch(() => setFinancial(null));
  }, [days]);

  const aggregate = useMemo(() => {
    const values = [burnout, injury, isolation, financial].filter(Boolean).map((item) => item!.risk);
    if (values.length === 0) {
      return null;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [burnout, injury, isolation, financial]);

  const hasHighRisk = useMemo(() => {
    return [burnout, injury, isolation, financial].some((item) => (item?.risk ?? 0) > 70);
  }, [burnout, injury, isolation, financial]);

  useEffect(() => {
    onAggregate?.(aggregate);
  }, [aggregate, onAggregate]);

  useEffect(() => {
    onHighRisk?.(hasHighRisk);
  }, [hasHighRisk, onHighRisk]);

  return (
    <div className="space-y-4">
      {!compact ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-100">Risk overview</p>
            <p className="text-xs text-slate-400">Average of burnout, injury, isolation, and financial</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ranges.map((range) => (
              <Button
                key={range.value}
                type="button"
                onClick={() => setDays(range.value)}
                className={`h-8 px-3 text-xs ${
                  days === range.value
                    ? "bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                    : "bg-slate-900 text-slate-200 hover:bg-slate-800"
                }`}
              >
                {range.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      {!compact && aggregate !== null ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
          Aggregate risk score: <span className="font-semibold">{Math.round(aggregate)}</span>
        </div>
      ) : null}
      {hasHighRisk && !compact ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          One or more risk areas are above 70.
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <RiskCard type="burnout" riskData={burnout} icon={Flame} compact={compact} />
        <RiskCard type="injury" riskData={injury} icon={Activity} compact={compact} />
        <RiskCard type="isolation" riskData={isolation} icon={Users} compact={compact} />
        <RiskCard type="financial" riskData={financial} icon={DollarSign} compact={compact} />
      </div>
    </div>
  );
}
