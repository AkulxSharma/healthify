export type WalletTrajectoryPoint = {
  date: string;
  balance: number;
  lower?: number;
  upper?: number;
};

export type RecurringExpense = {
  name: string;
  amount: number;
  cadence_days: number;
  next_due: string;
};

export type WalletProjection = {
  current_balance: number;
  trajectories: {
    current: WalletTrajectoryPoint[];
    with_swaps: WalletTrajectoryPoint[];
  };
  recurring_expenses: RecurringExpense[];
  savings_potential: number;
};

export type WalletMonthlyBreakdown = {
  month: string;
  projected_income: number;
  projected_spend: number;
  net: number;
  cumulative_balance: number;
};

export type WalletLongTermProjection = {
  current_balance: number;
  trajectories: {
    current: WalletTrajectoryPoint[];
    with_swaps: WalletTrajectoryPoint[];
  };
  monthly_breakdown: WalletMonthlyBreakdown[];
  cumulative_savings: {
    current: number;
    with_swaps: number;
  };
  major_expenses: Array<{
    name: string;
    amount: number;
    next_due: string;
  }>;
};

export type WellnessProjectionPoint = {
  date: string;
  score: number;
  sleep: number;
  diet: number;
  movement: number;
  stress: number;
};

export type WellnessFactor = {
  name: string;
  impact: number;
  detail: string;
};

export type WellnessProjection = {
  current_score: number;
  projected_scores: WellnessProjectionPoint[];
  trajectories: {
    current: WellnessProjectionPoint[];
    improved: WellnessProjectionPoint[];
  };
  factors_impacting: WellnessFactor[];
  recommended_changes: string[];
};

export type SustainabilityPoint = {
  date: string;
  co2e: number;
  water: number;
  waste: number;
};

export type SustainabilityImpact = {
  name: string;
  impact: number;
  detail: string;
};

export type SustainabilityProjection = {
  current_footprint: number;
  projected_footprint: number;
  trajectories: {
    current: SustainabilityPoint[];
    green_swaps: SustainabilityPoint[];
  };
  improvement_potential: number;
  top_impact_areas: SustainabilityImpact[];
};

export type ScenarioPoint = {
  date: string;
  value: number;
};

export type ScenarioResult = {
  name: string;
  data: ScenarioPoint[];
  final_value: number;
};

export type DivergencePoint = {
  date: string;
  impact: number;
};

export type ScenarioComparison = {
  scenarios: ScenarioResult[];
  divergence_points: DivergencePoint[];
};
