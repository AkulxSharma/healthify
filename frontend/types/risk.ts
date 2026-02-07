export type BurnoutRiskLevel = "low" | "medium" | "high";

export type BurnoutFactor = {
  name: string;
  impact: number;
  details: string;
};

export type BurnoutRisk = {
  days: number;
  risk: number;
  level: BurnoutRiskLevel;
  factors: BurnoutFactor[];
  recommendations: string[];
};

export type InjuryRisk = BurnoutRisk;
export type IsolationRisk = BurnoutRisk;
export type FinancialRisk = BurnoutRisk;

export type RiskType = "burnout" | "injury" | "isolation" | "financial";

export type RiskHistoryPoint = {
  date: string;
  burnout_risk?: number | null;
  injury_risk?: number | null;
  isolation_risk?: number | null;
  financial_risk?: number | null;
};
