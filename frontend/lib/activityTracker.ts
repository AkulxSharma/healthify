import { supabase } from "@/lib/supabaseClient";
import type { ActivityLog } from "@/types/activity";

const TABLE_NAME = "activity_logs";
const STORAGE_KEY = "lifemosaic.focus_session";

type FocusSessionState = {
  startTime: string;
  lastActive: string;
};

const getStoredSession = (): FocusSessionState | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as FocusSessionState;
    if (!parsed.startTime || !parsed.lastActive) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const setStoredSession = (state: FocusSessionState | null) => {
  if (typeof window === "undefined") {
    return;
  }
  if (!state) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const startFocusSession = (): void => {
  const now = new Date().toISOString();
  setStoredSession({ startTime: now, lastActive: now });
};

export const getActiveFocusSession = (): FocusSessionState | null => {
  return getStoredSession();
};

export const recordFocusSessionActivity = (): void => {
  const existing = getStoredSession();
  if (!existing) {
    return;
  }
  const now = new Date().toISOString();
  setStoredSession({ ...existing, lastActive: now });
};

export const isFocusSessionIdle = (idleMinutes = 5): boolean => {
  const existing = getStoredSession();
  if (!existing) {
    return false;
  }
  const lastActiveMs = new Date(existing.lastActive).getTime();
  if (Number.isNaN(lastActiveMs)) {
    return false;
  }
  return Date.now() - lastActiveMs >= idleMinutes * 60 * 1000;
};

export const endFocusSession = async (): Promise<void> => {
  const existing = getStoredSession();
  if (!existing) {
    return;
  }
  setStoredSession(null);

  if (!supabase) {
    return;
  }

  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) {
    return;
  }

  const endTime = new Date();
  const startTime = new Date(existing.startTime);
  const durationMinutes = Math.max(
    1,
    Math.round((endTime.getTime() - startTime.getTime()) / 60000)
  );

  const payload = {
    user_id: userId,
    activity_type: "focus_session",
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    duration_minutes: durationMinutes,
    metadata: null,
  };

  const { error } = await supabase.from(TABLE_NAME).insert(payload);
  if (error) {
    throw error;
  }
};

export const getLatestFocusSession = async (userId: string): Promise<ActivityLog | null> => {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("user_id", userId)
    .eq("activity_type", "focus_session")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as ActivityLog | null;
};
