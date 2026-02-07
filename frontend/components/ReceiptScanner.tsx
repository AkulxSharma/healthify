"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

type ReceiptResult = {
  total_amount?: number | null;
  merchant?: string | null;
  date?: string | null;
  category?: "Food" | "Transport" | "Shopping" | "Entertainment" | "Health" | "Other" | null;
  items?: Array<{ name: string; quantity?: number; price?: number }> | null;
  notes?: string | null;
};

type ReceiptScannerProps = {
  onPrefill: (data: {
    amount?: number | null;
    merchant?: string | null;
    category?: "Food" | "Transport" | "Shopping" | "Entertainment" | "Health" | "Other" | null;
    notes?: string | null;
  }) => void;
};

export function ReceiptScanner({ onPrefill }: ReceiptScannerProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiptResult | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!imageFile) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResult(null);
    const file = event.target.files?.[0] ?? null;
    setImageFile(file);
  };

  const handleProcess = async () => {
    setError(null);
    if (!imageFile) {
      setError("Select a receipt image first.");
      return;
    }
    if (imageFile.size > 10 * 1024 * 1024) {
      setError("Receipt image must be under 10MB.");
      return;
    }
    const form = new FormData();
    form.append("image", imageFile);
    try {
      setProcessing(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error("Log in to process receipts.");
      }
      const res = await fetch(`${API_BASE}/receipts/process`, {
        method: "POST",
        body: form,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Receipt processing failed.");
      }
      const payload = (await res.json()) as ReceiptResult;
      const itemNotes =
        payload.items && payload.items.length > 0
          ? `Items: ${payload.items
              .map((item) => {
                const qty = item.quantity != null ? ` x${item.quantity}` : "";
                const price = item.price != null ? ` ($${item.price})` : "";
                return `${item.name}${qty}${price}`;
              })
              .join(", ")}`
          : null;
      setResult(payload);
      onPrefill({
        amount: payload.total_amount ?? null,
        merchant: payload.merchant ?? null,
        category: payload.category ?? null,
        notes: itemNotes ?? payload.notes ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to process receipt.";
      setError(message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePick}
        className="hidden"
      />
      <Button type="button" onClick={() => inputRef.current?.click()}>
        Scan receipt
      </Button>
      {imageUrl ? (
        <div className="relative h-[320px] w-full overflow-hidden rounded-2xl border border-slate-800">
          <Image
            src={imageUrl}
            alt="Receipt preview"
            fill
            sizes="100vw"
            className="object-contain"
            unoptimized
          />
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <Button type="button" disabled={processing || !imageFile} onClick={handleProcess}>
        {processing ? "Processing..." : "Process receipt"}
      </Button>
      {result ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
          <div className="flex justify-between">
            <span>Amount</span>
            <span>{result.total_amount != null ? `$${result.total_amount.toFixed(2)}` : "-"}</span>
          </div>
          <div className="flex justify-between">
            <span>Merchant</span>
            <span>{result.merchant || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span>Category</span>
            <span>{result.category || "-"}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
