"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { supabase } from "@/lib/supabaseClient";

type WebhookRow = {
  id: string;
  url: string;
  events: string[];
  status: string;
  created_at: string;
  last_triggered?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

const getToken = async (): Promise<string> => {
  if (!supabase) {
    throw new Error("Supabase client is not configured");
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Authorization required");
  }
  return token;
};

const parseEvents = (value: string): string[] => {
  return value
    .split(",")
    .map((event) => event.trim())
    .filter((event) => event.length > 0);
};

export const WebhookManager = () => {
  const { user } = useSupabaseSession();
  const [hooks, setHooks] = useState<WebhookRow[]>([]);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadHooks = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/webhooks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to load webhooks.");
      }
      const rows = (await response.json()) as WebhookRow[];
      setHooks(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load webhooks.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadHooks();
  }, [loadHooks]);

  const handleCreate = async () => {
    if (!url.trim()) {
      setError("Enter a webhook URL.");
      return;
    }
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/webhooks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: url.trim(),
          events: parseEvents(events),
          secret: secret.trim() || null,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to register webhook.");
      }
      setUrl("");
      setEvents("");
      setSecret("");
      setSuccess("Webhook registered.");
      await loadHooks();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to register webhook.";
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setProcessingId(id);
    setError(null);
    setSuccess(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/webhooks/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to delete webhook.");
      }
      setSuccess("Webhook deleted.");
      await loadHooks();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete webhook.";
      setError(message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleTest = async (id: string) => {
    setProcessingId(id);
    setError(null);
    setSuccess(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/webhooks/${id}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to send test webhook.");
      }
      setSuccess("Webhook test sent.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send test webhook.";
      setError(message);
    } finally {
      setProcessingId(null);
    }
  };

  if (!user) {
    return <p className="text-sm text-slate-300">Sign in to manage webhooks.</p>;
  }

  return (
    <div className="space-y-4 text-sm text-slate-200">
      <div>
        <p className="text-base font-semibold text-slate-100">Webhook subscriptions</p>
        <p className="text-xs text-slate-400">
          Receive event notifications for goals, insights, badges, and spending alerts.
        </p>
      </div>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-slate-400">Webhook URL</label>
        <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
      </div>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-slate-400">Events (comma-separated)</label>
        <Input
          value={events}
          onChange={(event) => setEvents(event.target.value)}
          placeholder="goal.completed, insight.discovered"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-slate-400">Signing secret (optional)</label>
        <Input
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          placeholder="Optional secret"
        />
      </div>
      <Button type="button" onClick={handleCreate} disabled={creating}>
        {creating ? "Registering..." : "Register webhook"}
      </Button>
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Active webhooks</p>
        {loading ? (
          <p className="text-xs text-slate-400">Loading webhooks...</p>
        ) : hooks.length === 0 ? (
          <p className="text-xs text-slate-400">No webhooks yet.</p>
        ) : (
          <div className="space-y-2">
            {hooks.map((hook) => (
              <div
                key={hook.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-100">{hook.url}</p>
                  <p className="text-xs text-slate-400">
                    Events: {hook.events?.length ? hook.events.join(", ") : "All"}
                  </p>
                  {hook.last_triggered ? (
                    <p className="text-xs text-slate-500">Last triggered: {hook.last_triggered}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="bg-slate-800 text-slate-100 hover:bg-slate-700"
                    onClick={() => handleTest(hook.id)}
                    disabled={processingId === hook.id}
                  >
                    {processingId === hook.id ? "Sending..." : "Send test"}
                  </Button>
                  <Button
                    type="button"
                    className="bg-rose-600/80 text-white hover:bg-rose-600"
                    onClick={() => handleDelete(hook.id)}
                    disabled={processingId === hook.id}
                  >
                    {processingId === hook.id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-300">{success}</p> : null}
    </div>
  );
};
