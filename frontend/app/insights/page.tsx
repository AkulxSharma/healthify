"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { CorrelationsPanel } from "@/components/insights/CorrelationsPanel";
import { TriggersPanel } from "@/components/insights/TriggersPanel";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

export default function InsightsPage() {
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
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="space-y-2">
          <p className="text-sm text-slate-400">Insights</p>
          <h1 className="text-2xl font-semibold text-slate-100">Your Patterns & Triggers</h1>
        </div>
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">What’s affecting your life</h2>
          <CorrelationsPanel />
        </section>
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Find your triggers</h2>
          <TriggersPanel />
        </section>
      </main>
    </div>
  );
}
