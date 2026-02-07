"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { supabase } from "@/lib/supabaseClient";

type ApiKeyRow = {
  id: string;
  name: string;
  scopes: string[];
  rate_limit: number;
  created_at: string;
  last_used?: string | null;
  status?: string | null;
};

type ApiKeyCreateResponse = ApiKeyRow & {
  key: string;
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

const parseScopes = (value: string): string[] => {
  return value
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
};

export const APIKeysManager = () => {
  const { user } = useSupabaseSession();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/developer/keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to load API keys.");
      }
      const rows = (await response.json()) as ApiKeyRow[];
      setKeys(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load API keys.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Enter a key name.");
      return;
    }
    setCreating(true);
    setError(null);
    setSuccess(null);
    setCreatedKey(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/developer/keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim(), scopes: parseScopes(scopes) }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to create API key.");
      }
      const payload = (await response.json()) as ApiKeyCreateResponse;
      setName("");
      setScopes("");
      setCreatedKey(payload.key);
      setSuccess("API key created. Copy it now, it will not be shown again.");
      await loadKeys();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create API key.";
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    setError(null);
    setSuccess(null);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/developer/keys/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to revoke API key.");
      }
      setSuccess("API key revoked.");
      await loadKeys();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to revoke API key.";
      setError(message);
    } finally {
      setRevokingId(null);
    }
  };

  if (!user) {
    return <p className="text-sm text-slate-300">Sign in to manage API keys.</p>;
  }

  return (
    <div className="space-y-4 text-sm text-slate-200">
      <div>
        <p className="text-base font-semibold text-slate-100">Developer API keys</p>
        <p className="text-xs text-slate-400">Generate API keys for the public API.</p>
      </div>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-slate-400">Key name</label>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="My app" />
      </div>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wide text-slate-400">Scopes (comma-separated)</label>
        <Input
          value={scopes}
          onChange={(event) => setScopes(event.target.value)}
          placeholder="events, insights, goals"
        />
      </div>
      <Button type="button" onClick={handleCreate} disabled={creating}>
        {creating ? "Creating..." : "Create API key"}
      </Button>
      {createdKey ? (
        <div className="rounded-2xl border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">
          <p className="font-semibold">New API key</p>
          <p className="break-all">{createdKey}</p>
        </div>
      ) : null}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Active keys</p>
        {loading ? (
          <p className="text-xs text-slate-400">Loading keys...</p>
        ) : keys.length === 0 ? (
          <p className="text-xs text-slate-400">No API keys yet.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-100">{key.name}</p>
                  <p className="text-xs text-slate-400">
                    Scopes: {key.scopes?.length ? key.scopes.join(", ") : "None"}
                  </p>
                  <p className="text-xs text-slate-500">Rate limit: {key.rate_limit}/hour</p>
                </div>
                <Button
                  type="button"
                  className="bg-slate-800 text-slate-100 hover:bg-slate-700"
                  onClick={() => handleRevoke(key.id)}
                  disabled={revokingId === key.id}
                >
                  {revokingId === key.id ? "Revoking..." : "Revoke"}
                </Button>
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
