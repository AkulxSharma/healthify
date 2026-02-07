import { supabase } from "@/lib/supabaseClient";
import type { NotificationSettings, TileKey, UserSettings, WeeklyGoals } from "@/types/profile";

const TABLE_NAME = "user_settings";

type SettingsPayload = {
  user_id: string;
  active_tiles?: TileKey[];
  weekly_goals?: WeeklyGoals;
  notifications?: NotificationSettings;
};

export const getUserSettings = async (userId: string): Promise<UserSettings | null> => {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as UserSettings | null;
};

export const upsertUserSettings = async (
  userId: string,
  settings: Partial<UserSettings>
): Promise<UserSettings> => {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }
  const payload: SettingsPayload = { user_id: userId };

  if (settings.active_tiles !== undefined) {
    payload.active_tiles = settings.active_tiles;
  }
  if (settings.weekly_goals !== undefined) {
    payload.weekly_goals = settings.weekly_goals;
  }
  if (settings.notifications !== undefined) {
    payload.notifications = settings.notifications;
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as UserSettings;
};
