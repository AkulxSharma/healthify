"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { MovementHistoryChart } from "@/components/MovementHistoryChart";
import { MovementTracker } from "@/components/MovementTracker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

export default function MovementPage() {
  const router = useRouter();
  const { user, loading } = useSupabaseSession();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-200 px-6 py-10">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 px-6 py-10">Redirecting...</div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-start px-6 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Movement</CardTitle>
            <CardDescription>Log movement and review progress.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <MovementTracker />
            <MovementHistoryChart />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
