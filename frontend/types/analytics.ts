export interface TrendData {
  date: string;
  value: number;
}

export interface BreakdownData {
  name: string;
  value: number;
  percentage: number;
  color?: string;
}

export type TrendMetric = "spending" | "wellness" | "sustainability" | "movement_minutes";

export type BreakdownType = "spending_by_category" | "food_by_quality" | "time_by_activity";

export type DashboardPeriod = "week" | "month";

export type StatKey =
  | "spending_total"
  | "steps_total"
  | "meals_logged"
  | "workouts_completed"
  | "wellness_score_avg"
  | "swaps_accepted"
  | "money_saved_via_swaps";

export interface StatValue {
  value: number;
  change: number;
  change_percent: number;
}

export interface DashboardStats {
  period: DashboardPeriod;
  stats: Record<StatKey, StatValue>;
}

export type ComparisonMetric = "spending" | "wellness" | "movement_minutes" | "steps";

export interface BeforeAfterComparison {
  metric: ComparisonMetric;
  intervention_date: string;
  before_avg: number;
  after_avg: number;
  change: number;
  change_percent: number;
  before_data: TrendData[];
  after_data: TrendData[];
}

export interface ScoreHistoryPoint {
  date: string;
  wallet_score?: number | null;
  wellness_score?: number | null;
  sustainability_score?: number | null;
  movement_score?: number | null;
}
