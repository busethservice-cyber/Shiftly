import { Suspense } from "react";
import { LoginForm } from "@/app/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-[#F3F6FB] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[520px] items-center px-4 py-10 sm:px-6">
        <div className="w-full rounded-[28px] bg-white/85 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] backdrop-blur">
          <div className="text-[24px] font-semibold tracking-tight">Logg inn</div>
          <p className="mt-2 text-[13px] font-medium text-slate-600">
            Bruk e-post og passord for å logge inn i Shiftly.
          </p>
          <div className="mt-6">
            <Suspense fallback={<div className="text-[13px] font-medium text-slate-500">Laster innlogging…</div>}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

