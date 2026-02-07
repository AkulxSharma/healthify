"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { EventType } from "@/types/events";

type DateRangeKey = "today" | "last7" | "last30" | "custom";

export type TimelineFiltersValue = {
  startDate: string;
  endDate: string;
  types?: EventType[];
};

type TimelineFiltersProps = {
  onFilter: (filters: TimelineFiltersValue) => void;
  loading?: boolean;
};

const typeOptions: Array<{ label: string; value: EventType }> = [
  { label: "Spending", value: "spending" },
  { label: "Food", value: "food" },
  { label: "Movement", value: "movement" },
  { label: "Social", value: "social" },
  { label: "Sleep", value: "sleep" },
  { label: "Meds", value: "meds" },
];

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

export function TimelineFilters({ onFilter, loading }: TimelineFiltersProps) {
  const [range, setRange] = useState<DateRangeKey>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<EventType[]>([]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (range !== "today") {
      count += 1;
    }
    if (selectedTypes.length > 0) {
      count += 1;
    }
    return count;
  }, [range, selectedTypes.length]);

  const toggleType = (value: EventType) => {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const buildDateRange = () => {
    const now = new Date();
    if (range === "today") {
      return { start: startOfDay(now), end: endOfDay(now) };
    }
    if (range === "last7") {
      const start = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
      return { start, end: endOfDay(now) };
    }
    if (range === "last30") {
      const start = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
      return { start, end: endOfDay(now) };
    }
    const start = customStart ? startOfDay(new Date(customStart)) : startOfDay(now);
    const end = customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now);
    return { start, end };
  };

  const handleApply = () => {
    const { start, end } = buildDateRange();
    onFilter({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      types: selectedTypes.length > 0 ? selectedTypes : undefined,
    });
  };

  const allChecked = selectedTypes.length === 0;

  return (
    <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Timeline filters</p>
          <p className="text-xs text-slate-400">Filter by date range and event type.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs text-slate-300">
          Active {activeCount}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => setRange("today")}
          className={range === "today" ? "" : "border border-slate-800 bg-transparent"}
        >
          Today
        </Button>
        <Button
          type="button"
          onClick={() => setRange("last7")}
          className={range === "last7" ? "" : "border border-slate-800 bg-transparent"}
        >
          Last 7 days
        </Button>
        <Button
          type="button"
          onClick={() => setRange("last30")}
          className={range === "last30" ? "" : "border border-slate-800 bg-transparent"}
        >
          Last 30 days
        </Button>
        <Button
          type="button"
          onClick={() => setRange("custom")}
          className={range === "custom" ? "" : "border border-slate-800 bg-transparent"}
        >
          Custom
        </Button>
      </div>

      {range === "custom" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="date"
            value={customStart}
            onChange={(event) => setCustomStart(event.target.value)}
          />
          <Input
            type="date"
            value={customEnd}
            onChange={(event) => setCustomEnd(event.target.value)}
          />
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-slate-400">Event types</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
            <Checkbox checked={allChecked} onChange={() => setSelectedTypes([])} label="All" />
          </div>
          {typeOptions.map((option) => (
            <div
              key={option.value}
              className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2"
            >
              <Checkbox
                checked={selectedTypes.includes(option.value)}
                onChange={() => toggleType(option.value)}
                label={option.label}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Button type="button" onClick={handleApply} disabled={loading}>
          {loading ? "Loading…" : "Apply filters"}
        </Button>
      </div>
    </div>
  );
}
