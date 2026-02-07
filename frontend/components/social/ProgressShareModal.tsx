"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import type { ShareProgressPayload, SharedGoal } from "@/types/social";

type ProgressShareModalProps = {
  open: boolean;
  goal: SharedGoal | null;
  statsMessage?: string;
  onClose: () => void;
  onPosted?: () => void;
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

export function ProgressShareModal({
  open,
  goal,
  statsMessage,
  onClose,
  onPosted,
}: ProgressShareModalProps) {
  const [message, setMessage] = useState("");
  const [image, setImage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const achievement = useMemo(() => {
    if (statsMessage) {
      return statsMessage;
    }
    if (goal?.title) {
      return `Progress update on ${goal.title}`;
    }
    return "Progress update";
  }, [goal?.title, statsMessage]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setMessage("");
    setImage("");
    setStatus(null);
  }, [open]);

  const handlePost = async () => {
    if (!goal) {
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const token = await getToken();
      const payload: ShareProgressPayload = {
        goal_id: goal.id,
        achievement,
        message: message.trim() || null,
        image: image.trim() || null,
      };
      const res = await fetch(`${API_BASE}/social/share-progress`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Unable to share progress.");
      }
      setStatus("Posted to group!");
      onPosted?.();
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Unable to share progress.";
      setStatus(messageText);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !goal) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100">
        <div className="space-y-3">
          <p className="text-base font-semibold">Share progress</p>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">Current stats</p>
            <p className="text-sm text-slate-100">{achievement}</p>
          </div>
          <Input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Add a message (optional)"
          />
          <Input
            value={image}
            onChange={(event) => setImage(event.target.value)}
            placeholder="Image URL (optional)"
          />
          {status ? <p className="text-sm text-slate-300">{status}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              className="border border-slate-800 bg-transparent text-slate-200 hover:bg-slate-900"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handlePost} disabled={saving}>
              {saving ? "Posting..." : "Post to group"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
