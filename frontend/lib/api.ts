const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

const getToken = async (): Promise<string | null> => {
  try {
    const { supabase } = await import("./supabaseClient");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (token) {
      return token;
    }
  } catch {}
  try {
    const local = typeof window !== "undefined" ? window.localStorage.getItem("auth_token") : null;
    return local;
  } catch {
    return null;
  }
};

export async function safeFetch<T>(endpoint: string, mockData: T, init?: RequestInit): Promise<T> {
  try {
    const token = await getToken();
    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}${endpoint}`, { ...init, headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } catch {
    console.warn(`API call failed: ${endpoint}, using mock data`);
    return mockData;
  }
}

export async function getDashboardStats(): Promise<{
  spending: { value: number; change: number; trend: "up" | "down" | "neutral" };
  steps: { value: number; change: number; trend: "up" | "down" | "neutral" };
  meals: { value: number; change: number; trend: "up" | "down" | "neutral" };
  workouts: { value: number; change: number; trend: "up" | "down" | "neutral" };
  wellness: { value: number; change: number; trend: "up" | "down" | "neutral" };
  swaps: { value: number; change: number; trend: "up" | "down" | "neutral" };
  savings: { value: number; change: number; trend: "up" | "down" | "neutral" };
}> {
  return safeFetch("/dashboard/stats", {
    spending: { value: 42.3, change: -15, trend: "down" },
    steps: { value: 6250, change: 1320, trend: "up" },
    meals: { value: 3, change: 0, trend: "neutral" },
    workouts: { value: 2, change: 1, trend: "up" },
    wellness: { value: 78, change: 5, trend: "up" },
    swaps: { value: 3, change: 2, trend: "up" },
    savings: { value: 67.2, change: 24.5, trend: "up" },
  });
}

export async function getWalletOutlook(): Promise<{
  current: number;
  projected: number;
  projection: number[];
}> {
  return safeFetch("/dashboard/wallet", {
    current: 1247.8,
    projected: 2147.8,
    projection: [1247.8, 1527.8, 1767.8, 1977.8, 2147.8],
  });
}

export async function getWellnessLift(): Promise<{
  current: number;
  projected: number;
  projection: number[];
}> {
  return safeFetch("/dashboard/wellness", {
    current: 78,
    projected: 83,
    projection: [78, 79, 80, 81, 82, 83],
  });
}

export async function getRecentActivity(): Promise<
  Array<{ id: number; icon: string; title: string; desc: string; time: string }>
> {
  return safeFetch("/events/recent", [
    { id: 1, icon: "🍽️", title: "Logged lunch", desc: "Grilled chicken salad", time: "2h ago" },
    { id: 2, icon: "👟", title: "Morning run", desc: "5.2 km completed", time: "5h ago" },
    { id: 3, icon: "💰", title: "Grocery shopping", desc: "$45.30", time: "Yesterday" },
    { id: 4, icon: "💧", title: "Hydration goal", desc: "8/8 glasses", time: "Yesterday" },
  ]);
}

export async function getAlerts(): Promise<
  Array<{ id: number; title: string; message: string; time: string; read: boolean }>
> {
  return safeFetch("/alerts", [
    { id: 1, title: "Goal milestone reached", message: "You saved $50!", time: "1h ago", read: false },
  ]);
}
