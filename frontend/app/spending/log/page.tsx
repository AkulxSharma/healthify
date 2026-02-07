"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ReceiptScanner } from "@/components/ReceiptScanner";
import { SpendingLogger } from "@/components/SpendingLogger";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import type { Event } from "@/types/events";

type SpendingPrefill = {
  amount?: number | null;
  merchant?: string | null;
  category?: "Food" | "Transport" | "Shopping" | "Entertainment" | "Health" | "Other" | null;
  notes?: string | null;
};

export default function SpendingLogPage() {
  const router = useRouter();
  const { user, loading } = useSupabaseSession();
  const [tab, setTab] = useState("manual");
  const [prefill, setPrefill] = useState<SpendingPrefill | null>(null);
  const [loggedEvent, setLoggedEvent] = useState<Event | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  const handleLogged = (event: Event) => {
    setLoggedEvent(event);
  };

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
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-6 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Log spending</CardTitle>
            <CardDescription>Capture purchases manually or scan a receipt.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loggedEvent ? (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                Logged {loggedEvent.title} for ${loggedEvent.amount?.toFixed(2) ?? "0.00"}.
              </div>
            ) : null}
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="manual">Manual entry</TabsTrigger>
                <TabsTrigger value="scan">Scan receipt</TabsTrigger>
              </TabsList>
              <TabsContent value="manual">
                <SpendingLogger prefill={prefill} onLogged={handleLogged} />
              </TabsContent>
              <TabsContent value="scan">
                <ReceiptScanner
                  onPrefill={(data) => {
                    setPrefill(data);
                    setTab("manual");
                  }}
                />
              </TabsContent>
            </Tabs>
            {loggedEvent ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  onClick={() => {
                    setLoggedEvent(null);
                    setPrefill(null);
                  }}
                  className="flex-1"
                >
                  Log another
                </Button>
                <Button type="button" onClick={() => router.push("/timeline")} className="flex-1">
                  View all spending
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
