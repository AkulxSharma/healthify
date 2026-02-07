import { safeFetch } from "@/lib/api";
import type {
  ScenarioComparison,
  SustainabilityProjection,
  WalletLongTermProjection,
  WalletProjection,
  WellnessProjection,
} from "@/types/digitalTwin";

const buildDateSeries = (days: number): string[] => {
  const start = new Date();
  return Array.from({ length: days }, (_, index) => {
    const point = new Date(start);
    point.setDate(start.getDate() + index);
    return point.toISOString();
  });
};

const buildWalletProjection = (days: number): WalletProjection => {
  const currentBalance = 1247.8;
  const dates = buildDateSeries(days);
  const current = dates.map((date, index) => ({
    date,
    balance: Math.round((currentBalance + index * 12) * 100) / 100,
    lower: Math.round((currentBalance + index * 10) * 100) / 100,
    upper: Math.round((currentBalance + index * 14) * 100) / 100,
  }));
  const withSwaps = dates.map((date, index) => ({
    date,
    balance: Math.round((currentBalance + index * 14) * 100) / 100,
    lower: Math.round((currentBalance + index * 12) * 100) / 100,
    upper: Math.round((currentBalance + index * 16) * 100) / 100,
  }));
  return {
    current_balance: currentBalance,
    trajectories: { current, with_swaps: withSwaps },
    recurring_expenses: [
      {
        name: "Gym membership",
        amount: 45,
        cadence_days: 30,
        next_due: dates[7],
      },
      {
        name: "Streaming",
        amount: 15,
        cadence_days: 30,
        next_due: dates[12],
      },
    ],
    savings_potential: 240,
  };
};

const buildWalletLongProjection = (months: number): WalletLongTermProjection => {
  const days = months * 30;
  const short = buildWalletProjection(days);
  const monthly_breakdown = Array.from({ length: months }, (_, index) => {
    const month = new Date();
    month.setMonth(month.getMonth() + index);
    const projected_income = 3200 + index * 50;
    const projected_spend = 2400 + index * 30;
    const net = projected_income - projected_spend;
    return {
      month: month.toLocaleString(undefined, { month: "short", year: "numeric" }),
      projected_income,
      projected_spend,
      net,
      cumulative_balance: short.current_balance + net * (index + 1),
    };
  });
  return {
    current_balance: short.current_balance,
    trajectories: short.trajectories,
    monthly_breakdown,
    cumulative_savings: {
      current: 840,
      with_swaps: 1150,
    },
    major_expenses: [
      { name: "Insurance", amount: 380, next_due: new Date().toISOString() },
      { name: "Maintenance", amount: 220, next_due: new Date().toISOString() },
    ],
  };
};

const buildWellnessProjection = (days: number): WellnessProjection => {
  const dates = buildDateSeries(days);
  const currentScore = 72;
  const current = dates.map((date, index) => ({
    date,
    score: Math.min(100, currentScore + index * 0.2),
    sleep: 70 + index * 0.2,
    diet: 68 + index * 0.3,
    movement: 65 + index * 0.4,
    stress: 60 + index * 0.1,
  }));
  const improved = dates.map((date, index) => ({
    date,
    score: Math.min(100, currentScore + index * 0.4),
    sleep: 74 + index * 0.4,
    diet: 72 + index * 0.5,
    movement: 70 + index * 0.6,
    stress: 64 + index * 0.2,
  }));
  return {
    current_score: currentScore,
    projected_scores: improved,
    trajectories: { current, improved },
    factors_impacting: [
      { name: "Sleep consistency", impact: 6, detail: "Solid 7-hour average" },
      { name: "Movement", impact: 4, detail: "Regular low-impact sessions" },
    ],
    recommended_changes: ["Add a 10-minute stretch routine", "Aim for consistent meal timing"],
  };
};

const buildSustainabilityProjection = (days: number): SustainabilityProjection => {
  const dates = buildDateSeries(days);
  const current = dates.map((date, index) => ({
    date,
    co2e: 12 - index * 0.1,
    water: 90 - index * 0.4,
    waste: 4 - index * 0.05,
  }));
  const green_swaps = dates.map((date, index) => ({
    date,
    co2e: 10 - index * 0.15,
    water: 80 - index * 0.5,
    waste: 3.5 - index * 0.06,
  }));
  return {
    current_footprint: 24.6,
    projected_footprint: 21.2,
    trajectories: { current, green_swaps },
    improvement_potential: 18,
    top_impact_areas: [
      { name: "Food", impact: 9, detail: "Swap 2 meals per week" },
      { name: "Transport", impact: 6, detail: "Shorter car trips" },
      { name: "Energy", impact: 3, detail: "Off-peak usage" },
    ],
  };
};

const buildScenarioComparison = (): ScenarioComparison => ({
  scenarios: [
    {
      name: "Baseline",
      data: buildDateSeries(14).map((date, index) => ({
        date,
        value: 72 + index,
      })),
      final_value: 86,
    },
    {
      name: "With swaps",
      data: buildDateSeries(14).map((date, index) => ({
        date,
        value: 74 + index * 1.2,
      })),
      final_value: 90,
    },
  ],
  divergence_points: [
    { date: buildDateSeries(14)[6], impact: 4.2 },
    { date: buildDateSeries(14)[10], impact: 6.1 },
  ],
});

export const getWalletProjection = async (days = 30): Promise<WalletProjection> => {
  const params = new URLSearchParams();
  params.set("days", String(days));
  return safeFetch(`/digital-twin/wallet?${params.toString()}`, buildWalletProjection(days));
};

export const getWalletProjectionLong = async (months = 3): Promise<WalletLongTermProjection> => {
  const params = new URLSearchParams();
  params.set("months", String(months));
  return safeFetch(`/digital-twin/wallet-long?${params.toString()}`, buildWalletLongProjection(months));
};

export const getWellnessProjection = async (days = 30): Promise<WellnessProjection> => {
  const params = new URLSearchParams();
  params.set("days", String(days));
  return safeFetch(`/digital-twin/wellness?${params.toString()}`, buildWellnessProjection(days));
};

export const getSustainabilityProjection = async (days = 30): Promise<SustainabilityProjection> => {
  const params = new URLSearchParams();
  params.set("days", String(days));
  return safeFetch(
    `/digital-twin/sustainability?${params.toString()}`,
    buildSustainabilityProjection(days)
  );
};

export const getScenarioComparison = async (
  scenarios: Array<{ name: string; inputs?: Record<string, number> }>,
  metric: string,
  days = 30
): Promise<ScenarioComparison> => {
  return safeFetch(
    "/digital-twin/compare",
    buildScenarioComparison(),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarios, metric, days }),
    }
  );
};
