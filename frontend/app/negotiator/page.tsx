"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { HabitNegotiator } from "@/components/negotiator/HabitNegotiator";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

export default function NegotiatorPage() {
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
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <div className="space-y-2">
          <p className="text-sm text-slate-400">AI Coach</p>
          <h1 className="text-2xl font-semibold text-slate-100">Ask Your AI Coach</h1>
          <p className="text-sm text-slate-400">
            Get a quick cost, health, and sustainability breakdown plus a recommended alternative.
          </p>
        </div>
        <HabitNegotiator userId={user.id} />
      </main>
    </div>
  );
}
