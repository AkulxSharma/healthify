"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logSpending } from "@/lib/events";
import type { Event } from "@/types/events";

type SpendingCategory = "Food" | "Transport" | "Shopping" | "Entertainment" | "Health" | "Other";

const categories: SpendingCategory[] = [
  "Food",
  "Transport",
  "Shopping",
  "Entertainment",
  "Health",
  "Other",
];

type SpendingPrefill = {
  amount?: number | null;
  merchant?: string | null;
  category?: SpendingCategory | null;
  notes?: string | null;
};

type SpendingLoggerProps = {
  prefill?: SpendingPrefill | null;
  onLogged?: (event: Event) => void;
  onReset?: () => void;
};

export function SpendingLogger({ prefill, onLogged, onReset }: SpendingLoggerProps) {
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState<SpendingCategory>("Other");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  useEffect(() => {
    if (!prefill) {
      return;
    }
    setAmount(prefill.amount != null ? String(prefill.amount) : "");
    setMerchant(prefill.merchant ?? "");
    setCategory(prefill.category ?? "Other");
    setNotes(prefill.notes ?? "");
  }, [prefill]);

  const title = useMemo(() => {
    if (merchant.trim()) {
      return `Spent at ${merchant.trim()}`;
    }
    if (category) {
      return `Spending - ${category}`;
    }
    return "Spending";
  }, [category, merchant]);

  const resetForm = () => {
    setAmount("");
    setMerchant("");
    setCategory("Other");
    setNotes("");
    onReset?.();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    const parsedAmount = Number(amount);
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setStatus({ type: "error", message: "Enter a valid amount." });
      return;
    }
    try {
      setSaving(true);
      const logged = await logSpending(title, parsedAmount, merchant.trim() || undefined, category, notes || undefined);
      setStatus({ type: "success", message: "Spending logged." });
      onLogged?.(logged);
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to log spending.";
      setStatus({ type: "error", message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="number"
        min="0"
        step="0.01"
        placeholder="Amount"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        required
      />
      <Input
        type="text"
        placeholder="Merchant (optional)"
        value={merchant}
        onChange={(event) => setMerchant(event.target.value)}
      />
      <select
        value={category}
        onChange={(event) => setCategory(event.target.value as SpendingCategory)}
        className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
      >
        {categories.map((option) => (
          <option key={option} value={option} className="text-slate-900">
            {option}
          </option>
        ))}
      </select>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Notes (optional)"
        className="min-h-[88px] w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
      />
      {status ? (
        <p className={status.type === "success" ? "text-sm text-emerald-200" : "text-sm text-rose-300"}>
          {status.message}
        </p>
      ) : null}
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Saving..." : "Log spending"}
      </Button>
    </form>
  );
}
