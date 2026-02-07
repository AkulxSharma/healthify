"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Timeline } from "@/components/Timeline";
import { TimelineFilters, type TimelineFiltersValue } from "@/components/TimelineFilters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { getEventsByDateRange } from "@/lib/events";
import type { Event } from "@/types/events";

const buildTodayRange = (): TimelineFiltersValue => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
};

export default function TimelinePage() {
  const router = useRouter();
  const { user, loading } = useSupabaseSession();
  const [filters, setFilters] = useState<TimelineFiltersValue>(() => buildTodayRange());
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const limit = 20;

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  const loadEvents = useCallback(
    async (nextOffset: number, replace: boolean) => {
      try {
        if (replace) {
          setLoadingEvents(true);
        } else {
          setLoadingMore(true);
        }
        const result = await getEventsByDateRange(
          filters.startDate,
          filters.endDate,
          filters.types,
          undefined,
          limit,
          nextOffset
        );
        setEvents((prev) => (replace ? result.events : [...prev, ...result.events]));
        setHasMore(result.hasMore);
        setOffset(nextOffset);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load timeline.";
        setError(message);
        if (replace) {
          setEvents([]);
        }
      } finally {
        setLoadingEvents(false);
        setLoadingMore(false);
      }
    },
    [filters.endDate, filters.startDate, filters.types]
  );

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadEvents(0, true);
  }, [loadEvents, user]);

  const handleFilter = useCallback((value: TimelineFiltersValue) => {
    setFilters(value);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore) {
      return;
    }
    void loadEvents(offset + limit, false);
  }, [hasMore, limit, loadEvents, loadingMore, offset]);

  const subtitle = useMemo(() => {
    if (loadingEvents) {
      return "Loading your timeline.";
    }
    return "Browse events across your life mosaic.";
  }, [loadingEvents]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-200 px-6 py-10">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 px-6 py-10">Redirecting...</div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-start px-6 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <TimelineFilters onFilter={handleFilter} loading={loadingEvents} />
            {error ? <div className="text-sm text-rose-300">{error}</div> : null}
            <Timeline
              events={events}
              loading={loadingEvents}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={handleLoadMore}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
