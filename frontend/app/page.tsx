import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-10 px-6 py-12 text-center">
        <div className="h-16 w-16 rounded-[28px] bg-gradient-to-br from-emerald-400 via-cyan-400 to-indigo-400" />
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold">LifeMosaic</h1>
          <p className="text-sm text-slate-400">
            Life telemetry for wallet, wellness, and sustainability. Track events, score them in real
            time, and visualize your day.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/login"
            className="rounded-full border border-slate-700 px-6 py-2 text-sm text-slate-200"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-emerald-500/20 px-6 py-2 text-sm text-emerald-200"
          >
            Create account
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-slate-700 px-6 py-2 text-sm text-slate-200"
          >
            View dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
