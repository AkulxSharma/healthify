"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

type StatTileProps = {
  title: string;
  value: number;
  unit?: string;
  change?: number;
  icon: LucideIcon;
  color: string;
};

const formatValue = (value: number, unit?: string) => {
  if (unit === "$") {
    return `$${value.toFixed(2)}`;
  }
  if (unit === "%") {
    return `${value.toFixed(0)}%`;
  }
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }
  return value.toFixed(1);
};

export function StatTile({ title, value, unit, change, icon: Icon, color }: StatTileProps) {
  const changeValue = change ?? 0;
  const positive = changeValue >= 0;
  const changeLabel = change == null ? "—" : `${Math.abs(changeValue).toFixed(1)}%`;
  const changeClass = positive ? "text-emerald-300" : "text-rose-300";
  const ChangeIcon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4">
      <div className="flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className={`flex items-center gap-1 text-xs ${changeClass}`}>
          <ChangeIcon className="h-3 w-3" />
          <span>{changeLabel}</span>
        </div>
      </div>
      <div className="mt-3">
        <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-semibold text-slate-100">{formatValue(value, unit)}</p>
          {unit && unit !== "$" && unit !== "%" ? (
            <span className="text-xs text-slate-400">{unit}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
