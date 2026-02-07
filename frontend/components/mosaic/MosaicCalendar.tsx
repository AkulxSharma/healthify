"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { getWeekMosaics } from "@/lib/mosaic";
import type { DailyMosaic as DailyMosaicType } from "@/types/mosaic";
import { DailyMosaic } from "@/components/mosaic/DailyMosaic";

type MosaicCalendarProps = {
  initialDate?: string;
};

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

const startOfWeek = (date: Date) => {
  const day = date.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(date);
  start.setDate(start.getDate() - diff);
  return start;
};

const scoreClass = (score: number) => {
  if (score >= 80) return "text-emerald-200";
  if (score >= 50) return "text-amber-200";
  return "text-rose-200";
};

export function MosaicCalendar({ initialDate }: MosaicCalendarProps) {
  const initial = initialDate ? new Date(initialDate) : new Date();
  const [startDate, setStartDate] = useState(() => toDateInput(startOfWeek(initial)));
  const [selectedDate, setSelectedDate] = useState(() => toDateInput(initial));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<DailyMosaicType[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getWeekMosaics(startDate);
        if (!active) {
          return;
        }
        setDays(payload);
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load week mosaic.");
        setDays([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [startDate]);

  const selectedMosaic = useMemo(
    () => days.find((day) => day.date === selectedDate) ?? null,
    [days, selectedDate]
  );

  const startLabel = useMemo(() => {
    const date = new Date(startDate);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }, [startDate]);

  const endLabel = useMemo(() => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + 6);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }, [startDate]);

  const shiftWeek = (delta: number) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + delta);
    setStartDate(toDateInput(date));
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Week mosaic</h3>
          <p className="text-sm text-slate-400">
            {startLabel} - {endLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => shiftWeek(-7)}>
            Previous
          </Button>
          <Button type="button" onClick={() => shiftWeek(7)}>
            Next
          </Button>
        </div>
      </div>
      {loading ? <div className="text-sm text-slate-300">Loading week mosaic…</div> : null}
      {error ? <div className="text-sm text-rose-300">{error}</div> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            onClick={() => setSelectedDate(day.date)}
            className={`rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-left text-xs ${
              selectedDate === day.date ? "ring-1 ring-emerald-400" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-slate-300">
                {new Date(day.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
              </span>
              <span className={`text-xs ${scoreClass(day.overall_score)}`}>
                {day.overall_score.toFixed(0)}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {day.tiles.map((tile) => (
                <span
                  key={`${day.date}-${tile.key}`}
                  className={`h-3 w-3 rounded ${
                    tile.color === "green"
                      ? "bg-emerald-400"
                      : tile.color === "yellow"
                        ? "bg-amber-400"
                        : "bg-rose-400"
                  }`}
                />
              ))}
            </div>
          </button>
        ))}
      </div>
      {selectedMosaic ? <DailyMosaic data={selectedMosaic} showHeader={false} /> : null}
    </section>
  );
}
