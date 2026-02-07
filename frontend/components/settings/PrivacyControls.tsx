"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { supabase } from "@/lib/supabaseClient";

type ProfileVisibility = "public" | "friends" | "private";

type PrivacySettings = {
  profile_visibility: ProfileVisibility;
  activity_sharing: boolean;
  data_analytics_consent: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

const defaultSettings: PrivacySettings = {
  profile_visibility: "friends",
  activity_sharing: true,
  data_analytics_consent: true,
};

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

export const PrivacyControls = () => {
  const { user } = useSupabaseSession();
  const [settings, setSettings] = useState<PrivacySettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getToken()
      .then((token) =>
        fetch(`${API_BASE}/privacy/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load privacy settings.");
        }
        const payload = (await response.json()) as PrivacySettings;
        setSettings({ ...defaultSettings, ...payload });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load privacy settings.";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    try {
      setSaving(true);
      const token = await getToken();
      const response = await fetch(`${API_BASE}/privacy/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        throw new Error("Unable to save privacy settings.");
      }
      const payload = (await response.json()) as PrivacySettings;
      setSettings({ ...defaultSettings, ...payload });
      setSuccess("Privacy settings saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save privacy settings.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return <p className="text-sm text-slate-300">Sign in to manage your privacy controls.</p>;
  }

  return (
    <div className="space-y-4 text-sm text-slate-200">
      <div>
        <label className="text-xs uppercase tracking-wide text-slate-400">Profile visibility</label>
        <select
          value={settings.profile_visibility}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              profile_visibility: event.target.value as ProfileVisibility,
            }))
          }
          disabled={loading}
          className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 outline-none"
        >
          <option value="public" className="text-slate-900">
            Public
          </option>
          <option value="friends" className="text-slate-900">
            Friends only
          </option>
          <option value="private" className="text-slate-900">
            Private
          </option>
        </select>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
        <Switch
          label="Share my activity with friends"
          checked={settings.activity_sharing}
          disabled={loading}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, activity_sharing: event.target.checked }))
          }
        />
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
        <Switch
          label="Allow data for analytics & insights"
          checked={settings.data_analytics_consent}
          disabled={loading}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, data_analytics_consent: event.target.checked }))
          }
        />
      </div>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-300">{success}</p> : null}
      <Button type="button" onClick={handleSave} disabled={saving || loading}>
        {saving ? "Saving..." : "Save privacy settings"}
      </Button>
    </div>
  );
};
