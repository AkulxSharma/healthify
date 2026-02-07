"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import type { GoalType, SharedGoal, SharedGoalCreatePayload } from "@/types/social";

type SharedGoalCreatorProps = {
  onCreated?: (goal: SharedGoal) => void;
};

const goalTypeOptions: Array<{ label: string; value: GoalType }> = [
  { label: "Save $X", value: "savings" },
  { label: "Lose X lbs", value: "wellness" },
  { label: "Reduce CO2 by X", value: "sustainability" },
  { label: "Build habit X", value: "habit" },
];

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

export function SharedGoalCreator({ onCreated }: SharedGoalCreatorProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("savings");
  const [targetValue, setTargetValue] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [inviteUsers, setInviteUsers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return title.trim() && targetValue.trim();
  }, [title, targetValue]);

  const addInvitee = () => {
    const trimmed = inviteInput.trim();
    if (!trimmed) {
      return;
    }
    if (!inviteUsers.includes(trimmed)) {
      setInviteUsers((prev) => [...prev, trimmed]);
    }
    setInviteInput("");
  };

  const removeInvitee = (value: string) => {
    setInviteUsers((prev) => prev.filter((item) => item !== value));
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const token = await getToken();
      const payload: SharedGoalCreatePayload = {
        title: title.trim(),
        description: description.trim() || null,
        goal_type: goalType,
        target_value: Number(targetValue),
        target_date: targetDate || null,
        invite_users: inviteUsers,
      };
      const res = await fetch(`${API_BASE}/social/goals/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Unable to create shared goal.");
      }
      const data = (await res.json()) as SharedGoal;
      setTitle("");
      setDescription("");
      setGoalType("savings");
      setTargetValue("");
      setTargetDate("");
      setInviteUsers([]);
      setStatus("Shared goal created!");
      onCreated?.(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create shared goal.";
      setStatus(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a shared goal</CardTitle>
        <CardDescription>Invite friends and track progress together.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Goal title"
          />
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description"
          />
          <select
            value={goalType}
            onChange={(event) => setGoalType(event.target.value as GoalType)}
            className="h-10 w-full rounded-md border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100"
          >
            {goalTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Input
            value={targetValue}
            onChange={(event) => setTargetValue(event.target.value)}
            placeholder="Target value"
            type="number"
          />
          <Input
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            placeholder="Target date"
            type="date"
          />
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={inviteInput}
              onChange={(event) => setInviteInput(event.target.value)}
              placeholder="Invite friends (email or username)"
            />
            <Button type="button" onClick={addInvitee} className="h-10 px-4">
              Add
            </Button>
          </div>
          {inviteUsers.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-xs text-slate-200">
              {inviteUsers.map((invitee) => (
                <span
                  key={invitee}
                  className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1"
                >
                  {invitee}
                  <button
                    type="button"
                    onClick={() => removeInvitee(invitee)}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit || saving}>
            {saving ? "Creating..." : "Create shared goal"}
          </Button>
          {status ? <span className="text-sm text-slate-300">{status}</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}
