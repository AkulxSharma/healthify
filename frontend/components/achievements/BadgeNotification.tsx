"use client";

import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";

import type { BadgeProgress } from "@/types/achievements";

type BadgeNotificationProps = {
  badge: BadgeProgress | null;
  open: boolean;
  onClose: () => void;
};

export function BadgeNotification({ badge, open, onClose }: BadgeNotificationProps) {
  const [confetti, setConfetti] = useState<
    Array<{ id: number; left: number; delay: number; duration: number; size: number }>
  >([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setConfetti(
      Array.from({ length: 18 }).map((_, index) => ({
        id: index,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.6 + Math.random() * 1.2,
        size: 6 + Math.random() * 6,
      }))
    );
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose, open]);

  if (!open || !badge) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-slate-950 px-4 py-3 text-slate-100 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20">
            <PartyPopper className="h-5 w-5 text-emerald-200" />
          </div>
          <div>
            <p className="text-sm font-semibold">{badge.badge_name}</p>
            <p className="text-xs text-emerald-200">Achievement unlocked! 🎉</p>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0">
          {confetti.map((piece) => (
            <span
              key={piece.id}
              className="confetti-piece"
              style={{
                left: `${piece.left}%`,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
                width: `${piece.size}px`,
                height: `${piece.size * 0.5}px`,
              }}
            />
          ))}
        </div>
      </div>
      <style jsx>{`
        .confetti-piece {
          position: absolute;
          top: -10px;
          background: linear-gradient(135deg, #34d399, #60a5fa);
          opacity: 0.9;
          border-radius: 9999px;
          animation-name: confetti-fall;
          animation-timing-function: ease-in;
        }
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(140px) rotate(220deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
