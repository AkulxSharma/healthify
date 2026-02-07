"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { uploadVoiceCheckin } from "@/lib/voiceCheckins";

export default function VoiceCheckinPage() {
  const router = useRouter();
  const { user, loading } = useSupabaseSession();
  const {
    isRecording,
    audioBlob,
    durationSeconds,
    startRecording,
    stopRecording,
    reset,
    supported,
    error: recordError,
  } = useVoiceRecorder();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!audioBlob) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [audioBlob]);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    if (!user) {
      setError("You must be logged in.");
      return;
    }
    if (!audioBlob || durationSeconds === null) {
      setError("Record a check-in before saving.");
      return;
    }
    try {
      setSaving(true);
      await uploadVoiceCheckin(user.id, audioBlob, durationSeconds);
      reset();
      setSuccess("Check-in saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save check-in.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Daily voice check-in</CardTitle>
            <CardDescription>Record 60–90 seconds about how your day went.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!supported ? (
              <p className="text-sm text-rose-300">Your browser does not support audio recording.</p>
            ) : null}
            {recordError ? <p className="text-sm text-rose-300">{recordError}</p> : null}
            <div className="flex flex-wrap gap-3">
              {!isRecording ? (
                <Button type="button" onClick={startRecording} disabled={!supported || saving}>
                  Start recording
                </Button>
              ) : (
                <Button type="button" onClick={stopRecording} disabled={saving}>
                  Stop recording
                </Button>
              )}
              {audioBlob ? (
                <Button type="button" onClick={reset} disabled={saving}>
                  Clear recording
                </Button>
              ) : null}
            </div>
            {audioUrl ? (
              <div className="space-y-3">
                <audio controls src={audioUrl} className="w-full" />
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save check-in"}
                </Button>
              </div>
            ) : null}
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
