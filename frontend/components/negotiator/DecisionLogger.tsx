"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logDecisionRemote } from "@/lib/negotiator";
import type { DecisionLogPayload, NegotiatorAlternative, NegotiatorBreakdown } from "@/types/negotiator";

type DecisionLoggerProps = {
  query: string;
  item: string;
  impacts: NegotiatorBreakdown;
  alternative?: NegotiatorAlternative;
  onLogged?: () => void;
  requestedDecision?: DecisionLogPayload["decision_type"] | null;
  onRequestHandled?: () => void;
};

export function DecisionLogger({
  query,
  item,
  impacts,
  alternative,
  onLogged,
  requestedDecision,
  onRequestHandled,
}: DecisionLoggerProps) {
  const [open, setOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<DecisionLogPayload["decision_type"]>("did_it");
  const [costActual, setCostActual] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!requestedDecision) return;
    setDecisionType(requestedDecision);
    setCostActual("");
    setStatus(null);
    setOpen(true);
    onRequestHandled?.();
  }, [onRequestHandled, requestedDecision]);

  const handleOpen = (type: DecisionLogPayload["decision_type"]) => {
    setDecisionType(type);
    setCostActual("");
    setStatus(null);
    setOpen(true);
  };

  const handleSubmit = async () => {
    const payload: DecisionLogPayload = {
      query,
      item,
      decision_type: decisionType,
      alternative: decisionType === "took_alternative" ? alternative ?? null : null,
      cost_actual: costActual ? Number(costActual) : undefined,
      impacts,
    };
    try {
      setSaving(true);
      const res = await logDecisionRemote(payload);
      setStatus(res.message);
      onLogged?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to log decision.";
      setStatus(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" className="h-8 px-3 text-xs" onClick={() => handleOpen("did_it")}>
          Did it
        </Button>
        <Button
          type="button"
          className="h-8 px-3 text-xs"
          onClick={() => handleOpen("took_alternative")}
        >
          Took alternative
        </Button>
        <Button type="button" className="h-8 px-3 text-xs" onClick={() => handleOpen("skipped")}>
          Skipped
        </Button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-4 text-slate-100">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold">Any adjustments?</p>
              <button type="button" className="text-xs underline" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">Update cost if different from the estimate.</p>
            <div className="mt-3">
              <Input
                placeholder="Actual cost (optional)"
                value={costActual}
                onChange={(event) => setCostActual(event.target.value)}
              />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Button type="button" className="h-8 px-3 text-xs" onClick={handleSubmit} disabled={saving}>
                {saving ? "Logging..." : "Log decision"}
              </Button>
              {status ? <span className="text-xs text-slate-300">{status}</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
