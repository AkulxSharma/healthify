export type CostImpact = {
  immediate: number;
  budget_pct: number;
  opportunity_cost: string;
};

export type HealthImpact = {
  calories: number;
  nutrition_quality: number;
  wellness_change: number;
};

export type SustainabilityImpact = {
  co2e_kg: number;
  packaging_waste: "Low" | "Medium" | "High";
  score_change: number;
};

export type NegotiatorBreakdown = {
  cost_impact: CostImpact;
  health_impact: HealthImpact;
  sustainability_impact: SustainabilityImpact;
};

export type NegotiatorAlternative = {
  suggestion: string;
  cost: number;
  cost_saved: number;
  calories: number;
  health_improvement: number;
  sustainability_improvement: number;
  reasoning: string;
};

export type NegotiatorResponse = {
  query: string;
  answer: "yes" | "no" | "maybe";
  breakdown: NegotiatorBreakdown;
  alternative: NegotiatorAlternative;
  final_recommendation: string;
};

export type NegotiatorDecision = NegotiatorResponse & {
  decided_at: string;
  outcome: "did_it" | "took_alternative" | "skipped";
};

export type DecisionLogPayload = {
  query: string;
  item: string;
  decision_type: "did_it" | "took_alternative" | "skipped";
  alternative?: NegotiatorAlternative | null;
  cost_actual?: number | null;
  impacts: NegotiatorBreakdown;
};

export type DecisionHistoryEntry = {
  query: string;
  decision: "did_it" | "took_alternative" | "skipped";
  date: string;
  savings: number;
  impacts: NegotiatorBreakdown;
};
