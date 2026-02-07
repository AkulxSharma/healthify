export type SwapPreference = "healthier" | "cheaper" | "eco";

export type MealAnalysis = {
  meal_name: string;
  estimated_calories?: number | null;
  ingredients?: string[];
  nutrition_quality?: number | null;
  protein_g?: number | null;
  sugar_g?: number | null;
  fat_g?: number | null;
  cost_estimate?: number | null;
  sustainability_score?: number | null;
  meal_type?: "breakfast" | "lunch" | "dinner" | "snack" | null;
};

export type SwapSuggestion = {
  swap_id: string;
  original: MealAnalysis;
  healthier: SwapAlternative;
  cheaper: SwapAlternative;
  eco: SwapAlternative;
  best_balanced: SwapPreference;
};

export type SwapAlternative = {
  alternative: string;
  calories?: number | null;
  nutrition_quality?: number | null;
  sustainability_score?: number | null;
  cost_estimate?: number | null;
  savings?: number | null;
  co2_saved?: number | null;
  comparison?: Record<string, number | null>;
  availability?: string;
  reasoning?: string;
};

export type SwapHistoryItem = {
  id: string;
  swap_type: SwapPreference;
  original_data: MealAnalysis;
  alternative_data: SwapAlternative;
  accepted_at: string;
};

export type SwapAcceptResult = {
  id: string;
  event_id: string;
};

export type SwapFeedbackSummary = {
  accepted_count: number;
  rejected_count: number;
  acceptance_rate: number;
  most_common_rejection?: string | null;
};

export type SwapRejectionReason =
  | "taste_preference"
  | "availability"
  | "too_expensive"
  | "dietary_restriction"
  | "time_constraint"
  | "not_realistic"
  | "other";

export type SwapRejectResponse = {
  id: string;
  message: string;
};
