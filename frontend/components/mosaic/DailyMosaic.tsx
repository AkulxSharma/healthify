"use client";

import { useEffect, useMemo, useState } from "react";

import { MosaicTile } from "@/components/mosaic/MosaicTile";
import { getDailyMosaic } from "@/lib/mosaic";
import type { DailyMosaic as DailyMosaicType } from "@/types/mosaic";

type DailyMosaicProps = {
  date?: string;
  data?: DailyMosaicType | null;
  showHeader?: boolean;
};

const scoreClass = (score: number) => {
  if (score >= 80) return "border-emerald-400 bg-emerald-500/15 text-emerald-100";
  if (score >= 50) return "border-amber-400 bg-amber-500/15 text-amber-100";
  return "border-rose-400 bg-rose-500/15 text-rose-100";
};

export function DailyMosaic({ date, data, showHeader = true }: DailyMosaicProps) {
  const [mosaic, setMosaic] = useState<DailyMosaicType | null>(data ?? null);
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setMosaic(data);
      setLoading(false);
      setError(null);
      return;
    }
    if (!date) {
      setMosaic(null);
      setLoading(false);
      return;
    }
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getDailyMosaic(date);
        if (!active) {
          return;
        }
        setMosaic(payload);
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load daily mosaic.");
        setMosaic(null);
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
  }, [data, date]);

  const formattedDate = useMemo(() => {
    if (!mosaic?.date) {
      return "Today";
    }
    return new Date(mosaic.date).toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }, [mosaic?.date]);

  if (loading) {
    return <div className="text-sm text-slate-300">Loading mosaic…</div>;
  }

  if (error) {
    return <div className="text-sm text-rose-300">{error}</div>;
  }

  if (!mosaic) {
    return <div className="text-sm text-slate-300">No mosaic data yet.</div>;
  }

  return (
    <div className="space-y-4">
      {showHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-slate-100">{formattedDate}</p>
            <p className="text-xs text-slate-400">Daily mosaic overview</p>
          </div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${scoreClass(mosaic.overall_score)}`}>
            Overall {mosaic.overall_score.toFixed(0)}
          </span>
        </div>
      ) : null}
      <div className="grid grid-cols-4 gap-3">
        {mosaic.tiles.map((tile) => (
          <MosaicTile key={tile.key} tile={tile} />
        ))}
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
        <div className="flex items-center justify-between gap-3">
          <span>{mosaic.story}</span>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${scoreClass(mosaic.overall_score)}`}>
            {mosaic.overall_score.toFixed(0)} / 100
          </span>
        </div>
      </div>
    </div>
  );
}
