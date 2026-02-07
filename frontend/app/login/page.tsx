"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { signInWithEmail } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      setLoading(true);
      const response = await signInWithEmail(email, password);
      if (response.error) {
        setError(response.error.message);
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to log in.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6">
        <div>
          <p className="text-sm text-slate-400">Welcome back</p>
          <h1 className="mt-2 text-2xl font-semibold">Log in to LifeMosaic</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
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
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-emerald-500/20 px-4 py-3 text-sm text-emerald-200"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
      </main>
    </div>
  );
}
