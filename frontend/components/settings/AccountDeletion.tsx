"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { supabase } from "@/lib/supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";
const CONFIRMATION_PHRASE = "DELETE MY ACCOUNT";

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

export const AccountDeletion = () => {
  const { user } = useSupabaseSession();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
    setSuccess(null);
    try {
      setLoading(true);
      const token = await getToken();
      const response = await fetch(`${API_BASE}/account/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password, confirmation }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload?.detail || "Unable to request deletion.";
        throw new Error(message);
      }
      setSuccess("Confirmation email sent. Check your inbox to proceed.");
      setPassword("");
      setConfirmation("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to request deletion.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <p className="text-sm text-slate-300">Sign in to manage account deletion.</p>;
  }

  return (
    <div className="space-y-4 text-sm text-slate-200">
      <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-rose-100">
        <p className="text-sm font-semibold">Delete account</p>
        <ul className="mt-2 space-y-1 text-xs text-rose-100/80">
          <li>All your LifeMosaic data will be deleted.</li>
          <li>You have a 30-day grace period to restore your account.</li>
          <li>After 30 days, deletion is permanent and cannot be undone.</li>
        </ul>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-slate-400">Step 1: Enter your password and confirmation phrase.</p>
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Input
          type="text"
          placeholder={CONFIRMATION_PHRASE}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <p className="text-xs text-slate-400">
          Step 2: Confirm via the email link we send to you.
        </p>
      </div>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-300">{success}</p> : null}
      <Button type="button" onClick={handleDelete} disabled={loading || !password || !confirmation}>
        {loading ? "Sending..." : "I understand, delete my account"}
      </Button>
    </div>
  );
};
