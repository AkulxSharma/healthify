"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { supabase } from "@/lib/supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

const getToken = async (): Promise<string> => {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Unable to authenticate.");
  }
  return data.session.access_token;
};

function DeletedAccountContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useSupabaseSession();
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const scheduledFor = params.get("scheduled_for");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  const daysRemaining = useMemo(() => {
    if (!scheduledFor) {
      return 30;
    }
    const target = new Date(scheduledFor);
    const diffMs = target.getTime() - Date.now();
    if (Number.isNaN(diffMs)) {
      return 30;
    }
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [scheduledFor]);

  const handleRestore = async () => {
    setError(null);
    setSuccess(null);
    try {
      setRestoring(true);
      const token = await getToken();
      const response = await fetch(`${API_BASE}/account/delete/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload?.detail || "Unable to restore account.";
        throw new Error(message);
      }
      setSuccess("Account restored.");
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to restore account.";
      setError(message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Account scheduled for deletion</CardTitle>
            <CardDescription>
              Your account will be deleted in {daysRemaining} days unless you restore it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" onClick={handleRestore} disabled={restoring}>
              {restoring ? "Restoring..." : "Restore account"}
            </Button>
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function DeletedAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100">
          <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Account scheduled for deletion</CardTitle>
                <CardDescription>Loading account details...</CardDescription>
              </CardHeader>
            </Card>
          </main>
        </div>
      }
    >
      <DeletedAccountContent />
    </Suspense>
  );
}
