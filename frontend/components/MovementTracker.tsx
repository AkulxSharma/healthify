"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { logEvent, logMovement } from "@/lib/events";
import { supabase } from "@/lib/supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

type MovementPattern = {
  date: string;
  steps: number;
  active_minutes: number;
  sedentary_minutes: number;
  workout_count: number;
  total_movement_score: number;
};

type StatusMessage = {
  type: "success" | "error";
  message: string;
};

export function MovementTracker() {
  const [daily, setDaily] = useState<MovementPattern | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<"steps" | "walk" | "workout" | null>(null);
  const [stepsInput, setStepsInput] = useState("");
  const [walkMinutes, setWalkMinutes] = useState("");
  const [workoutMinutes, setWorkoutMinutes] = useState("");
  const [workoutLabel, setWorkoutLabel] = useState("Workout");
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const scoreBadgeClass = useCallback((score?: number | null) => {
    const s = score ?? 0;
    if (s >= 80) return "border-emerald-400 bg-emerald-500/15 text-emerald-100";
    if (s >= 50) return "border-amber-400 bg-amber-500/15 text-amber-100";
    return "border-rose-400 bg-rose-500/15 text-rose-100";
  }, []);

  const refreshDaily = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/movement/daily`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error("Unable to load movement summary.");
      }
      const payload = (await res.json()) as MovementPattern;
      setDaily(payload);
      setStatus(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load movement summary.";
      setStatus({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDaily();
  }, [refreshDaily]);

  const stepsProgress = useMemo(() => {
    const steps = daily?.steps ?? 0;
    return Math.min(100, Math.round((steps / 10000) * 100));
  }, [daily?.steps]);

  const activeProgress = useMemo(() => {
    const active = daily?.active_minutes ?? 0;
    return Math.min(100, Math.round((active / 30) * 100));
  }, [daily?.active_minutes]);

  const handleLogSteps = async () => {
    const value = Number(stepsInput);
    if (!Number.isFinite(value) || value <= 0) {
      setStatus({ type: "error", message: "Enter a valid step count." });
      return;
    }
    setSavingType("steps");
    setStatus(null);
    try {
      await logEvent({
        event_type: "movement",
        category: "fitness",
        title: `Steps ${Math.round(value)}`,
        metadata: { steps: Math.round(value), type: "steps" },
      });
      setStepsInput("");
      setStatus({ type: "success", message: "Steps logged." });
      await refreshDaily();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to log steps.";
      setStatus({ type: "error", message });
    } finally {
      setSavingType(null);
    }
  };

  const handleLogWalk = async () => {
    const value = Number(walkMinutes);
    if (!Number.isFinite(value) || value <= 0) {
      setStatus({ type: "error", message: "Enter a walk duration in minutes." });
      return;
    }
    setSavingType("walk");
    setStatus(null);
    try {
      await logMovement(`Walk ${Math.round(value)} min`, Math.round(value), "walk");
      setWalkMinutes("");
      setStatus({ type: "success", message: "Walk logged." });
      await refreshDaily();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to log walk.";
      setStatus({ type: "error", message });
    } finally {
      setSavingType(null);
    }
  };

  const handleLogWorkout = async () => {
    const value = Number(workoutMinutes);
    if (!Number.isFinite(value) || value <= 0) {
      setStatus({ type: "error", message: "Enter a workout duration in minutes." });
      return;
    }
    const label = workoutLabel.trim() || "Workout";
    setSavingType("workout");
    setStatus(null);
    try {
      await logMovement(`${label} ${Math.round(value)} min`, Math.round(value), "workout");
      setWorkoutMinutes("");
      setWorkoutLabel("Workout");
      setStatus({ type: "success", message: "Workout logged." });
      await refreshDaily();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to log workout.";
      setStatus({ type: "error", message });
    } finally {
      setSavingType(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today’s movement</CardTitle>
        <CardDescription>Track steps, active minutes, and workouts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="text-sm text-slate-300">Loading movement summary…</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
              <p className="text-xs text-slate-400">Steps</p>
              <p className="text-lg font-semibold text-slate-100">{daily?.steps ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
              <p className="text-xs text-slate-400">Active minutes</p>
              <p className="text-lg font-semibold text-slate-100">{daily?.active_minutes ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
              <p className="text-xs text-slate-400">Workouts</p>
              <p className="text-lg font-semibold text-slate-100">{daily?.workout_count ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
              <p className="text-xs text-slate-400">Movement score</p>
              <span
                className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs ${scoreBadgeClass(
                  daily?.total_movement_score
                )}`}
              >
                {daily?.total_movement_score ?? 0} / 100
              </span>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Steps goal</span>
              <span className="text-xs text-slate-300">{stepsProgress}%</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-800">
              <div
                className="h-2 rounded-full bg-emerald-400"
                style={{ width: `${stepsProgress}%` }}
              />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Active minutes goal</span>
              <span className="text-xs text-slate-300">{activeProgress}%</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-800">
              <div
                className="h-2 rounded-full bg-sky-400"
                style={{ width: `${activeProgress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-200">Quick log</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-xs text-slate-400">Log steps</p>
              <div className="mt-2 space-y-2">
                <Input
                  type="number"
                  min="0"
                  placeholder="Steps"
                  value={stepsInput}
                  onChange={(event) => setStepsInput(event.target.value)}
                />
                <Button type="button" onClick={handleLogSteps} disabled={savingType === "steps"}>
                  {savingType === "steps" ? "Saving..." : "Add steps"}
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-xs text-slate-400">Log walk</p>
              <div className="mt-2 space-y-2">
                <Input
                  type="number"
                  min="0"
                  placeholder="Minutes"
                  value={walkMinutes}
                  onChange={(event) => setWalkMinutes(event.target.value)}
                />
                <Button type="button" onClick={handleLogWalk} disabled={savingType === "walk"}>
                  {savingType === "walk" ? "Saving..." : "Add walk"}
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-xs text-slate-400">Log workout</p>
              <div className="mt-2 space-y-2">
                <Input
                  type="text"
                  placeholder="Workout type"
                  value={workoutLabel}
                  onChange={(event) => setWorkoutLabel(event.target.value)}
                />
                <Input
                  type="number"
                  min="0"
                  placeholder="Minutes"
                  value={workoutMinutes}
                  onChange={(event) => setWorkoutMinutes(event.target.value)}
                />
                <Button
                  type="button"
                  onClick={handleLogWorkout}
                  disabled={savingType === "workout"}
                >
                  {savingType === "workout" ? "Saving..." : "Add workout"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {status ? (
          <p className={status.type === "success" ? "text-sm text-emerald-200" : "text-sm text-rose-300"}>
            {status.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
