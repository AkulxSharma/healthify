"use client";

import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Coffee,
  DollarSign,
  Droplet,
  Dumbbell,
  Moon,
  Pill,
  Timer,
  Users,
  Utensils,
} from "lucide-react";

import { EventScoreBadges } from "@/components/EventScoreBadges";
import type { Event } from "@/types/events";

type TimelineProps = {
  events: Event[];
  loading: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

const eventIcons: Record<Event["event_type"], LucideIcon> = {
  spending: DollarSign,
  food: Utensils,
  movement: Dumbbell,
  habit: Timer,
  mood: Moon,
  sleep: Moon,
  social: Users,
  meds: Pill,
  work: Timer,
  study: Timer,
  break: Coffee,
  water: Droplet,
};

const formatDateLabel = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diffDays === 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const metadataPreview = (event: Event) => {
  const meta = event.metadata ?? {};
  const parts: string[] = [];
  if (meta.merchant) parts.push(meta.merchant);
  if (meta.category) parts.push(meta.category);
  if (meta.meal_type) parts.push(meta.meal_type);
  if (meta.duration_minutes) parts.push(`${meta.duration_minutes} min`);
  if (meta.steps) parts.push(`${meta.steps} steps`);
  if (meta.location) parts.push(meta.location);
  if (meta.notes) parts.push(meta.notes);
  return parts.join(" • ");
};

export function Timeline({ events, loading, hasMore, loadingMore, onLoadMore }: TimelineProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, Event[]>();
    events.forEach((event) => {
      const key = new Date(event.timestamp).toDateString();
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    });
    return Array.from(map.entries()).map(([key, list]) => ({
      dateKey: key,
      label: formatDateLabel(key),
      items: list.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    }));
  }, [events]);

  if (loading) {
    return <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-6">Loading timeline…</div>;
  }

  if (!events.length) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-6 text-slate-300">
        No events yet. Try logging a habit, meal, or activity.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.dateKey} className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">{group.label}</div>
          <div className="space-y-2">
            {group.items.map((event) => {
              const Icon = eventIcons[event.event_type] ?? Pill;
              const preview = metadataPreview(event);
              return (
                <div
                  key={event.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 rounded-full border border-slate-800 bg-slate-950/60 p-2">
                      <Icon className="h-4 w-4 text-slate-200" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100">
                          {event.title}
                        </span>
                        <span className="text-xs text-slate-400">{formatTime(event.timestamp)}</span>
                      </div>
                      {preview ? (
                        <div className="text-xs text-slate-400">{preview}</div>
                      ) : null}
                    </div>
                  </div>
                  <EventScoreBadges scores={event.scores ?? {}} event={event} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200 hover:bg-slate-900 disabled:opacity-60"
        >
          {loadingMore ? "Loading more…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
