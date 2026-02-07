import { safeFetch } from "@/lib/api";
import type {
  BeforeAfterComparison,
  BreakdownData,
  BreakdownType,
  DashboardPeriod,
  DashboardStats,
  ScoreHistoryPoint,
  TrendData,
  TrendMetric,
} from "@/types/analytics";

const buildDateSeries = (startDate: string, endDate: string): string[] => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );
  return Array.from({ length: days }, (_, index) => {
    const point = new Date(start);
    point.setDate(start.getDate() + index);
    return point.toISOString();
  });
};

const buildTrendData = (
  startDate: string,
  endDate: string,
  base: number,
  step: number
): TrendData[] => {
  return buildDateSeries(startDate, endDate).map((date, index) => ({
    date,
    value: Math.max(0, Math.round(base + index * step)),
  }));
};

const mockTrendData = (metric: TrendMetric, startDate: string, endDate: string): TrendData[] => {
  switch (metric) {
    case "spending":
      return buildTrendData(startDate, endDate, 48, -2);
    case "wellness":
      return buildTrendData(startDate, endDate, 70, 1);
    case "sustainability":
      return buildTrendData(startDate, endDate, 62, 1);
    case "movement_minutes":
      return buildTrendData(startDate, endDate, 25, 2);
    default:
      return buildTrendData(startDate, endDate, 50, 0);
  }
};

const mockBreakdownData = (type: BreakdownType): BreakdownData[] => {
  if (type === "spending_by_category") {
    return [
      { name: "Groceries", value: 220, percentage: 42, color: "#fb923c" },
      { name: "Dining", value: 140, percentage: 26, color: "#f97316" },
      { name: "Transport", value: 90, percentage: 17, color: "#38bdf8" },
      { name: "Other", value: 80, percentage: 15, color: "#94a3b8" },
    ];
  }
  if (type === "food_by_quality") {
    return [
      { name: "Nourishing", value: 12, percentage: 48, color: "#22c55e" },
      { name: "Balanced", value: 8, percentage: 32, color: "#38bdf8" },
      { name: "Indulgent", value: 5, percentage: 20, color: "#f97316" },
    ];
  }
  return [
    { name: "Work", value: 28, percentage: 40, color: "#a855f7" },
    { name: "Movement", value: 14, percentage: 20, color: "#22c55e" },
    { name: "Recovery", value: 12, percentage: 17, color: "#38bdf8" },
    { name: "Social", value: 16, percentage: 23, color: "#f97316" },
  ];
};

const mockDashboardStats = (period: DashboardPeriod): DashboardStats => ({
  period,
  stats: {
    spending_total: { value: 412.3, change: -23.4, change_percent: -5.4 },
    steps_total: { value: 42000, change: 3200, change_percent: 8.2 },
    meals_logged: { value: 18, change: 2, change_percent: 12.5 },
    workouts_completed: { value: 4, change: 1, change_percent: 33.3 },
    wellness_score_avg: { value: 78, change: 4, change_percent: 5.4 },
    swaps_accepted: { value: 3, change: 1, change_percent: 50 },
    money_saved_via_swaps: { value: 67.2, change: 18.9, change_percent: 39.1 },
  },
});

const mockScoreHistory = (startDate: string, endDate: string): ScoreHistoryPoint[] => {
  return buildDateSeries(startDate, endDate).map((date, index) => ({
    date,
    wallet_score: Math.min(100, 72 + index),
    wellness_score: Math.min(100, 68 + index),
    sustainability_score: Math.min(100, 65 + index * 0.8),
    movement_score: Math.min(100, 60 + index * 1.2),
  }));
};

export const getTrendData = async (
  metric: TrendMetric,
  startDate: string,
  endDate: string,
  granularity = "day"
): Promise<TrendData[]> => {
  const params = new URLSearchParams();
  params.set("metric", metric);
  params.set("start", startDate);
  params.set("end", endDate);
  params.set("granularity", granularity);
  const payload = await safeFetch<{ data?: TrendData[] }>(
    `/analytics/trends?${params.toString()}`,
    { data: mockTrendData(metric, startDate, endDate) }
  );
  return payload.data ?? [];
};

export const getBreakdownData = async (
  type: BreakdownType,
  startDate: string,
  endDate: string
): Promise<BreakdownData[]> => {
  const params = new URLSearchParams();
  params.set("type", type);
  params.set("start", startDate);
  params.set("end", endDate);
  const payload = await safeFetch<{ data?: BreakdownData[] }>(
    `/analytics/breakdown?${params.toString()}`,
    { data: mockBreakdownData(type) }
  );
  return payload.data ?? [];
};

export const getDashboardStats = async (period: DashboardPeriod): Promise<DashboardStats> => {
  const params = new URLSearchParams();
  params.set("period", period);
  return safeFetch(`/analytics/dashboard-stats?${params.toString()}`, mockDashboardStats(period));
};

export const getBeforeAfterComparison = async (
  metric: BeforeAfterComparison["metric"],
  interventionDate: string
): Promise<BeforeAfterComparison> => {
  const params = new URLSearchParams();
  params.set("metric", metric);
  params.set("intervention_date", interventionDate);
  const beforeStart = new Date(interventionDate);
  beforeStart.setDate(beforeStart.getDate() - 14);
  const beforeEnd = new Date(interventionDate);
  beforeEnd.setDate(beforeEnd.getDate() - 1);
  const afterStart = new Date(interventionDate);
  const afterEnd = new Date(interventionDate);
  afterEnd.setDate(afterEnd.getDate() + 13);
  const beforeData = buildTrendData(beforeStart.toISOString(), beforeEnd.toISOString(), 62, 1);
  const afterData = buildTrendData(afterStart.toISOString(), afterEnd.toISOString(), 70, 1);
  const beforeAvg = beforeData.reduce((sum, point) => sum + point.value, 0) / beforeData.length;
  const afterAvg = afterData.reduce((sum, point) => sum + point.value, 0) / afterData.length;
  const change = afterAvg - beforeAvg;
  const mock: BeforeAfterComparison = {
    metric,
    intervention_date: interventionDate,
    before_avg: Number(beforeAvg.toFixed(1)),
    after_avg: Number(afterAvg.toFixed(1)),
    change: Number(change.toFixed(1)),
    change_percent: Number(((change / beforeAvg) * 100).toFixed(1)),
    before_data: beforeData,
    after_data: afterData,
  };
  return safeFetch(`/analytics/comparison?${params.toString()}`, mock);
};

export const getScoreHistory = async (
  startDate: string,
  endDate: string
): Promise<ScoreHistoryPoint[]> => {
  const params = new URLSearchParams();
  params.set("start", startDate);
  params.set("end", endDate);
  return safeFetch(`/analytics/score-history?${params.toString()}`, mockScoreHistory(startDate, endDate));
};
