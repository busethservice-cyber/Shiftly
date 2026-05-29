"use client";

import { useEffect, useState } from "react";
import { cn } from "@/app/lib/cn";

export type StatusToastState = {
  message: string;
  tone?: "neutral" | "negative";
} | null;

export function useStatusToast(autoHideMs = 3200) {
  const [toast, setToast] = useState<StatusToastState>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), autoHideMs);
    return () => window.clearTimeout(t);
  }, [toast, autoHideMs]);

  return { toast, setToast, showToast: (message: string, tone: "neutral" | "negative" = "neutral") => setToast({ message, tone }) };
}

export function StatusToast({ toast }: { toast: StatusToastState }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-6 left-1/2 z-50 w-[min(100vw-1.25rem,16rem)] -translate-x-1/2 rounded-xl px-2.5 py-1.5 text-[11px] font-medium leading-snug shadow-sm backdrop-blur-sm",
        toast.tone === "negative"
          ? "border border-rose-200/65 bg-rose-50/88 text-rose-900/95 shadow-[0_3px_10px_rgba(190,18,60,0.06)]"
          : "border border-slate-200/55 bg-white/82 text-slate-700 shadow-[0_3px_12px_rgba(15,23,42,0.05)]",
      )}
    >
      {toast.message}
    </div>
  );
}
