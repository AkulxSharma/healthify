"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ActivityFeed } from "@/components/social/ActivityFeed";
import { ComparisonView } from "@/components/social/ComparisonView";
import { GroupChallenge } from "@/components/social/GroupChallenge";
import { ProgressShareModal } from "@/components/social/ProgressShareModal";
import { SharedGoalCard } from "@/components/social/SharedGoalCard";
import { SharedGoalCreator } from "@/components/social/SharedGoalCreator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { supabase } from "@/lib/supabaseClient";
import type {
  ChallengeLeaderboardEntry,
  ComparisonPayload,
  GroupChallenge as GroupChallengeType,
  GoalProgressEntry,
  SharedGoal,
} from "@/types/social";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

const getToken = async (): Promise<string> => {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Authorization required");
  }
  return token;
};

export default function SocialPage() {
  const router = useRouter();
  const { user, loading } = useSupabaseSession();
  const [tab, setTab] = useState("goals");
  const [goals, setGoals] = useState<SharedGoal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [goalProgress, setGoalProgress] = useState<Record<string, GoalProgressEntry[]>>({});
  const [challenges, setChallenges] = useState<GroupChallengeType[]>([]);
  const [challengeLeaders, setChallengeLeaders] = useState<
    Record<string, ChallengeLeaderboardEntry[]>
  >({});
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [challengesError, setChallengesError] = useState<string | null>(null);
  const [showCreator, setShowCreator] = useState(true);
  const [shareGoal, setShareGoal] = useState<SharedGoal | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareFriendId, setCompareFriendId] = useState("");
  const [compareStatus, setCompareStatus] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonPayload | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  const loadGoals = async () => {
    setGoalsLoading(true);
    setGoalsError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/social/goals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Unable to load shared goals.");
      }
      const payload = (await res.json()) as SharedGoal[];
      setGoals(payload);
      const progressEntries = await Promise.all(
        payload.map(async (goal) => {
          const progressRes = await fetch(`${API_BASE}/social/goals/${goal.id}/progress`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!progressRes.ok) {
            return { id: goal.id, entries: [] as GoalProgressEntry[] };
          }
          const entries = (await progressRes.json()) as GoalProgressEntry[];
          return { id: goal.id, entries };
        })
      );
      const progressMap: Record<string, GoalProgressEntry[]> = {};
      progressEntries.forEach((entry) => {
        progressMap[entry.id] = entry.entries;
      });
      setGoalProgress(progressMap);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load shared goals.";
      setGoalsError(message);
      setGoals([]);
      setGoalProgress({});
    } finally {
      setGoalsLoading(false);
    }
  };

  const loadChallenges = async () => {
    setChallengesLoading(true);
    setChallengesError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/challenges`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Unable to load challenges.");
      }
      const payload = (await res.json()) as GroupChallengeType[];
      setChallenges(payload);
      const leaderEntries = await Promise.all(
        payload.map(async (challenge) => {
          const leaderRes = await fetch(`${API_BASE}/challenges/${challenge.id}/leaderboard`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!leaderRes.ok) {
            return { id: challenge.id, entries: [] as ChallengeLeaderboardEntry[] };
          }
          const entries = (await leaderRes.json()) as ChallengeLeaderboardEntry[];
          return { id: challenge.id, entries };
        })
      );
      const leaderMap: Record<string, ChallengeLeaderboardEntry[]> = {};
      leaderEntries.forEach((entry) => {
        leaderMap[entry.id] = entry.entries;
      });
      setChallengeLeaders(leaderMap);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load challenges.";
      setChallengesError(message);
      setChallenges([]);
      setChallengeLeaders({});
    } finally {
      setChallengesLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    void loadGoals();
    void loadChallenges();
  }, [user]);

  const statsMessage = useMemo(() => {
    if (!shareGoal || !user) {
      return undefined;
    }
    const entries = goalProgress[shareGoal.id] || [];
    const entry = entries.find((item) => item.user === user.id);
    if (!entry) {
      return `Progress update on ${shareGoal.title}`;
    }
    const progressValue = entry.current;
    if (shareGoal.goal_type === "savings") {
      return `I saved $${progressValue} this week!`;
    }
    return `I reached ${progressValue} of ${shareGoal.target_value} on ${shareGoal.title}`;
  }, [goalProgress, shareGoal, user]);

  const handleJoinChallenge = async (challenge: GroupChallengeType) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/challenges/${challenge.id}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Unable to join challenge.");
      }
      await loadChallenges();
    } catch {
      return;
    }
  };

  const handleCompare = async () => {
    if (!compareFriendId.trim()) {
      setCompareStatus("Enter a friend ID to compare.");
      return;
    }
    setCompareStatus(null);
    try {
      const token = await getToken();
      const res = await fetch(
        `${API_BASE}/social/compare?friend_id=${encodeURIComponent(compareFriendId.trim())}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Unable to compare.");
      }
      const payload = (await res.json()) as ComparisonPayload;
      setComparison(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to compare.";
      setCompareStatus(message);
      setComparison(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-200 px-6 py-10">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Social hub</CardTitle>
            <CardDescription>Share goals, celebrate wins, and compete together.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="goals">Shared Goals</TabsTrigger>
                <TabsTrigger value="challenges">Challenges</TabsTrigger>
                <TabsTrigger value="feed">Feed</TabsTrigger>
              </TabsList>
              <TabsContent value="goals" className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-100">Shared goals</p>
                    <p className="text-sm text-slate-400">Track progress together.</p>
                  </div>
                  <Button type="button" onClick={() => setShowCreator((prev) => !prev)}>
                    {showCreator ? "Hide" : "Create new"}
                  </Button>
                </div>
                {showCreator ? <SharedGoalCreator onCreated={loadGoals} /> : null}
                {goalsLoading ? <p className="text-sm text-slate-300">Loading goals...</p> : null}
                {goalsError ? <p className="text-sm text-rose-300">{goalsError}</p> : null}
                <div className="grid gap-4">
                  {goals.map((goal) => (
                    <SharedGoalCard
                      key={goal.id}
                      goal={goal}
                      progress={goalProgress[goal.id] || []}
                      onShare={setShareGoal}
                    />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="challenges" className="mt-6 space-y-4">
                <div>
                  <p className="text-lg font-semibold text-slate-100">Group challenges</p>
                  <p className="text-sm text-slate-400">Race to the top together.</p>
                </div>
                {challengesLoading ? (
                  <p className="text-sm text-slate-300">Loading challenges...</p>
                ) : null}
                {challengesError ? (
                  <p className="text-sm text-rose-300">{challengesError}</p>
                ) : null}
                <div className="grid gap-4">
                  {challenges.map((challenge) => (
                    <GroupChallenge
                      key={challenge.id}
                      challenge={challenge}
                      leaderboard={challengeLeaders[challenge.id] || []}
                      userId={user?.id}
                      onJoin={handleJoinChallenge}
                    />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="feed" className="mt-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-100">Friend feed</p>
                    <p className="text-sm text-slate-400">Latest progress from your circle.</p>
                  </div>
                  <Button type="button" onClick={() => setCompareOpen(true)}>
                    Compare with friend
                  </Button>
                </div>
                <ActivityFeed />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
      <ProgressShareModal
        open={Boolean(shareGoal)}
        goal={shareGoal}
        statsMessage={statsMessage}
        onClose={() => setShareGoal(null)}
        onPosted={() => {
          setShareGoal(null);
        }}
      />
      {compareOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">Compare with friend</p>
                <p className="text-sm text-slate-400">Paste a friend user ID.</p>
              </div>
              <Button
                type="button"
                className="border border-slate-800 bg-transparent text-slate-200 hover:bg-slate-900"
                onClick={() => {
                  setCompareOpen(false);
                  setCompareStatus(null);
                  setComparison(null);
                }}
              >
                Close
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              <Input
                value={compareFriendId}
                onChange={(event) => setCompareFriendId(event.target.value)}
                placeholder="Friend user ID"
              />
              <Button type="button" onClick={handleCompare}>
                Compare
              </Button>
              {compareStatus ? <p className="text-sm text-rose-300">{compareStatus}</p> : null}
              {comparison ? (
                <ComparisonView myStats={comparison.me} friendStats={comparison.friend} />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
