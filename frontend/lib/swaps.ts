import { safeFetch } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import type {
  MealAnalysis,
  SwapAcceptResult,
  SwapFeedbackSummary,
  SwapHistoryItem,
  SwapPreference,
  SwapRejectionReason,
  SwapSuggestion,
} from "@/types/swaps";

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

export const analyzeMealPhoto = async (file: File): Promise<MealAnalysis> => {
  const token = await getToken();
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${API_BASE}/swaps/analyze-meal`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Analysis failed.");
  }
  return (await res.json()) as MealAnalysis;
};

export const suggestSwap = async (mealData: MealAnalysis): Promise<SwapSuggestion> => {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/swaps/suggest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ meal_data: mealData }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Unable to suggest swap.");
  }
  return (await res.json()) as SwapSuggestion;
};

export const acceptSwap = async (payload: {
  swapId: string;
  originalEventId?: string | null;
  swapType: SwapPreference;
  originalData: MealAnalysis;
  alternativeData: SwapSuggestion["healthier"];
}): Promise<SwapAcceptResult> => {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/swaps/accept`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      swap_id: payload.swapId,
      original_event_id: payload.originalEventId,
      swap_type: payload.swapType,
      original_data: payload.originalData,
      alternative_data: payload.alternativeData,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Unable to accept swap.");
  }
  return (await res.json()) as SwapAcceptResult;
};

export const rejectSwap = async (payload: {
  swapId?: string;
  originalMeal: MealAnalysis;
  alternative: SwapSuggestion["healthier"];
  swapType: SwapPreference;
  reason: SwapRejectionReason;
  customReason?: string;
  wouldTryModified?: boolean;
}): Promise<{ id: string; message: string }> => {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/swaps/reject`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      swap_id: payload.swapId,
      original_meal: payload.originalMeal,
      alternative: payload.alternative,
      swap_type: payload.swapType,
      reason: payload.reason,
      custom_reason: payload.customReason,
      would_try_modified: payload.wouldTryModified ?? false,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Unable to submit feedback.");
  }
  return (await res.json()) as { id: string; message: string };
};

export const getSwapHistory = async (days = 30): Promise<SwapHistoryItem[]> => {
  const params = new URLSearchParams();
  params.set("days", String(days));
  return safeFetch(`/swaps/history?${params.toString()}`, []);
};

export const getSwapFeedbackSummary = async (days = 60): Promise<SwapFeedbackSummary> => {
  const token = await getToken();
  const params = new URLSearchParams();
  params.set("days", String(days));
  const res = await fetch(`${API_BASE}/swaps/feedback-summary?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Unable to load swap feedback.");
  }
  return (await res.json()) as SwapFeedbackSummary;
};
