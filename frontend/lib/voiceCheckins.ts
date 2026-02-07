import { safeFetch } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import type { VoiceCheckin } from "@/types/profile";
import type { VoiceCheckinInsight, VoiceCheckinWithInsight } from "@/types/voice";

const TABLE_NAME = "voice_checkins";
const BUCKET_NAME = "voice-checkins";

type CreateVoiceCheckin = {
  user_id: string;
  storage_path: string;
  duration_seconds: number;
};

const formatTimestamp = (date: Date): string => {
  return date.toISOString().replace(/\.\d{3}Z$/, "");
};

const buildMockInsight = (checkinId: string): VoiceCheckinInsight => ({
  id: `insight-${checkinId}`,
  checkin_id: checkinId,
  created_at: new Date().toISOString(),
  transcript: "Felt energized after a calm morning routine.",
  mood_score: 7,
  stress_score: 4,
  symptoms: ["tension"],
  summary: "Steady mood with manageable stress signals.",
});

const buildMockCheckins = (userId: string, limit: number): VoiceCheckinWithInsight[] => {
  const now = Date.now();
  const base: VoiceCheckinWithInsight[] = [
    {
      id: "checkin-1",
      user_id: userId,
      storage_path: "mock/voice-checkin-1.webm",
      duration_seconds: 92,
      created_at: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      insight: buildMockInsight("checkin-1"),
    },
    {
      id: "checkin-2",
      user_id: userId,
      storage_path: "mock/voice-checkin-2.webm",
      duration_seconds: 76,
      created_at: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
      insight: null,
    },
  ];
  return base.slice(0, limit);
};

export const uploadVoiceCheckin = async (
  userId: string,
  blob: Blob,
  durationSeconds: number
): Promise<VoiceCheckin> => {
  if (!userId) {
    throw new Error("User ID is required");
  }
  const timestamp = formatTimestamp(new Date());
  const path = `${userId}/${timestamp}.webm`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, blob, {
      contentType: blob.type || "audio/webm",
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const payload: CreateVoiceCheckin = {
    user_id: userId,
    storage_path: path,
    duration_seconds: durationSeconds,
  };

  const { data, error } = await supabase.from(TABLE_NAME).insert(payload).select("*").single();

  if (error) {
    throw error;
  }

  return data as VoiceCheckin;
};

export const getLatestVoiceCheckin = async (userId: string): Promise<VoiceCheckin | null> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as VoiceCheckin | null;
};

export const processVoiceCheckin = async (
  checkinId: string
): Promise<VoiceCheckinInsight> => {
  return safeFetch(`/voice-checkins/${checkinId}/process`, buildMockInsight(checkinId), {
    method: "POST",
  });
};

export const getRecentVoiceCheckinsWithInsights = async (
  userId: string,
  limit = 5
): Promise<VoiceCheckinWithInsight[]> => {
  const params = new URLSearchParams();
  params.set("user_id", userId);
  params.set("limit", String(limit));
  return safeFetch(`/voice-checkins/recent?${params.toString()}`, buildMockCheckins(userId, limit));
};
