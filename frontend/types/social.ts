export type GoalType = "savings" | "wellness" | "sustainability" | "habit";

export type ChallengeType = "savings" | "wellness" | "sustainability" | "habit";

export type SharedGoal = {
  id: string;
  creator_id: string;
  title: string;
  description?: string | null;
  goal_type: GoalType;
  target_value: number;
  target_date?: string | null;
  participants: string[];
  created_at: string;
};

export type GoalParticipant = {
  id: string;
  goal_id: string;
  user_id: string;
  joined_at: string;
  current_progress: number;
  last_updated: string;
};

export type GoalProgressEntry = {
  user: string;
  current: number;
  target: number;
  pct: number;
  last_update?: string | null;
};

export type SharedGoalCreatePayload = {
  title: string;
  description?: string | null;
  goal_type: GoalType;
  target_value: number;
  target_date?: string | null;
  invite_users: string[];
};

export type ShareProgressPayload = {
  goal_id?: string | null;
  achievement: string;
  message?: string | null;
  image?: string | null;
};

export type SocialFeedEntry = {
  id: string;
  user_id: string;
  created_at: string;
  achievement: string;
  message?: string | null;
  image?: string | null;
  goal_id?: string | null;
};

export type GroupChallenge = {
  id: string;
  title: string;
  challenge_type: ChallengeType;
  start_date: string;
  end_date: string;
  participants: string[];
  leaderboard: Array<{ user: string; score: number; achievements: string[] }>;
  prize?: string | null;
  status: string;
};

export type ChallengeCreatePayload = {
  title: string;
  type: ChallengeType;
  start: string;
  end: string;
  participants: string[];
  prize?: string | null;
};

export type ChallengeLeaderboardEntry = {
  rank: number;
  user: string;
  score: number;
  achievements: string[];
};

export type ActivityType = "goal_completed" | "milestone" | "swap_accepted" | "streak";

export type ActivityFeedEntry = {
  user: string;
  activity_type: ActivityType;
  title: string;
  description?: string | null;
  timestamp: string;
  reactions: Record<string, number>;
};

export type ComparisonStats = {
  savings: number;
  wellness: number;
  sustainability: number;
};

export type ComparisonPayload = {
  me: ComparisonStats;
  friend: ComparisonStats;
  differences: ComparisonStats;
};
