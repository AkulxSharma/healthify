"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { NotificationSettings as NotificationSettingsPanel } from "@/components/notifications/NotificationSettings";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { getUserSettings, upsertUserSettings } from "@/lib/settings";
import type {
  NotificationSettings,
  TileKey,
  UserSettings,
  WeeklyGoals,
} from "@/types/profile";

const allTiles: TileKey[] = [
  "sleep",
  "movement",
  "focus",
  "social",
  "nutrition",
  "medsRehab",
  "selfCare",
  "mood",
];

const tileLabels: Record<TileKey, string> = {
  sleep: "Sleep",
  movement: "Movement",
  focus: "Focus",
  social: "Social",
  nutrition: "Nutrition",
  medsRehab: "Meds/Rehab",
  selfCare: "Self-care",
  mood: "Mood",
};

const defaultGoals: WeeklyGoals = {
  sleepHours: 7,
  workoutsPerWeek: 3,
  socialEventsPerWeek: 2,
};

const defaultNotifications: NotificationSettings = {
  dailyReminder: true,
  riskAlerts: true,
  focusTracking: false,
};

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { user, loading } = useSupabaseSession();

  const [activeTiles, setActiveTiles] = useState<TileKey[]>(allTiles);
  const [goals, setGoals] = useState<WeeklyGoals>(defaultGoals);
  const [notifications, setNotifications] = useState<NotificationSettings>(defaultNotifications);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    setLoadingSettings(true);
    getUserSettings(user.id)
      .then((data) => {
        if (data) {
          setActiveTiles(data.active_tiles?.length ? data.active_tiles : allTiles);
          setGoals(data.weekly_goals ?? defaultGoals);
          setNotifications({ ...defaultNotifications, ...(data.notifications ?? {}) });
        } else {
          setActiveTiles(allTiles);
          setGoals(defaultGoals);
          setNotifications(defaultNotifications);
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load settings.";
        setError(message);
      })
      .finally(() => {
        setLoadingSettings(false);
      });
  }, [user]);

  const toggleTile = (tile: TileKey) => {
    setActiveTiles((prev) => (prev.includes(tile) ? prev.filter((t) => t !== tile) : [...prev, tile]));
  };

  const updateGoal = (key: keyof WeeklyGoals, value: number) => {
    setGoals((prev) => ({ ...prev, [key]: value }));
  };

  const updateNotification = (key: keyof NotificationSettings, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!user) {
      setError("You must be logged in.");
      return;
    }
    try {
      setSaving(true);
      const saved: UserSettings = await upsertUserSettings(user.id, {
        active_tiles: activeTiles,
        weekly_goals: goals,
        notifications,
      });
      setActiveTiles(saved.active_tiles);
      setGoals(saved.weekly_goals);
      setNotifications(saved.notifications);
      setSuccess("Settings saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save settings.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const subtitle = useMemo(() => {
    if (loadingSettings) {
      return "Loading your current settings.";
    }
    return "Customize tiles, set weekly goals, and notifications.";
  }, [loadingSettings]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Profile customization</CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <section className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4 text-sm text-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-100">Privacy & account</p>
                  <p className="text-xs text-slate-400">
                    Manage visibility, data exports, and account deletion.
                  </p>
                </div>
                <Button type="button" onClick={() => router.push("/settings/privacy")}>
                  Open privacy settings
                </Button>
              </div>
            </section>
            <section className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-4 text-sm text-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-100">Integrations</p>
                  <p className="text-xs text-slate-400">
                    Connect external services, API keys, and webhooks.
                  </p>
                </div>
                <Button type="button" onClick={() => router.push("/settings/integrations")}>
                  Open integrations
                </Button>
              </div>
            </section>
            <form onSubmit={handleSave} className="space-y-8">
              <section className="space-y-3">
                <h3 className="text-lg font-semibold">Active tiles</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {allTiles.map((tile) => {
                    const checked = activeTiles.includes(tile);
                    return (
                      <div
                        key={tile}
                        className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3"
                      >
                        <Checkbox
                          checked={checked}
                          onChange={() => toggleTile(tile)}
                          label={tileLabels[tile]}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-semibold">Weekly goals</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate-400">Sleep hours per night</p>
                    <Input
                      type="number"
                      min={0}
                      value={goals.sleepHours}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        updateGoal("sleepHours", Number.isNaN(value) ? 0 : value);
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Workouts per week</p>
                    <Input
                      type="number"
                      min={0}
                      value={goals.workoutsPerWeek}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        updateGoal("workoutsPerWeek", Number.isNaN(value) ? 0 : value);
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Social events per week</p>
                    <Input
                      type="number"
                      min={0}
                      value={goals.socialEventsPerWeek}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        updateGoal("socialEventsPerWeek", Number.isNaN(value) ? 0 : value);
                      }}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-semibold">Notifications</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                    <Switch
                      label="Daily reminder"
                      checked={notifications.dailyReminder}
                      onChange={(e) => updateNotification("dailyReminder", e.target.checked)}
                    />
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                    <Switch
                      label="Risk alerts"
                      checked={notifications.riskAlerts}
                      onChange={(e) => updateNotification("riskAlerts", e.target.checked)}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-semibold">Weekly summary & alerts</h3>
                <NotificationSettingsPanel />
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-semibold">Focus sessions (optional)</h3>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
                  <div className="space-y-2">
                    <Switch
                      label="Track focus sessions"
                      checked={notifications.focusTracking}
                      onChange={(e) => updateNotification("focusTracking", e.target.checked)}
                    />
                    <p className="text-xs text-slate-400">
                      We only track duration and time, never content or URLs. You can disable anytime.
                      Your data stays private to you.
                    </p>
                  </div>
                </div>
              </section>

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
              <Button type="submit" disabled={saving || loadingSettings} className="w-full">
                {saving ? "Saving..." : "Save settings"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
