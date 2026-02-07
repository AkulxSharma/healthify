import { safeFetch } from "@/lib/api";
import type { DailyMosaic, MosaicTile } from "@/types/mosaic";

const buildTiles = (): MosaicTile[] => [
  { key: "sleep", name: "Sleep", score: 78, color: "green", detail: "7h 20m restful sleep" },
  { key: "movement", name: "Movement", score: 72, color: "yellow", detail: "32 minutes active" },
  { key: "focus", name: "Focus", score: 81, color: "green", detail: "2 deep work blocks" },
  { key: "social", name: "Social", score: 64, color: "yellow", detail: "Caught up with 1 friend" },
  { key: "nutrition", name: "Nutrition", score: 74, color: "green", detail: "Balanced meals logged" },
  { key: "mood", name: "Mood", score: 70, color: "yellow", detail: "Mostly upbeat" },
];

const buildDailyMosaic = (date: string): DailyMosaic => ({
  date,
  overall_score: 74,
  story: "Steady day with strong recovery and balanced habits.",
  tiles: buildTiles(),
});

const buildWeekMosaics = (start: string): DailyMosaic[] => {
  const startDate = new Date(start);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + index);
    return buildDailyMosaic(day.toISOString());
  });
};

export const getDailyMosaic = async (date: string): Promise<DailyMosaic> => {
  const params = new URLSearchParams();
  params.set("date", date);
  return safeFetch(`/mosaic/daily?${params.toString()}`, buildDailyMosaic(date));
};

export const getWeekMosaics = async (start: string): Promise<DailyMosaic[]> => {
  const params = new URLSearchParams();
  params.set("start", start);
  return safeFetch(`/mosaic/week?${params.toString()}`, buildWeekMosaics(start));
};
