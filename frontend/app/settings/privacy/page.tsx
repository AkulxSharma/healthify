"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AccountDeletion } from "@/components/settings/AccountDeletion";
import { DataExport } from "@/components/settings/DataExport";
import { PrivacyControls } from "@/components/settings/PrivacyControls";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";

export default function PrivacySettingsPage() {
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
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Privacy & account</CardTitle>
            <CardDescription>Manage who can see your data and export or delete it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="privacy">
              <TabsList>
                <TabsTrigger value="privacy">Privacy controls</TabsTrigger>
                <TabsTrigger value="export">Export data</TabsTrigger>
                <TabsTrigger value="delete">Delete account</TabsTrigger>
              </TabsList>
              <TabsContent value="privacy">
                <PrivacyControls />
              </TabsContent>
              <TabsContent value="export">
                <DataExport />
              </TabsContent>
              <TabsContent value="delete">
                <AccountDeletion />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
