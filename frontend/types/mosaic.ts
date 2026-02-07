export type MosaicTileKey =
  | "sleep"
  | "movement"
  | "focus"
  | "social"
  | "nutrition"
  | "meds"
  | "selfcare"
  | "mood";

export type MosaicTileColor = "green" | "yellow" | "red";

export interface MosaicTile {
  key: MosaicTileKey;
  name: string;
  score: number;
  color: MosaicTileColor;
  detail: string;
}

export interface DailyMosaic {
  date: string;
  overall_score: number;
  story: string;
  tiles: MosaicTile[];
}
