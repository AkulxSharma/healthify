"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

function VerifyEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);

  useEffect(() => {
    const initialEmail = params.get("email");
    if (initialEmail) {
      setResendEmail(initialEmail);
    }
  }, [params]);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }
    let active = true;
    setStatus("loading");
    fetch(`${API_BASE}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          const detail = payload?.detail || "Unable to verify email.";
          throw new Error(detail);
        }
        return response.json();
      })
      .then(() => {
        if (!active) {
          return;
        }
        setStatus("success");
        setMessage("Your email is verified. You can log in now.");
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        const detail = err instanceof Error ? err.message : "Unable to verify email.";
        setStatus("error");
        setMessage(detail);
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownSeconds(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownSeconds(remaining);
      if (remaining <= 0) {
        setCooldownUntil(null);
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, [cooldownUntil]);

  const handleResend = async () => {
    setResendMessage("");
    if (!resendEmail.trim()) {
      setResendMessage("Enter your email to resend the verification link.");
      return;
    }
    try {
      setResendLoading(true);
      const response = await fetch(`${API_BASE}/auth/verify-email/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const retryAfter =
          Number(payload?.retry_after_seconds ?? 0) ||
          Number(response.headers.get("Retry-After") ?? 0);
        if (response.status === 429 && retryAfter > 0) {
          setCooldownUntil(Date.now() + retryAfter * 1000);
          const minutes = Math.max(1, Math.ceil(retryAfter / 60));
          setResendMessage(
            `You’ve requested too many emails. Please try again in ${minutes} minutes.`
          );
          return;
        }
        const detail = payload?.detail || "Unable to resend verification email.";
        setResendMessage(detail);
        return;
      }
      if (payload?.status === "verified") {
        setResendMessage("Email verified in development. You can log in now.");
        return;
      }
      setResendMessage("Verification email sent. Check your inbox.");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unable to resend verification email.";
      setResendMessage(detail);
    } finally {
      setResendLoading(false);
    }
  };

  const description =
    status === "loading"
      ? "Verifying your email..."
      : status === "success"
        ? "Email verified"
        : "Verification status";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Verify your email</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {message ? <p className="text-sm text-slate-300">{message}</p> : null}
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">Resend verification</p>
              <Input
                type="email"
                placeholder="you@email.com"
                value={resendEmail}
                onChange={(event) => setResendEmail(event.target.value)}
                autoComplete="email"
              />
              {resendMessage ? <p className="text-sm text-slate-300">{resendMessage}</p> : null}
              <Button
                type="button"
                onClick={handleResend}
                disabled={resendLoading || (cooldownSeconds != null && cooldownSeconds > 0)}
                className="w-full"
              >
                {cooldownSeconds != null && cooldownSeconds > 0
                  ? `Resend available in ${cooldownSeconds}s`
                  : resendLoading
                    ? "Sending..."
                    : "Resend email"}
              </Button>
            </div>
            <Button type="button" onClick={() => router.push("/auth")}>
              Go to login
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-100">
          <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Verify your email</CardTitle>
                <CardDescription>Loading verification...</CardDescription>
              </CardHeader>
            </Card>
          </main>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
