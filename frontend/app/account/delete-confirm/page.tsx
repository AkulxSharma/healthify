"use client";

import { Suspense, useEffect, useState } from "react";
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

function DeleteConfirmContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useSupabaseSession();
  const token = params.get("token");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  const confirmDeletion = async () => {
    if (!token) {
      setError("Missing confirmation token.");
      return;
    }
    setError(null);
    try {
      setSubmitting(true);
      const authToken = await getToken();
      const response = await fetch(`${API_BASE}/account/delete/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload?.detail || "Unable to confirm deletion.";
        throw new Error(message);
      }
      const payload = (await response.json()) as { scheduled_for?: string };
      const scheduledFor = payload.scheduled_for ?? "";
      const query = scheduledFor ? `?scheduled_for=${encodeURIComponent(scheduledFor)}` : "";
      router.push(`/account/deleted${query}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to confirm deletion.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Confirm account deletion</CardTitle>
            <CardDescription>
              This schedules your account for deletion in 30 days. You can cancel any time before
              then.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {token ? (
              <Button type="button" onClick={confirmDeletion} disabled={submitting}>
                {submitting ? "Confirming..." : "Confirm deletion"}
              </Button>
            ) : (
              <p className="text-sm text-rose-300">Missing confirmation token.</p>
            )}
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function DeleteConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100">
          <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Confirm account deletion</CardTitle>
                <CardDescription>Loading confirmation...</CardDescription>
              </CardHeader>
            </Card>
          </main>
        </div>
      }
    >
      <DeleteConfirmContent />
    </Suspense>
  );
}
