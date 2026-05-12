"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { schedulePostLoginBootstrap, signInWithEmailPassword } from "@/app/lib/auth";
import { safeInternalNext } from "@/app/lib/loginRedirect";
import { cn } from "@/app/lib/cn";
import { useInvites } from "@/app/components/InvitesProvider";

function formatSignInError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  return "Kunne ikke logge inn";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { removeInviteByEmail } = useInvites();
  const safetyTimerRef = useRef<number | null>(null);

  const nextPath = safeInternalNext(searchParams.get("next"));

  useEffect(() => {
    return () => {
      if (safetyTimerRef.current != null) {
        clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
      }
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // eslint-disable-next-line no-console
    console.info("[Shiftly][login-debug] submit started");
    // eslint-disable-next-line no-console
    console.info("[Shiftly][login-debug] email present", Boolean(email.trim()));
    // eslint-disable-next-line no-console
    console.info("[Shiftly][login-debug] supabase URL configured", Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL));
    // eslint-disable-next-line no-console
    console.info("[Shiftly][login-debug] anon key configured", Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
    // eslint-disable-next-line no-console
    console.info("[Shiftly][login-debug] next redirect path", nextPath);

    if (safetyTimerRef.current != null) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    safetyTimerRef.current = window.setTimeout(() => {
      safetyTimerRef.current = null;
      if (typeof window !== "undefined" && window.location.pathname.endsWith("/login")) {
        console.warn("[Shiftly][login-debug] still on /login after 5s; forcing navigation", { to: nextPath });
        window.location.assign(nextPath);
      }
      setLoading(false);
    }, 5000);

    try {
      const data = await signInWithEmailPassword(email.trim(), password);
      // eslint-disable-next-line no-console
      console.info("[Shiftly][login-debug] signIn returned");

      if (!data.session) {
        // eslint-disable-next-line no-console
        console.warn("[Shiftly][login-debug] session missing after signIn");
        if (safetyTimerRef.current != null) {
          clearTimeout(safetyTimerRef.current);
          safetyTimerRef.current = null;
        }
        setError(
          "Innloggingen lyktes, men økt (session) ble ikke opprettet. Sjekk at informasjonskapsler er tillatt, eller prøv igjen.",
        );
        setLoading(false);
        return;
      }

      // eslint-disable-next-line no-console
      console.info("[Shiftly][login-debug] session exists after signIn", true);

      removeInviteByEmail(email.trim());
      schedulePostLoginBootstrap(data.user);

      // eslint-disable-next-line no-console
      console.info("[Shiftly][login-debug] redirect attempted", { to: nextPath });
      try {
        router.replace(nextPath);
      } catch (navErr) {
        console.error("[Shiftly][login-debug] router.replace failed", navErr instanceof Error ? navErr.message : navErr);
        window.location.assign(nextPath);
      }

      window.setTimeout(() => {
        if (typeof window !== "undefined" && window.location.pathname.endsWith("/login")) {
          console.warn("[Shiftly][login-debug] still on /login after soft navigation; hard navigating", { to: nextPath });
          window.location.assign(nextPath);
        }
      }, 400);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.info("[Shiftly][login-debug] signIn failed");
      logSignInFailureClient(err);
      if (safetyTimerRef.current != null) {
        clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
      }
      setError(formatSignInError(err));
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

function logSignInFailureClient(err: unknown): void {
  if (err && typeof err === "object" && "message" in err) {
    const code = "code" in err && typeof (err as { code?: unknown }).code === "string" ? (err as { code: string }).code : undefined;
    // eslint-disable-next-line no-console
    console.info("[Shiftly][login-debug] signIn error detail", code ? { code, message: String((err as { message?: unknown }).message) } : { message: String((err as { message?: unknown }).message) });
    return;
  }
  // eslint-disable-next-line no-console
  console.info("[Shiftly][login-debug] signIn error detail", err);
}
