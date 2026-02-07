"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Coffee,
  DollarSign,
  Droplet,
  Dumbbell,
  Pill,
  Users,
  Utensils,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logEvent } from "@/lib/events";
import type { Event, EventCategory, EventType } from "@/types/events";

type QuickTapLoggerProps = {
  userId: string;
  onLogged?: (event: Event) => void;
};

type QuickEventConfig = {
  type: EventType;
  category: EventCategory;
  label: string;
  icon: LucideIcon;
  requiresDetails?: boolean;
  defaultTitle: string;
  amountPlaceholder?: string;
};

const quickEvents: QuickEventConfig[] = [
  {
    type: "spending",
    category: "finance",
    label: "Spending",
    icon: DollarSign,
    requiresDetails: true,
    defaultTitle: "Spending",
    amountPlaceholder: "e.g. 12.50",
  },
  {
    type: "food",
    category: "nutrition",
    label: "Food",
    icon: Utensils,
    requiresDetails: true,
    defaultTitle: "Meal",
    amountPlaceholder: "e.g. 450",
  },
  {
    type: "movement",
    category: "fitness",
    label: "Movement",
    icon: Dumbbell,
    defaultTitle: "Movement",
  },
  { type: "meds", category: "health", label: "Meds", icon: Pill, defaultTitle: "Took meds" },
  {
    type: "social",
    category: "social",
    label: "Social",
    icon: Users,
    defaultTitle: "Social time",
  },
  {
    type: "water",
    category: "health",
    label: "Water",
    icon: Droplet,
    defaultTitle: "Drank water",
  },
  {
    type: "break",
    category: "selfcare",
    label: "Break",
    icon: Coffee,
    defaultTitle: "Took a break",
  },
];

const colorClasses: Record<EventCategory, string> = {
  health: "border-emerald-400 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25",
  fitness: "border-emerald-400 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25",
  social: "border-sky-400 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25",
  nutrition: "border-orange-400 bg-orange-500/15 text-orange-100 hover:bg-orange-500/25",
  selfcare: "border-purple-400 bg-purple-500/15 text-purple-100 hover:bg-purple-500/25",
  finance: "border-amber-400 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25",
  productivity: "border-indigo-400 bg-indigo-500/15 text-indigo-100 hover:bg-indigo-500/25",
};

export function QuickTapLogger({ userId, onLogged }: QuickTapLoggerProps) {
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [savingType, setSavingType] = useState<EventType | null>(null);
  const [modalEvent, setModalEvent] = useState<QuickEventConfig | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalAmount, setModalAmount] = useState("");
  const [modalNotes, setModalNotes] = useState("");
  const timeoutRef = useRef<number | null>(null);

  const resetStatus = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setStatus(null);
    }, 1600);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const logQuickEvent = async (
    config: QuickEventConfig,
    title: string,
    amount?: number,
    notes?: string
  ) => {
    if (!userId) {
      setStatus({ type: "error", message: "Log in to record events." });
      resetStatus();
      return;
    }
    try {
      setSavingType(config.type);
      const event = await logEvent({
        user_id: userId,
        event_type: config.type,
        category: config.category,
        title,
        amount,
        metadata: notes ? { notes } : undefined,
      });
      onLogged?.(event);
      setStatus({ type: "success", message: `${config.label} logged` });
      resetStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to log event.";
      setStatus({ type: "error", message });
      resetStatus();
    } finally {
      setSavingType(null);
    }
  };

  const handleQuickTap = (config: QuickEventConfig) => {
    if (config.requiresDetails) {
      setModalTitle(config.defaultTitle);
      setModalAmount("");
      setModalNotes("");
      setModalEvent(config);
      return;
    }
    void logQuickEvent(config, config.defaultTitle);
  };

  const submitModal = async () => {
    if (!modalEvent) {
      return;
    }
    const amountValue = modalAmount.trim() ? Number(modalAmount) : undefined;
    const parsedAmount =
      amountValue !== undefined && !Number.isNaN(amountValue) ? amountValue : undefined;
    const title = modalTitle.trim() || modalEvent.defaultTitle;
    const notes = modalNotes.trim() || undefined;
    await logQuickEvent(modalEvent, title, parsedAmount, notes);
    setModalEvent(null);
  };

  const statusClasses = useMemo(() => {
    if (!status) {
      return "";
    }
    return status.type === "success" ? "text-emerald-200" : "text-rose-300";
  }, [status]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {quickEvents.map((event) => {
          const Icon = event.icon;
          const isSaving = savingType === event.type;
          return (
            <Button
              key={event.type}
              type="button"
              onClick={() => handleQuickTap(event)}
              disabled={isSaving}
              className={`min-h-[64px] w-full justify-start gap-3 rounded-2xl border px-4 py-4 text-left text-sm ${colorClasses[event.category]}`}
            >
              <Icon className="h-5 w-5" />
              <span className="flex-1">{isSaving ? "Saving..." : event.label}</span>
            </Button>
          );
        })}
      </div>
      {status ? <div className={`text-sm ${statusClasses}`}>{status.message}</div> : null}
      {modalEvent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100">
            <div className="space-y-3">
              <Input
                value={modalTitle}
                onChange={(event) => setModalTitle(event.target.value)}
                placeholder="Title"
                disabled={savingType === modalEvent.type}
              />
              <Input
                value={modalAmount}
                onChange={(event) => setModalAmount(event.target.value)}
                placeholder={modalEvent.amountPlaceholder ?? "Amount"}
                type="number"
                disabled={savingType === modalEvent.type}
              />
              <Input
                value={modalNotes}
                onChange={(event) => setModalNotes(event.target.value)}
                placeholder="Notes (optional)"
                disabled={savingType === modalEvent.type}
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  className="border border-slate-800 bg-transparent text-slate-200 hover:bg-slate-900"
                  onClick={() => setModalEvent(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={submitModal}
                  disabled={savingType === modalEvent.type}
                >
                  {savingType === modalEvent.type ? "Saving..." : "Log event"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
