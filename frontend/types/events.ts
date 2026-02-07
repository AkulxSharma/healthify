export type EventType =
  | "spending"
  | "food"
  | "movement"
  | "habit"
  | "mood"
  | "sleep"
  | "social"
  | "meds"
  | "work"
  | "study"
  | "break"
  | "water";

export type EventCategory =
  | "finance"
  | "nutrition"
  | "fitness"
  | "health"
  | "social"
  | "productivity"
  | "selfcare";

export interface EventScores {
  wellness_impact?: number;
  cost_impact?: number;
  sustainability_impact?: number;
  explanations?: {
    wellness?: string;
    cost?: string;
    sustainability?: string;
  };
}

export interface EventMetadata {
  merchant?: string;
  category?: string;
  ingredients?: string[];
  meal_type?: "breakfast" | "lunch" | "dinner" | "snack";
  nutrition_quality_score?: number;
  sustainability_score?: number;
  duration_minutes?: number;
  location?: string;
  notes?: string;
  steps?: number;
  type?: string;
  [key: string]: unknown;
}

export interface Event {
  id: string;
  user_id: string;
  timestamp: string;
  created_at: string;
  event_type: EventType;
  category: EventCategory;
  title: string;
  amount?: number;
  metadata?: EventMetadata;
  scores?: EventScores;
}
