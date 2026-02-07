"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { APIKeysManager } from "@/components/settings/APIKeysManager";
import { BankConnect } from "@/components/settings/BankConnect";
import { CalendarConnect } from "@/components/settings/CalendarConnect";
import { WebhookManager } from "@/components/settings/WebhookManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

export default function IntegrationsSettingsPage() {
  const router = useRouter();
  const { user, loading } = useSupabaseSession();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-200">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-200">Redirecting...</div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Integrations & developer tools</CardTitle>
            <CardDescription>
              Connect external services, manage API keys, and configure webhooks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <section className="rounded-2xl border border-slate-800 bg-slate-950/50 px-6 py-6">
              <CalendarConnect />
            </section>
            <section className="rounded-2xl border border-slate-800 bg-slate-950/50 px-6 py-6">
              <BankConnect />
            </section>
            <section className="rounded-2xl border border-slate-800 bg-slate-950/50 px-6 py-6">
              <APIKeysManager />
            </section>
            <section className="rounded-2xl border border-slate-800 bg-slate-950/50 px-6 py-6">
              <WebhookManager />
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
