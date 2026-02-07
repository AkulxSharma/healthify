"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { supabase } from "@/lib/supabaseClient";

type IntegrationRow = {
  id: string;
  provider: string;
  status: string;
  created_at?: string | null;
  last_sync?: string | null;
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

export const CalendarConnect = () => {
  const { user } = useSupabaseSession();
  const [integration, setIntegration] = useState<IntegrationRow | null>(null);
  const [authCode, setAuthCode] = useState("");
  const [days, setDays] = useState(30);
  const [eventId, setEventId] = useState("");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadIntegration = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/integrations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("Unable to load integrations.");
      }
      const rows = (await response.json()) as IntegrationRow[];
      const match = rows.find((row) => row.provider === "google_calendar") ?? null;
      setIntegration(match);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load integrations.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadIntegration();
  }, [loadIntegration]);

  const handleConnect = async () => {
    if (!authCode.trim()) {
      setError("Enter the OAuth authorization code.");
      return;
    }
    setConnecting(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/integrations/calendar/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ auth_code: authCode.trim() }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to connect Google Calendar.");
      }
      setAuthCode("");
      setSuccess("Google Calendar connected.");
      await loadIntegration();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to connect Google Calendar.";
      setError(message);
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getToken();
      const response = await fetch(
        `${API_BASE}/integrations/calendar/sync?days=${encodeURIComponent(String(days))}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to sync calendar events.");
      }
      const payload = (await response.json()) as { synced?: number };
      setSuccess(`Synced ${payload.synced ?? 0} events.`);
      await loadIntegration();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sync calendar events.";
      setError(message);
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = async () => {
    if (!eventId.trim()) {
      setError("Enter an event ID to export.");
      return;
    }
    setExporting(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getToken();
      const response = await fetch(
        `${API_BASE}/integrations/calendar/export?event_id=${encodeURIComponent(eventId.trim())}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to export event.");
      }
      setEventId("");
      setSuccess("Event exported to Google Calendar.");
      await loadIntegration();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to export event.";
      setError(message);
    } finally {
      setExporting(false);
    }
  };

  if (!user) {
    return <p className="text-sm text-slate-300">Sign in to connect your calendar.</p>;
  }

  return (
    <div className="space-y-4 text-sm text-slate-200">
      <div>
        <p className="text-base font-semibold text-slate-100">Google Calendar</p>
        <p className="text-xs text-slate-400">
          Sync your calendar events and export LifeMosaic entries.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
          <p className="text-sm">
            {loading ? "Loading..." : integration ? "Connected" : "Not connected"}
          </p>
          {integration?.last_sync ? (
            <p className="text-xs text-slate-500">Last sync: {integration.last_sync}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-slate-400">OAuth authorization code</label>
        <Input
          value={authCode}
          onChange={(event) => setAuthCode(event.target.value)}
          placeholder="Paste Google auth code"
          disabled={connecting}
        />
        <Button type="button" onClick={handleConnect} disabled={connecting || loading}>
          {connecting ? "Connecting..." : "Connect calendar"}
        </Button>
      </div>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-slate-400">Sync days</label>
        <Input
          type="number"
          min={1}
          max={365}
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          disabled={syncing}
        />
        <Button type="button" onClick={handleSync} disabled={syncing || loading || !integration}>
          {syncing ? "Syncing..." : "Sync calendar events"}
        </Button>
      </div>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-slate-400">Export LifeMosaic event</label>
        <Input
          value={eventId}
          onChange={(event) => setEventId(event.target.value)}
          placeholder="Event ID"
          disabled={exporting}
        />
        <Button type="button" onClick={handleExport} disabled={exporting || loading || !integration}>
          {exporting ? "Exporting..." : "Export to calendar"}
        </Button>
      </div>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-300">{success}</p> : null}
    </div>
  );
};
