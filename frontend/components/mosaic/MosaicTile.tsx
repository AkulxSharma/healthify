"use client";

import type { LucideIcon } from "lucide-react";
import { Dumbbell, HeartPulse, Moon, Pill, Smile, Timer, Users, Utensils } from "lucide-react";

import type { MosaicTile as MosaicTileType } from "@/types/mosaic";

type MosaicTileProps = {
  tile: MosaicTileType;
};

const iconMap: Record<MosaicTileType["key"], LucideIcon> = {
  sleep: Moon,
  movement: Dumbbell,
  focus: Timer,
  social: Users,
  nutrition: Utensils,
  meds: Pill,
  selfcare: HeartPulse,
  mood: Smile,
};

const colorMap: Record<MosaicTileType["color"], string> = {
  green: "bg-emerald-500/20 border-emerald-400 text-emerald-100",
  yellow: "bg-amber-500/20 border-amber-400 text-amber-100",
  red: "bg-rose-500/20 border-rose-400 text-rose-100",
};

export function MosaicTile({ tile }: MosaicTileProps) {
  const Icon = iconMap[tile.key];
  const colorClass = colorMap[tile.color];
  return (
    <div
      className={`flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-2xl border ${colorClass}`}
      title={`${tile.name}: ${tile.score} — ${tile.detail}`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-[10px] font-medium">{tile.name}</span>
    </div>
  );
}
