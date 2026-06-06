"use client";

import { cn } from "@/app/lib/cn";
import { CalendarDays, CalendarX, Copy } from "lucide-react";

export function PlannerToolbar({
  disabled,
  onCopyDay,
  onCopyWeek,
  onClearDay,
}: {
  disabled?: boolean;
  onCopyDay: () => void;
  onCopyWeek: () => void;
  onClearDay: () => void;
}) {
  const btn =
    "inline-flex items-center gap-1.5 rounded-xl bg-white/75 px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.05] hover:bg-white disabled:cursor-not-allowed disabled:opacity-45";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Verktøy</span>
      <button type="button" disabled={disabled} onClick={onCopyDay} className={cn(btn)}>
        <CalendarDays className="size-3.5 text-slate-500" />
        Kopier dag
      </button>
      <button type="button" disabled={disabled} onClick={onCopyWeek} className={cn(btn)}>
        <Copy className="size-3.5 text-slate-500" />
        Kopier uke
      </button>
      <button type="button" disabled={disabled} onClick={onClearDay} className={cn(btn, "hover:text-rose-700 hover:ring-rose-100")}>
        <CalendarX className="size-3.5 text-slate-500" />
        Fjern dag
      </button>
    </div>
  );
}
