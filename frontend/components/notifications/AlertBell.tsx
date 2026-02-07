"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { getAlerts, markAlertRead, type AlertItem } from "@/lib/notifications";

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

export const AlertBell = () => {
  const router = useRouter();
  const { user } = useSupabaseSession();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const unreadCount = useMemo(() => alerts.filter((alert) => !alert.read).length, [alerts]);

  useEffect(() => {
    if (!user) {
      return;
    }
    let active = true;
    const loadUnread = async () => {
      try {
        const unreadAlerts = await getAlerts(true);
        if (!active) {
          return;
        }
        setAlerts((prev) => {
          const merged = [...unreadAlerts, ...prev.filter((row) => row.read)];
          const lookup = new Map(merged.map((row) => [row.id, row]));
          return Array.from(lookup.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
        });
      } catch {
        if (!active) {
          return;
        }
      }
    };
    loadUnread();
    const timer = window.setInterval(loadUnread, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user]);

  useEffect(() => {
    if (!open || !user) {
      return;
    }
    let active = true;
    setLoading(true);
    getAlerts()
      .then((data) => {
        if (!active) {
          return;
        }
        setAlerts(data);
        const unread = data.filter((row) => !row.read);
        unread.forEach((row) => {
          void markAlertRead(row.id);
        });
        if (unread.length) {
          setAlerts((prev) => prev.map((row) => ({ ...row, read: true })));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [open, user]);

  if (!user) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        type="button"
        className="relative h-10 w-10 rounded-full bg-transparent p-0 text-slate-200 hover:bg-slate-900"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-xs text-white">
            {unreadCount}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-3 w-80 rounded-2xl border border-slate-800 bg-slate-950/95 p-3 text-sm shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Alerts</p>
            <Button
              type="button"
              className="h-7 bg-transparent px-2 text-xs text-slate-300 hover:bg-slate-900"
              onClick={() => {
                const unread = alerts.filter((row) => !row.read);
                unread.forEach((row) => void markAlertRead(row.id));
                if (unread.length) {
                  setAlerts((prev) => prev.map((row) => ({ ...row, read: true })));
                }
              }}
            >
              Clear all
            </Button>
          </div>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {loading ? <p className="text-xs text-slate-400">Loading alerts...</p> : null}
            {!loading && alerts.length === 0 ? (
              <p className="text-xs text-slate-400">No alerts yet.</p>
            ) : null}
            {alerts.map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => {
                  if (alert.action_link) {
                    router.push(alert.action_link);
                  }
                }}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-left transition hover:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-100">{alert.title}</p>
                  <span className="text-xs text-slate-400">{formatTime(alert.created_at)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-300">{alert.message}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
