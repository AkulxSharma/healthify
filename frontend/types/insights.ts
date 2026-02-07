export type CorrelationInsight = {
  pattern: string;
  frequency: number;
  impact_metric: string;
  impact_value: number;
  impact_description: string;
  confidence: number;
  recommendation: string;
};

export type TriggerEntry = {
  type: "time" | "location" | "mood" | "social";
  value: string;
  occurrence_rate: number;
  impact_metric: string;
  impact_value: number;
};

export type TriggerInsightResponse = {
  negative_pattern: string;
  triggers: TriggerEntry[];
  recommendations: string[];
};

export type InsightNotification = {
  type: string;
  title: string;
  message: string;
  severity: "low" | "medium" | "high";
  action: string;
  link: string;
};

export type PositivePattern = {
  pattern: string;
  started_date: string;
  improvement: string;
  streak: number;
  message: string;
  encouragement: string;
};
