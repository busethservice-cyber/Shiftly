"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import type { AlertItem } from "@/app/lib/rules/alerts";
import { cn } from "@/app/lib/cn";
import { AlertTriangle, Ban, Info, X } from "lucide-react";

function severityStyles(severity: AlertItem["severity"]) {
  if (severity === "critical") {
    return {
      chip: "bg-[#FFD6DC] text-slate-900 ring-1 ring-black/[0.03]",
      dot: "bg-rose-500",
      icon: "text-rose-500",
    };
  }
  if (severity === "warning") {
    return {
      chip: "bg-[#FFF0C9] text-slate-900 ring-1 ring-black/[0.03]",
      dot: "bg-amber-400",
      icon: "text-amber-500",
    };
  }
  return {
    chip: "bg-[#EEF1F6] text-slate-800 ring-1 ring-black/[0.03]",
    dot: "bg-slate-300",
    icon: "text-slate-500",
  };
}

function kindIcon(type: AlertItem["type"]) {
  if (type === "unavailable_conflict") return Ban;
  if (type === "over_contract" || type === "near_contract") return AlertTriangle;
  return Info;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function AlertsPanel({
  open,
  anchorRect,
  alerts,
  onClose,
}: {
  open: boolean;
  anchorRect: DOMRect | null;
  alerts: AlertItem[];
  onClose: () => void;
}) {
  const count = alerts.length;
  const top = useMemo(() => alerts.slice(0, 5), [alerts]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const pos = useMemo(() => {
    if (!anchorRect) return { top: 0, left: 0 };
    const w = 320;
    const h = 520;
    const top = clamp(anchorRect.bottom + window.scrollY + 10, 12, window.scrollY + window.innerHeight - h - 12);
    const left = clamp(anchorRect.right + window.scrollX - w, 12, window.scrollX + window.innerWidth - w - 12);
    return { top, left };
  }, [anchorRect]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-transparent" aria-label="Lukk varsler" />

      <aside
        className="absolute w-[320px]"
        style={{ top: pos.top, left: pos.left }}
        role="dialog"
        aria-label="Varsler"
      >
        <div className="rounded-[28px] bg-white/90 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.10)] ring-1 ring-slate-900/[0.06] backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-1 pb-3">
          <div className="flex items-center gap-2">
            <div className="text-[14px] font-semibold text-slate-900">Varsler</div>
            <div className="grid min-w-7 place-items-center rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
              {count}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-2xl bg-white/70 text-slate-500 shadow-[0_12px_24px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.05] hover:bg-white"
            aria-label="Lukk panel"
          >
            <X className="size-[16px]" />
          </button>
        </div>

        {count === 0 ? (
          <div className="rounded-3xl bg-[#F6F8FC] p-4 text-[12.5px] font-semibold text-slate-600 shadow-[0_12px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]">
            Ingen varsler akkurat nå.
          </div>
        ) : (
          <div className="max-h-[62vh] space-y-2 overflow-auto pr-1">
            {top.map((a) => {
              const s = severityStyles(a.severity);
              const Icon = kindIcon(a.type);
              return (
                <div
                  key={a.id}
                  className="rounded-3xl bg-white/70 p-3 shadow-[0_12px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05]"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("grid size-9 shrink-0 place-items-center rounded-2xl", s.chip)}>
                      <Icon className={cn("size-[18px]", s.icon)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("inline-block size-2 rounded-full", s.dot)} />
                        <div className="truncate text-[12.5px] font-semibold text-slate-900">{a.title}</div>
                      </div>
                      <div className="mt-1 text-[11.5px] font-medium text-slate-500">{a.description}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3 px-1 pt-2">
          <Link
            href="/varsler"
            onClick={onClose}
            className="text-[13px] font-semibold text-violet-700 hover:text-violet-600"
          >
            Se alle varsler
          </Link>
          <div className="text-[12px] font-medium text-slate-500">{count} totalt</div>
        </div>
      </div>
      </aside>
    </div>
  );
}

