export type MovementTest = {
  id: string;
  user_id: string;
  created_at: string;
  test_type: string;
  storage_path: string;
  duration_seconds: number;
};

export type MovementPoseMetrics = {
  form_score: number;
  symmetry_score: number;
  rom_score: number;
  frame_count: number;
};

export type MovementTestInsight = {
  id: string;
  test_id: string;
  created_at: string;
  form_score: number;
  symmetry_score: number;
  rom_score: number;
  metrics: MovementPoseMetrics;
};

export type MovementTestWithInsight = MovementTest & {
  insight: MovementTestInsight | null;
};
