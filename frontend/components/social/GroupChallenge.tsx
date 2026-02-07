"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChallengeLeaderboardEntry, GroupChallenge } from "@/types/social";

type GroupChallengeProps = {
  challenge: GroupChallenge;
  leaderboard: ChallengeLeaderboardEntry[];
  userId?: string | null;
  onJoin?: (challenge: GroupChallenge) => void;
};

const typeStyles: Record<GroupChallenge["challenge_type"], string> = {
  savings: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  wellness: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
  sustainability: "border-sky-500/40 bg-sky-500/10 text-sky-100",
  habit: "border-violet-500/40 bg-violet-500/10 text-violet-100",
};

const medals = ["🥇", "🥈", "🥉"];

export function GroupChallenge({ challenge, leaderboard, userId, onJoin }: GroupChallengeProps) {
  const userRank = useMemo(() => {
    if (!userId) {
      return null;
    }
    const entry = leaderboard.find((item) => item.user === userId);
    return entry ? entry.rank : null;
  }, [leaderboard, userId]);

  const joined = useMemo(() => {
    if (!userId) {
      return false;
    }
    return challenge.participants.includes(userId);
  }, [challenge.participants, userId]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>{challenge.title}</CardTitle>
          <CardDescription>
            {new Date(challenge.start_date).toLocaleDateString()} -{" "}
            {new Date(challenge.end_date).toLocaleDateString()}
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-xs ${typeStyles[challenge.challenge_type]}`}
          >
            {challenge.challenge_type}
          </span>
          {joined ? null : (
            <Button type="button" onClick={() => onJoin?.(challenge)} className="h-8 px-3 text-xs">
              Join challenge
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-slate-200">
        <div className="space-y-2">
          {leaderboard.length === 0 ? (
            <p className="text-sm text-slate-400">No leaderboard entries yet.</p>
          ) : (
            leaderboard.map((entry, index) => (
              <div
                key={`${entry.user}-${entry.rank}`}
                className={`flex items-center justify-between rounded-2xl border border-slate-800 px-4 py-3 ${
                  index < 3 ? "bg-slate-900/60" : "bg-slate-950/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{medals[index] ?? `#${entry.rank}`}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {entry.user.slice(0, 8)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {entry.achievements.length} achievements
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{entry.score}</p>
                  <p className="text-xs text-slate-400">Score</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">
            My rank: {userRank ? `#${userRank}` : "Unranked"}
          </span>
          {challenge.prize ? (
            <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs text-slate-200">
              Prize: {challenge.prize}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
