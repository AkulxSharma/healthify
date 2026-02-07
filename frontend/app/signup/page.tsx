"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { signUpWithEmail } from "@/lib/supabaseClient";

const profileOptions = ["Student", "Worker", "Athlete", "Creator", "Caregiver"];
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profileType, setProfileType] = useState(profileOptions[0]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      setLoading(true);
      const response = await signUpWithEmail(email, password);
      if (response.error) {
        setError(response.error.message);
        return;
      }
      const verificationResponse = await fetch(`${API_BASE}/auth/verify-email/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!verificationResponse.ok) {
        const payload = await verificationResponse.json().catch(() => ({}));
        const retryAfter =
          Number(payload?.retry_after_seconds ?? 0) ||
          Number(verificationResponse.headers.get("Retry-After") ?? 0);
        if (verificationResponse.status === 429 && retryAfter > 0) {
          const minutes = Math.max(1, Math.ceil(retryAfter / 60));
          setError(`You’ve requested too many emails. Please try again in ${minutes} minutes.`);
          return;
        }
        const detail = payload?.detail || "Unable to send verification email.";
        setError(detail);
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign up.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6">
        <div>
          <p className="text-sm text-slate-400">Create your profile</p>
          <h1 className="mt-2 text-2xl font-semibold">Join LifeMosaic</h1>
        </div>
        <form onSubmit={handleSignup} className="space-y-4">
          <input
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 outline-none"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 outline-none"
            required
          />
          <select
            value={profileType}
            onChange={(event) => setProfileType(event.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 outline-none"
          >
            {profileOptions.map((option) => (
              <option key={option} value={option} className="text-slate-900">
                {option}
              </option>
            ))}
          </select>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-emerald-500/20 px-4 py-3 text-sm text-emerald-200"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
      </main>
    </div>
  );
}
