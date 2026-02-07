import { supabase } from "@/lib/supabaseClient";
import type { ProfileType, UserProfile } from "@/types/profile";

const TABLE_NAME = "profiles";

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
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

  return data as UserProfile | null;
};

export const upsertUserProfile = async (
  userId: string,
  profileTypes: ProfileType[]
): Promise<UserProfile> => {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .upsert({ user_id: userId, profile_types: profileTypes }, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as UserProfile;
};
