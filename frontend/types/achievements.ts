export type BadgeType =
  | "savings_master"
  | "wellness_warrior"
  | "eco_champion"
  | "streak_king"
  | "swap_expert";

export type BadgeProgress = {
  badge_type: BadgeType;
  badge_name: string;
  earned_at?: string | null;
  progress_current: number;
  progress_target: number;
};
