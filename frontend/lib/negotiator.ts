import { supabase } from "@/lib/supabaseClient";
import type {
  CostImpact,
  DecisionHistoryEntry,
  DecisionLogPayload,
  HealthImpact,
  NegotiatorAlternative,
  NegotiatorResponse,
  SustainabilityImpact,
} from "@/types/negotiator";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

const getToken = async (): Promise<string> => {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Authorization required");
  }
  return token;
};

export const askNegotiator = async (
  query: string,
  context?: Record<string, unknown>
): Promise<NegotiatorResponse> => {
  const res = await fetch("/api/negotiator/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, context }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as NegotiatorResponse;
};

export const getRecentDecisions = async (limit = 5): Promise<DecisionHistoryEntry[]> => {
  return getDecisionHistory(limit, 0);
};

export const analyzeItem = async (
  item: string,
  price?: number,
  context?: Record<string, unknown>
): Promise<{
  cost_impact: CostImpact;
  health_impact: HealthImpact;
  sustainability_impact: SustainabilityImpact;
  alternative: NegotiatorAlternative;
}> => {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/negotiator/analyze`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ item, price, context }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Unable to analyze item.");
  }
  return (await res.json()) as {
    cost_impact: CostImpact;
    health_impact: HealthImpact;
    sustainability_impact: SustainabilityImpact;
    alternative: NegotiatorAlternative;
  };
};

export const logDecisionRemote = async (payload: DecisionLogPayload): Promise<{ id: string; message: string }> => {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/negotiator/log-decision`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Unable to log decision.");
  }
  return (await res.json()) as { id: string; message: string };
};

export const getDecisionHistory = async (
  limit = 20,
  offset = 0
): Promise<DecisionHistoryEntry[]> => {
  const token = await getToken();
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  const res = await fetch(`${API_BASE}/negotiator/history?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Unable to load decision history.");
  }
  return (await res.json()) as DecisionHistoryEntry[];
};
