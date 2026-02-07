import { safeFetch } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import type { MealAnalysis, SwapAlternative, SwapAcceptResult, SwapPreference } from "@/types/swaps";
import type { Event, EventCategory, EventMetadata, EventScores, EventType } from "@/types/events";

const TABLE_NAME = "events";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

const buildBaseMockEvents = (): Event[] => {
  const now = Date.now();
  return [
    {
      id: "evt-1",
      user_id: "demo-user",
      timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      event_type: "food",
      category: "nutrition",
      title: "Salad bowl",
      amount: 420,
      metadata: { meal_type: "lunch", nutrition_quality_score: 78 },
    },
    {
      id: "evt-2",
      user_id: "demo-user",
      timestamp: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      event_type: "spending",
      category: "finance",
      title: "Grocery run",
      amount: 46.3,
      metadata: { merchant: "FreshMart", category: "Groceries" },
    },
    {
      id: "evt-3",
      user_id: "demo-user",
      timestamp: new Date(now - 9 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now - 9 * 60 * 60 * 1000).toISOString(),
      event_type: "movement",
      category: "fitness",
      title: "Afternoon walk",
      amount: 28,
      metadata: { duration_minutes: 28, steps: 3200 },
    },
    {
      id: "evt-4",
      user_id: "demo-user",
      timestamp: new Date(now - 20 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now - 20 * 60 * 60 * 1000).toISOString(),
      event_type: "sleep",
      category: "health",
      title: "Sleep 7h",
      amount: 7,
      metadata: { quality: "Good" },
    },
    {
      id: "evt-5",
      user_id: "demo-user",
      timestamp: new Date(now - 30 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now - 30 * 60 * 60 * 1000).toISOString(),
      event_type: "social",
      category: "social",
      title: "Coffee catch-up",
      amount: 60,
      metadata: { people: "Friend", duration_minutes: 60 },
    },
  ];
};

const buildMockEvents = (
  types?: EventType[],
  categories?: EventCategory[],
  limit = 50,
  offset = 0
): { events: Event[]; total: number; hasMore: boolean } => {
  const base = buildBaseMockEvents();
  const filtered = base.filter((event) => {
    if (types && types.length > 0 && !types.includes(event.event_type)) {
      return false;
    }
    if (categories && categories.length > 0 && !categories.includes(event.category)) {
      return false;
    }
    return true;
  });
  const paged = filtered.slice(offset, offset + limit);
  return {
    events: paged,
    total: filtered.length,
    hasMore: offset + limit < filtered.length,
  };
};

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

const resolveUserId = async (userId?: string): Promise<string> => {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }
  if (userId) {
    return userId;
  }
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id;
  if (!id) {
    throw new Error("User ID is required");
  }
  return id;
};

const triggerMovementSync = async (): Promise<void> => {
  if (!supabase) {
    return;
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return;
  }
  await fetch(`${API_BASE}/movement/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const logEvent = async (event: Partial<Event>): Promise<Event> => {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }
  if (!event.event_type || !event.category || !event.title) {
    throw new Error("Event type, category, and title are required");
  }
  const userId = await resolveUserId(event.user_id);
  const payload = {
    user_id: userId,
    event_type: event.event_type,
    category: event.category,
    title: event.title,
    timestamp: event.timestamp ?? new Date().toISOString(),
    amount: event.amount ?? null,
    metadata: (event.metadata as EventMetadata | undefined) ?? null,
    scores: (event.scores as EventScores | undefined) ?? null,
  };
  const { data, error } = await supabase.from(TABLE_NAME).insert(payload).select("*").single();
  if (error) {
    throw error;
  }
  if (event.event_type === "movement") {
    try {
      await triggerMovementSync();
    } catch {
      return data as Event;
    }
  }
  return data as Event;
};

export const logSpending = async (
  title: string,
  amount: number,
  merchant?: string,
  category?: string,
  notes?: string
): Promise<Event> => {
  return logEvent({
    event_type: "spending",
    category: "finance",
    title,
    amount,
    metadata: {
      merchant,
      category,
      notes,
    },
  });
};

export const logFood = async (
  title: string,
  calories: number | null,
  ingredients?: string[],
  mealType?: EventMetadata["meal_type"],
  nutritionQualityScore?: number | null,
  sustainabilityScore?: number | null
): Promise<Event> => {
  return logEvent({
    event_type: "food",
    category: "nutrition",
    title,
    amount: calories ?? undefined,
    metadata: {
      ingredients,
      meal_type: mealType,
      nutrition_quality_score: nutritionQualityScore ?? undefined,
      sustainability_score: sustainabilityScore ?? undefined,
    },
    scores: {
      wellness_impact: nutritionQualityScore ?? undefined,
      sustainability_impact: sustainabilityScore ?? undefined,
    },
  });
};

export const logSwapEvent = async (payload: {
  swapId: string;
  swapType: SwapPreference;
  originalData: MealAnalysis;
  alternativeData: SwapAlternative;
  originalEventId?: string | null;
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
      swap_type: payload.swapType,
      original_data: payload.originalData,
      alternative_data: payload.alternativeData,
      original_event_id: payload.originalEventId ?? null,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Unable to log swap event.");
  }
  return (await res.json()) as SwapAcceptResult;
};

export const logMovement = async (
  title: string,
  duration_minutes: number,
  type?: string
): Promise<Event> => {
  return logEvent({
    event_type: "movement",
    category: "fitness",
    title,
    amount: duration_minutes,
    metadata: {
      duration_minutes,
      type,
    },
  });
};

export const logMood = async (score: number, notes?: string): Promise<Event> => {
  return logEvent({
    event_type: "mood",
    category: "health",
    title: `Mood ${score}/10`,
    amount: score,
    metadata: {
      notes,
    },
  });
};

export const logSleep = async (hours: number, quality?: string): Promise<Event> => {
  return logEvent({
    event_type: "sleep",
    category: "health",
    title: `Sleep ${hours}h`,
    amount: hours,
    metadata: {
      quality,
    },
  });
};

export const logSocial = async (
  title: string,
  people?: string,
  duration_minutes?: number
): Promise<Event> => {
  return logEvent({
    event_type: "social",
    category: "social",
    title,
    amount: duration_minutes,
    metadata: {
      people,
      duration_minutes,
    },
  });
};

export const getRecentEvents = async (userId: string, limit = 5): Promise<Event[]> => {
  try {
    if (!supabase) {
      throw new Error("Supabase client is not configured");
    }
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false })
      .limit(limit);
    if (error) {
      throw error;
    }
    return (data ?? []) as Event[];
  } catch {
    return buildBaseMockEvents()
      .map((event) => ({ ...event, user_id: userId }))
      .slice(0, limit);
  }
};

export const getEventsByDateRange = async (
  startDate: string,
  endDate: string,
  types?: EventType[],
  categories?: EventCategory[],
  limit = 50,
  offset = 0
): Promise<{ events: Event[]; total: number; hasMore: boolean }> => {
  const params = new URLSearchParams();
  params.set("start_date", startDate);
  params.set("end_date", endDate);
  if (types && types.length > 0) {
    params.set("types", types.join(","));
  }
  if (categories && categories.length > 0) {
    params.set("categories", categories.join(","));
  }
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  const mock = buildMockEvents(types, categories, limit, offset);
  const payload = await safeFetch<{ events: Event[]; total: number; has_more: boolean }>(
    `/events?${params.toString()}`,
    { events: mock.events, total: mock.total, has_more: mock.hasMore }
  );
  return {
    events: payload.events ?? [],
    total: payload.total ?? 0,
    hasMore: payload.has_more ?? false,
  };
};

export const logEventWithUser = async (
  userId: string,
  eventType: EventType,
  category: EventCategory,
  title: string,
  metadata?: EventMetadata,
  amount?: number,
  timestamp?: string
): Promise<Event> => {
  return logEvent({
    user_id: userId,
    event_type: eventType,
    category,
    title,
    amount,
    timestamp,
    metadata,
  });
};

export const explainEventScores = (event: Event): string => {
  const explanations = event.scores?.explanations;
  if (explanations) {
    const parts = [
      explanations.wellness ? `Wellness: ${explanations.wellness}` : "",
      explanations.cost ? `Cost: ${explanations.cost}` : "",
      explanations.sustainability ? `Sustainability: ${explanations.sustainability}` : "",
    ].filter(Boolean);
    return parts.join(" | ");
  }
  const meta = event.metadata ?? {};
  const parts: string[] = [];
  if (event.event_type === "food") {
    const quality = meta.nutrition_quality_score;
    if (quality !== undefined) {
      parts.push(`Nutrition quality ${quality}`);
    }
    if (meta.ingredients?.length) {
      parts.push(`Ingredients: ${meta.ingredients.slice(0, 4).join(", ")}`);
    }
  }
  if (event.event_type === "movement" && meta.duration_minutes) {
    parts.push(`Movement ${meta.duration_minutes} min`);
  }
  if (event.event_type === "sleep" && event.amount) {
    parts.push(`Sleep ${event.amount}h`);
  }
  if (event.event_type === "spending" && event.amount) {
    parts.push(`Spent $${Number(event.amount).toFixed(2)}`);
  }
  if (!parts.length) {
    return "No score explanation available.";
  }
  return parts.join(" | ");
};
