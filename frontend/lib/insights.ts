import { safeFetch } from "@/lib/api";
import type {
  CorrelationInsight,
  InsightNotification,
  PositivePattern,
  TriggerInsightResponse,
} from "@/types/insights";

export const getCorrelations = async (days = 30): Promise<CorrelationInsight[]> => {
  const params = new URLSearchParams();
  params.set("days", String(days));
  return safeFetch(`/insights/correlations?${params.toString()}`, [
    {
      pattern: "Late-night snacking",
      frequency: 4,
      impact_metric: "wellness_score",
      impact_value: -6,
      impact_description: "Lower wellness score the next morning",
      confidence: 0.74,
      recommendation: "Aim for a lighter snack after 8pm",
    },
    {
      pattern: "Morning movement",
      frequency: 5,
      impact_metric: "mood_score",
      impact_value: 8,
      impact_description: "Improved mood on active days",
      confidence: 0.68,
      recommendation: "Keep a 20-minute walk in your routine",
    },
  ]);
};

export const getTriggers = async (
  pattern: string,
  days = 30
): Promise<TriggerInsightResponse> => {
  const params = new URLSearchParams();
  params.set("pattern", pattern);
  params.set("days", String(days));
  return safeFetch(`/insights/triggers?${params.toString()}`, {
    negative_pattern: pattern,
    triggers: [
      {
        type: "time",
        value: "After 9pm",
        occurrence_rate: 0.42,
        impact_metric: "wellness_score",
        impact_value: -5,
      },
      {
        type: "mood",
        value: "Stressed",
        occurrence_rate: 0.28,
        impact_metric: "spending_total",
        impact_value: 12,
      },
    ],
    recommendations: [
      "Plan a lighter evening routine",
      "Add a calming 10-minute reset before dinner",
    ],
  });
};

export const getInsightNotifications = async (): Promise<InsightNotification[]> => {
  return safeFetch("/insights/notifications", [
    {
      type: "spending",
      title: "Spending spike detected",
      message: "Dining spend jumped 18% this week.",
      severity: "medium",
      action: "Review dining",
      link: "/spending",
    },
    {
      type: "wellness",
      title: "Consistency win",
      message: "You logged movement 4 days in a row.",
      severity: "low",
      action: "Keep it up",
      link: "/movement",
    },
  ]);
};

export const getPositivePatterns = async (days = 30): Promise<PositivePattern[]> => {
  const params = new URLSearchParams();
  params.set("days", String(days));
  return safeFetch(`/insights/positive-patterns?${params.toString()}`, [
    {
      pattern: "Balanced lunches",
      started_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      improvement: "+12% wellness score",
      streak: 5,
      message: "Balanced meals are boosting your energy.",
      encouragement: "Keep the protein + greens combo.",
    },
  ]);
};
