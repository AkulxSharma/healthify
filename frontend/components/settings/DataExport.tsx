"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { supabase } from "@/lib/supabaseClient";

type ExportStatus = {
  status: string;
  download_url?: string | null;
  expires_at?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

const getToken = async (): Promise<string> => {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Unable to authenticate.");
  }
  return data.session.access_token;
};

export const DataExport = () => {
  const { user } = useSupabaseSession();
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<ExportStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  const apiRoot = useMemo(() => API_BASE.replace(/\/api\/?$/, ""), []);

  const loadStatus = useCallback(
    async (targetJobId: string) => {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/account/export/${targetJobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("Unable to load export status.");
      }
      const payload = (await response.json()) as ExportStatus;
      setStatus(payload);
    },
    []
  );

  const requestExport = async () => {
    setError(null);
    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/account/export`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("Unable to start export.");
      }
      const payload = (await response.json()) as { job_id: string; status: string };
      setJobId(payload.job_id);
      setStatus({ status: payload.status });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start export.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!jobId || status?.status !== "processing") {
      return;
    }
    const timer = window.setInterval(() => {
      loadStatus(jobId).catch((err) => {
        const message = err instanceof Error ? err.message : "Unable to load export status.";
        setError(message);
      });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [jobId, loadStatus, status?.status]);

  useEffect(() => {
    if (!status?.expires_at) {
      return;
    }
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status?.expires_at]);

  const expiryLabel = useMemo(() => {
    if (!status?.expires_at) {
      return null;
    }
    const expiresAt = new Date(status.expires_at);
    const diffMs = expiresAt.getTime() - now.getTime();
    if (Number.isNaN(diffMs)) {
      return null;
    }
    if (diffMs <= 0) {
      return "Expired";
    }
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s remaining`;
  }, [now, status?.expires_at]);

  const downloadHref = useMemo(() => {
    const raw = status?.download_url;
    if (!raw) {
      return null;
    }
    if (raw.startsWith("http")) {
      return raw;
    }
    return `${apiRoot}${raw}`;
  }, [apiRoot, status?.download_url]);

  if (!user) {
    return <p className="text-sm text-slate-300">Sign in to request your export.</p>;
  }

  return (
    <div className="space-y-4 text-sm text-slate-200">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
        Download all your LifeMosaic data in JSON format. We generate a GDPR-compliant ZIP bundle that
        expires after 24 hours.
      </div>
      {status ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Export status</p>
          <p className="mt-1 text-sm text-slate-100">{status.status}</p>
          {status.status === "completed" && downloadHref ? (
            <div className="mt-3 space-y-1">
              <a
                href={downloadHref}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100"
              >
                Download export
              </a>
              {expiryLabel ? <p className="text-xs text-slate-400">{expiryLabel}</p> : null}
            </div>
          ) : null}
          {status.status === "failed" ? (
            <p className="mt-2 text-xs text-rose-300">Export failed. Please try again.</p>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      <Button type="button" onClick={requestExport} disabled={loading}>
        {loading ? "Requesting..." : "Request export"}
      </Button>
    </div>
  );
};
