"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { getUserProfile, upsertUserProfile } from "@/lib/profile";
import type { ProfileType, UserProfile } from "@/types/profile";

const profileOptions: ProfileType[] = [
  "Student",
  "Worker",
  "Athlete",
  "Caregiver",
  "Recovery",
  "General",
];

export default function ProfileOnboardingPage() {
  const router = useRouter();
  const { user, loading } = useSupabaseSession();
  const [selected, setSelected] = useState<ProfileType[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
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
    setLoadingProfile(true);
    getUserProfile(user.id)
      .then((data) => {
        setProfile(data);
        setSelected(data?.profile_types ?? []);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load profile.";
        setError(message);
      })
      .finally(() => {
        setLoadingProfile(false);
      });
  }, [user]);

  const toggleSelection = (value: ProfileType) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!user) {
      setError("You must be logged in.");
      return;
    }
    if (selected.length === 0) {
      setError("Select at least one profile type.");
      return;
    }

    try {
      setSaving(true);
      const saved = await upsertUserProfile(user.id, selected);
      setProfile(saved);
      setSuccess("Profile saved.");
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save profile.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const subtitle = useMemo(() => {
    if (loadingProfile) {
      return "Loading your current profile.";
    }
    if (profile) {
      return "Update your profile types any time.";
    }
    return "Pick one or more profile types to personalize your dashboard.";
  }, [loadingProfile, profile]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Choose how LifeMosaic should think about you</CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {profileOptions.map((option) => {
                  const isSelected = selected.includes(option);
                  return (
                    <Button
                      key={option}
                      type="button"
                      onClick={() => toggleSelection(option)}
                      className={
                        isSelected
                          ? "w-full rounded-2xl border border-emerald-400 bg-emerald-500/20 text-emerald-100"
                          : "w-full rounded-2xl border border-slate-800 bg-slate-950/50 text-slate-200"
                      }
                    >
                      {option}
                    </Button>
                  );
                })}
              </div>
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
              <Button type="submit" disabled={saving || loadingProfile} className="w-full">
                {saving ? "Saving..." : "Save profile"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
