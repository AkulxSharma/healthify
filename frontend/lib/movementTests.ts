import { supabase } from "@/lib/supabaseClient";
import type {
  MovementPoseMetrics,
  MovementTest,
  MovementTestInsight,
  MovementTestWithInsight,
} from "@/types/movement";

const TABLE_NAME = "movement_tests";
const BUCKET_NAME = "movement-tests";

const formatTimestamp = (date: Date): string => {
  return date.toISOString().replace(/\.\d{3}Z$/, "");
};

export const uploadMovementTest = async (
  userId: string,
  testType: string,
  blob: Blob,
  durationSeconds: number,
  insight: MovementPoseMetrics | null
): Promise<MovementTestWithInsight> => {
  if (!userId) {
    throw new Error("User ID is required");
  }
  if (!testType) {
    throw new Error("Test type is required");
  }

  const timestamp = formatTimestamp(new Date());
  const safeType = testType.toLowerCase().replace(/\s+/g, "-");
  const path = `${userId}/${safeType}-${timestamp}.webm`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, blob, {
      contentType: blob.type || "video/webm",
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const payload = {
    user_id: userId,
    test_type: testType,
    storage_path: path,
    duration_seconds: durationSeconds,
  };

  const { data, error } = await supabase.from(TABLE_NAME).insert(payload).select("*").single();
  if (error) {
    throw error;
  }
  const test = data as MovementTest;

  if (!insight) {
    return { ...test, insight: null };
  }

  const insightPayload = {
    test_id: test.id,
    form_score: insight.form_score,
    symmetry_score: insight.symmetry_score,
    rom_score: insight.rom_score,
    metrics: insight,
  };

  const insightResponse = await supabase
    .from("movement_test_insights")
    .insert(insightPayload)
    .select("*")
    .single();
  if (insightResponse.error) {
    throw insightResponse.error;
  }
  const insightRow = insightResponse.data as MovementTestInsight;
  return { ...test, insight: insightRow };
};

export const getRecentMovementTestsWithInsights = async (
  userId: string,
  limit = 5
): Promise<MovementTestWithInsight[]> => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*, movement_test_insights(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw error;
  }
  const rows = (data ?? []) as Array<
    MovementTest & { movement_test_insights?: MovementTestInsight[] }
  >;
  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    created_at: row.created_at,
    test_type: row.test_type,
    storage_path: row.storage_path,
    duration_seconds: row.duration_seconds,
    insight: row.movement_test_insights?.[0] ?? null,
  }));
};
