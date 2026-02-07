"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ComparisonsPanel } from "@/components/charts/ComparisonsPanel";
import { DailyMosaic } from "@/components/mosaic/DailyMosaic";
import { MosaicCalendar } from "@/components/mosaic/MosaicCalendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

export default function MosaicPage() {
  const router = useRouter();
  const { user, loading } = useSupabaseSession();
  const [selectedDate, setSelectedDate] = useState(() => toDateInput(new Date()));

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  const formattedDate = useMemo(() => {
    return new Date(selectedDate).toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }, [selectedDate]);

  const shiftDay = (delta: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + delta);
    setSelectedDate(toDateInput(date));
  };

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
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Daily mosaic</CardTitle>
            <CardDescription>Track your balance across life domains.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">Selected day</p>
                <p className="text-base font-semibold text-slate-100">{formattedDate}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => shiftDay(-1)}>
                  Previous
                </Button>
                <Button type="button" onClick={() => setSelectedDate(toDateInput(new Date()))}>
                  Today
                </Button>
                <Button type="button" onClick={() => shiftDay(1)}>
                  Next
                </Button>
              </div>
            </div>
            <DailyMosaic date={selectedDate} />
            <MosaicCalendar initialDate={selectedDate} />
            <div id="comparisons">
              <ComparisonsPanel />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
