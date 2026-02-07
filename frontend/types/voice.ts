export type VoiceCheckinInsight = {
  id: string;
  checkin_id: string;
  created_at: string;
  transcript: string;
  mood_score: number;
  stress_score: number;
  symptoms: string[];
  summary: string;
};

export type VoiceCheckinWithInsight = {
  id: string;
  user_id: string;
  storage_path: string;
  duration_seconds: number;
  created_at: string;
  insight: VoiceCheckinInsight | null;
};
