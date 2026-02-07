"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SwapRejectionReason } from "@/types/swaps";

type RejectionModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    reason: SwapRejectionReason,
    customReason: string | undefined,
    wouldTryModified: boolean
  ) => void;
  submitting?: boolean;
};

export function RejectionModal({ open, onClose, onSubmit, submitting }: RejectionModalProps) {
  const [reason, setReason] = useState<SwapRejectionReason>("taste_preference");
  const [customReason, setCustomReason] = useState("");
  const [wouldTryModified, setWouldTryModified] = useState(false);
  const options: Array<{ key: SwapRejectionReason; label: string }> = [
    { key: "taste_preference", label: "Taste preference" },
    { key: "availability", label: "Not available nearby" },
    { key: "too_expensive", label: "Too expensive" },
    { key: "dietary_restriction", label: "Dietary restriction" },
    { key: "time_constraint", label: "Time constraint" },
    { key: "not_realistic", label: "Not realistic for me" },
    { key: "other", label: "Other" },
  ];

  useEffect(() => {
    if (!open) {
      return;
    }
    setReason("taste_preference");
    setCustomReason("");
    setWouldTryModified(false);
  }, [open]);

  const handleSubmit = () => {
    onSubmit(reason, reason === "other" ? customReason || undefined : undefined, wouldTryModified);
  };

  if (!open) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100">
        <div className="space-y-3">
          <p className="text-base font-semibold">Why isn&apos;t this working for you?</p>
          <div className="space-y-2">
            {options.map((opt) => (
              <label key={opt.key} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="reason"
                  value={opt.key}
                  checked={reason === opt.key}
                  onChange={() => setReason(opt.key)}
                  className="h-4 w-4 rounded-full border border-slate-700"
                />
                <span>{opt.label}</span>
              </label>
            ))}
            {reason === "other" ? (
              <Input
                value={customReason}
                onChange={(event) => setCustomReason(event.target.value)}
                placeholder="Tell us what didn't work"
              />
            ) : null}
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={wouldTryModified}
                onChange={(event) => setWouldTryModified(event.target.checked)}
                className="h-4 w-4 rounded border border-slate-700"
              />
              Would you try a modified version?
            </label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              className="border border-slate-800 bg-transparent text-slate-200 hover:bg-slate-900"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit feedback"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
