"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notifications";
import { requestPushPermission } from "@/lib/pushNotifications";

type AlertTypeKey = "insights" | "goals" | "social" | "reminders";

const defaultPrefs: NotificationPreferences = {
  email_enabled: true,
  push_enabled: false,
  alert_types: {
    insights: true,
    goals: true,
    social: true,
    reminders: true,
  },
  frequency: "weekly",
};

const alertTypeLabels: Record<AlertTypeKey, string> = {
  insights: "Insights & patterns",
  goals: "Goal milestones",
  social: "Social updates",
  reminders: "Spending reminders",
};

export const NotificationSettings = () => {
  const { user } = useSupabaseSession();
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultPrefs);
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
    getNotificationPreferences()
      .then((data) => {
        setPrefs({
          ...defaultPrefs,
          ...data,
          alert_types: { ...defaultPrefs.alert_types, ...(data.alert_types ?? {}) },
        });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load notification settings.";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const updateAlertType = (key: AlertTypeKey, value: boolean) => {
    setPrefs((prev) => ({
      ...prev,
      alert_types: { ...prev.alert_types, [key]: value },
    }));
  };

  const toggleEmail = (value: boolean) => {
    setPrefs((prev) => ({ ...prev, email_enabled: value }));
  };

  const togglePush = async (value: boolean) => {
    setError(null);
    if (value) {
      const permission = await requestPushPermission();
      if (permission !== "granted") {
        setError("Push permission is not granted.");
        setPrefs((prev) => ({ ...prev, push_enabled: false }));
        return;
      }
    }
    setPrefs((prev) => ({ ...prev, push_enabled: value }));
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    try {
      setSaving(true);
      const saved = await updateNotificationPreferences({
        email: prefs.email_enabled,
        push: prefs.push_enabled,
        alert_types: prefs.alert_types,
      });
      setPrefs({
        ...defaultPrefs,
        ...saved,
        alert_types: { ...defaultPrefs.alert_types, ...(saved.alert_types ?? {}) },
      });
      setSuccess("Notification preferences saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save notification settings.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const alertTypes = useMemo(() => Object.keys(alertTypeLabels) as AlertTypeKey[], []);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
          <Switch
            label="Email notifications (weekly summary)"
            checked={prefs.email_enabled}
            disabled={loading}
            onChange={(event) => toggleEmail(event.target.checked)}
          />
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
          <Switch
            label="Push notifications (instant)"
            checked={prefs.push_enabled}
            disabled={loading}
            onChange={(event) => {
              void togglePush(event.target.checked);
            }}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {alertTypes.map((key) => (
          <div key={key} className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
            <Checkbox
              checked={prefs.alert_types?.[key] ?? true}
              onChange={() => updateAlertType(key, !(prefs.alert_types?.[key] ?? true))}
              label={alertTypeLabels[key]}
            />
          </div>
        ))}
      </div>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
      <Button type="button" onClick={handleSave} disabled={saving || loading} className="w-full">
        {saving ? "Saving..." : "Save notification settings"}
      </Button>
    </div>
  );
};
