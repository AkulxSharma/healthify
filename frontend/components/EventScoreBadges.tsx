"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DollarSign, HeartPulse, Leaf } from "lucide-react";

import { ScoreBreakdown } from "@/components/scoring/ScoreBreakdown";
import { explainEventScores } from "@/lib/events";
import type { Event, EventScores } from "@/types/events";

type EventScoreBadgesProps = {
  scores: EventScores;
  compact?: boolean;
  event?: Event;
};

const badgeClass = (value?: number) => {
  const score = value ?? 0;
  if (score > 0) {
    return "border-emerald-400 bg-emerald-500/15 text-emerald-100";
  }
  if (score < 0) {
    return "border-rose-400 bg-rose-500/15 text-rose-100";
  }
  return "border-slate-700 bg-slate-900/40 text-slate-300";
};

const formatSigned = (value?: number) => {
  const score = value ?? 0;
  if (score > 0) {
    return `+${score}`;
  }
  return `${score}`;
};

export function EventScoreBadges({ scores, compact = true, event }: EventScoreBadgesProps) {
  const sizeClass = compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const summary = useMemo(() => (event ? explainEventScores(event) : ""), [event]);
  const explanations = useMemo(() => {
    if (scores.explanations) {
      return scores.explanations;
    }
    if (!summary) {
      return undefined;
    }
    return {
      wellness: summary,
      cost: summary,
      sustainability: summary,
    };
  }, [scores.explanations, summary]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClick = (eventTarget: MouseEvent) => {
      if (!containerRef.current?.contains(eventTarget.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);
  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex flex-wrap items-center gap-1.5"
      >
        <span
          className={`inline-flex items-center gap-1 rounded-full border ${sizeClass} ${badgeClass(
            scores.wellness_impact
          )}`}
        >
          <HeartPulse className="h-3 w-3" />
          Wellness {formatSigned(scores.wellness_impact)}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border ${sizeClass} ${badgeClass(
            scores.cost_impact
          )}`}
        >
          <DollarSign className="h-3 w-3" />
          Cost {scores.cost_impact ? `${scores.cost_impact > 0 ? "+" : ""}$${Math.abs(scores.cost_impact)}` : "$0"}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border ${sizeClass} ${badgeClass(
            scores.sustainability_impact
          )}`}
        >
          <Leaf className="h-3 w-3" />
          Sustain {formatSigned(scores.sustainability_impact)}
        </span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-2xl border border-slate-800 bg-slate-950 p-3 shadow-lg">
          <ScoreBreakdown scores={scores} explanations={explanations} />
        </div>
      ) : null}
    </div>
  );
}
