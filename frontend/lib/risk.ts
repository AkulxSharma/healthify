import { safeFetch } from "@/lib/api";
import type {
  BurnoutRisk,
  FinancialRisk,
  InjuryRisk,
  IsolationRisk,
  RiskHistoryPoint,
} from "@/types/risk";

const buildRisk = (days: number, base: number, label: string): BurnoutRisk => ({
  days,
  risk: base,
  level: base > 70 ? "high" : base > 45 ? "medium" : "low",
  factors: [
    { name: "Recovery balance", impact: -6, details: "Limited rest over the past week" },
    { name: "Consistency", impact: 4, details: "Routine activity keeps stability" },
  ],
  recommendations: [`Adjust ${label} load with a lighter day`, "Add a 20-minute recovery block"],
});

const buildRiskHistory = (days: number): RiskHistoryPoint[] => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date: date.toISOString(),
      burnout_risk: 55 + index,
      injury_risk: 48 + index * 0.8,
      isolation_risk: 42 + index * 0.6,
      financial_risk: 50 + index * 0.7,
    };
  });
};

export const getBurnoutRisk = async (days = 7): Promise<BurnoutRisk> => {
  const params = new URLSearchParams();
  params.set("days", String(days));
  return safeFetch(`/risk/burnout?${params.toString()}`, buildRisk(days, 62, "burnout"));
};

export const getInjuryRisk = async (days = 7): Promise<InjuryRisk> => {
  const params = new URLSearchParams();
  params.set("days", String(days));
  return safeFetch(`/risk/injury?${params.toString()}`, buildRisk(days, 58, "injury"));
};

export const getIsolationRisk = async (days = 7): Promise<IsolationRisk> => {
  const params = new URLSearchParams();
  params.set("days", String(days));
  return safeFetch(`/risk/isolation?${params.toString()}`, buildRisk(days, 46, "connection"));
};

export const getFinancialRisk = async (days = 30): Promise<FinancialRisk> => {
  const params = new URLSearchParams();
  params.set("days", String(days));
  return safeFetch(`/risk/financial?${params.toString()}`, buildRisk(days, 52, "spending"));
};

export const getRiskHistory = async (
  days = 30,
  types: string[] = ["burnout", "injury", "isolation", "financial"]
): Promise<RiskHistoryPoint[]> => {
  const params = new URLSearchParams();
  params.set("days", String(days));
  if (types.length > 0) {
    params.set("types", types.join(","));
  }
  return safeFetch(`/risk/history?${params.toString()}`, buildRiskHistory(days));
};
