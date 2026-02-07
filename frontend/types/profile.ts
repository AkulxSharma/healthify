export type ProfileType = "Student" | "Worker" | "Athlete" | "Caregiver" | "Recovery" | "General";

export type TileKey =
  | "sleep"
  | "movement"
  | "focus"
  | "social"
  | "nutrition"
  | "medsRehab"
  | "selfCare"
  | "mood";

export type WeeklyGoals = {
  sleepHours: number;
  workoutsPerWeek: number;
  socialEventsPerWeek: number;
};

export type NotificationSettings = {
  dailyReminder: boolean;
  riskAlerts: boolean;
  focusTracking: boolean;
};

export type UserProfile = {
  id: string;
  user_id: string;
  profile_types: ProfileType[];
  created_at: string;
  updated_at: string;
};

export type UserSettings = {
  id: string;
  user_id: string;
  active_tiles: TileKey[];
  weekly_goals: WeeklyGoals;
  notifications: NotificationSettings;
  created_at: string;
  updated_at: string;
};

export type VoiceCheckin = {
  id: string;
  user_id: string;
  storage_path: string;
  duration_seconds: number;
  created_at: string;
};
