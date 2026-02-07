"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signInWithEmail, signUpWithEmail } from "@/lib/supabaseClient";

type AuthMode = "signup" | "login";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      const response =
        mode === "signup"
          ? await signUpWithEmail(email, password)
          : await signInWithEmail(email, password);
      if (response.error) {
        setError(response.error.message);
        return;
      }
      if (mode === "signup") {
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
      }
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="email"
        placeholder="you@email.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
      />
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
      />
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Working..." : mode === "signup" ? "Create account" : "Log in"}
      </Button>
    </form>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>LifeMosaic</CardTitle>
            <CardDescription>Sign up or log in to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(value) => setMode(value as AuthMode)}>
              <TabsList>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
                <TabsTrigger value="login">Log in</TabsTrigger>
              </TabsList>
              <TabsContent value="signup">{form}</TabsContent>
              <TabsContent value="login">{form}</TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
