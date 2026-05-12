"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/app/lib/auth";
import { cn } from "@/app/lib/cn";
import { useInvites } from "@/app/components/InvitesProvider";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { removeInviteByEmail } = useInvites();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      removeInviteByEmail(email.trim());
      router.replace("/oversikt");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kunne ikke logge inn";
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-[12px] font-semibold text-slate-600">E-post</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          required
          className="mt-2 w-full rounded-2xl bg-white/85 px-4 py-2.5 text-[13.5px] font-semibold text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
          placeholder="navn@firma.no"
        />
      </div>

      <div>
        <label className="text-[12px] font-semibold text-slate-600">Passord</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 w-full rounded-2xl bg-white/85 px-4 py-2.5 text-[13.5px] font-semibold text-slate-900 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
          placeholder="••••••••"
        />
      </div>

      {error ? (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-[12.5px] font-semibold text-rose-800 ring-1 ring-rose-100">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className={cn(
          "w-full rounded-2xl bg-violet-600 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_18px_36px_rgba(124,58,237,0.28)] hover:bg-violet-500",
          loading && "opacity-60 hover:bg-violet-600",
        )}
      >
        {loading ? "Logger inn…" : "Logg inn"}
      </button>
    </form>
  );
}

