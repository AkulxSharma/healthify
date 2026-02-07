"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { getAlerts, markAlertRead, type AlertItem } from "@/lib/notifications";

type ToastAlert = AlertItem & { dismissed: boolean };

const typeStyles: Record<string, string> = {
  goals: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
  reminders: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  insights: "border-indigo-500/40 bg-indigo-500/10 text-indigo-100",
  social: "border-sky-500/40 bg-sky-500/10 text-sky-100",
};

export const InAppAlert = () => {
  const router = useRouter();
  const { user } = useSupabaseSession();
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    let active = true;
    const poll = async () => {
      try {
        const unread = await getAlerts(true);
        if (!active) {
          return;
        }
        const fresh = unread.filter((row) => !seenRef.current.has(row.id));
        if (fresh.length) {
          setToasts((prev) => [
            ...fresh.map((row) => ({ ...row, dismissed: false })),
            ...prev,
          ]);
          fresh.forEach((row) => seenRef.current.add(row.id));
        }
      } catch {
        if (!active) {
          return;
        }
      }
    };
    poll();
    const timer = window.setInterval(poll, 20000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    if (!toasts.length) {
      return;
    }
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        void markAlertRead(toast.id);
        removeToast(toast.id);
      }, 5000)
    );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts]);

  const visible = useMemo(() => toasts.slice(0, 3), [toasts]);

  if (!user || visible.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-6 top-20 z-50 space-y-3">
      {visible.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => {
            if (toast.action_link) {
              router.push(toast.action_link);
            }
            void markAlertRead(toast.id);
            removeToast(toast.id);
          }}
          className={`w-72 rounded-2xl border px-4 py-3 text-left shadow-lg transition hover:scale-[1.01] ${
            typeStyles[toast.alert_type] ?? "border-slate-700/70 bg-slate-900 text-slate-100"
          }`}
        >
          <p className="text-sm font-semibold">{toast.title}</p>
          <p className="mt-1 text-xs opacity-80">{toast.message}</p>
        </button>
      ))}
    </div>
  );
};
