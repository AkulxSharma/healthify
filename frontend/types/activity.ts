export type ActivityType = "focus_session" | "break" | "late_night_usage";

export interface ActivityLog {
  id: string;
  user_id: string;
  created_at: string;
  activity_type: ActivityType;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  metadata?: Record<string, unknown>;
}
