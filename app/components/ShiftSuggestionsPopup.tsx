"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { SuggestionCandidate } from "@/app/lib/smartSuggestions";
import type { ShiftTemplate } from "@/app/lib/settings";
import { cn } from "@/app/lib/cn";
import { formatHours } from "@/app/lib/hours";
import { UserRound, Wand2 } from "lucide-react";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function ShiftSuggestionsPopup({
  open,
  anchorRect,
  dayLabel,
  shiftTemplates,
  suggestions,
  onPickEmployee,
  onPickManual,
  onPickTemplate,
  onClose,
}: {
  open: boolean;
  anchorRect: DOMRect | null;
  dayLabel: string;
  shiftTemplates?: ShiftTemplate[];
  suggestions: SuggestionCandidate[];
  onPickEmployee: (employeeId: string) => void;
  onPickManual: () => void;
  onPickTemplate?: (tpl: ShiftTemplate) => void;
  onClose: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number }>({ top: 0, left: 0, maxH: 360 });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const margin = 12;
  const gap = 10;

  const headerEstimate = useMemo(() => 56, []);

  useLayoutEffect(() => {
    if (!open || !anchorRect) return;

    function compute() {
      if (!anchorRect) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = 260;

      // Prefer to the right of the anchor; if not enough space, flip left.
      let left = anchorRect.right + gap;
      if (left + w > vw - margin) {
        left = anchorRect.left - gap - w;
      }
      left = clamp(left, margin, vw - w - margin);

      // Decide below vs above based on available space.
      const spaceBelow = vh - anchorRect.bottom - margin;
      const spaceAbove = anchorRect.top - margin;
      const preferBelow = spaceBelow >= spaceAbove;

      const maxBelow = Math.max(160, vh - anchorRect.bottom - margin - gap);
      const maxAbove = Math.max(160, anchorRect.top - margin - gap);
      let maxH = Math.min(360, preferBelow ? maxBelow : maxAbove);

      let top: number;
      if (preferBelow) {
        top = anchorRect.bottom + gap;
        const overflow = top + headerEstimate + maxH - (vh - margin);
        if (overflow > 0) {
          const reduced = maxH - overflow;
          maxH = Math.max(160, reduced);
          top = anchorRect.bottom + gap;
          const overflow2 = top + headerEstimate + maxH - (vh - margin);
          if (overflow2 > 0) top = Math.max(margin, top - overflow2);
        }
      } else {
        top = anchorRect.top - gap - maxH;
        top = clamp(top, margin, vh - margin - maxH);
      }

      setPos({ top, left, maxH });
    }

    compute();

    function onResize() {
      compute();
    }
    function onScroll() {
      compute();
    }

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [anchorRect, open, headerEstimate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-transparent" aria-label="Lukk forslag" />

      <div
        className="fixed w-[260px] overflow-hidden rounded-2xl bg-white/90 p-3 shadow-[0_22px_50px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/[0.06] backdrop-blur"
        style={{ top: pos.top, left: pos.left, maxHeight: pos.maxH + headerEstimate }}
        role="dialog"
        aria-label="Forslag til vakt"
      >
        <div className="flex items-center justify-between px-1 pb-2">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
              <Wand2 className="size-[16px]" />
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-slate-900">Forslag</div>
              <div className="text-[11.5px] font-medium text-slate-500">{dayLabel}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-2 py-1 text-[12px] font-semibold text-slate-400 hover:bg-slate-50 hover:text-slate-500"
          >
            Lukk
          </button>
        </div>

        <div
          className="space-y-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]"
          style={{ maxHeight: Math.max(120, pos.maxH - headerEstimate) }}
        >
          {shiftTemplates && shiftTemplates.length > 0 && onPickTemplate ? (
            <div className="mb-2 rounded-xl bg-[#F6F8FC]/90 px-2 py-2 ring-1 ring-slate-900/[0.05]">
              <div className="px-1 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                Velg standardvakt
              </div>
              <div className="flex max-h-[88px] flex-wrap gap-1 overflow-y-auto">
                {shiftTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => onPickTemplate(tpl)}
                    className="max-w-full truncate rounded-full bg-white/90 px-2.5 py-1 text-left text-[11px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-900/[0.06] hover:bg-violet-50 hover:text-violet-900 hover:ring-violet-200"
                    title={`${tpl.name} ${tpl.startTime}–${tpl.endTime}`}
                  >
                    {tpl.name}{" "}
                    <span className="font-medium text-slate-500">
                      {tpl.startTime}–{tpl.endTime}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {suggestions.map((s) => {
            return (
              <button
                key={s.employeeId}
                type="button"
                onClick={() => onPickEmployee(s.employeeId)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.05] hover:bg-slate-50/60"
              >
                <span className="inline-block size-2.5 rounded-full bg-violet-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-slate-900">{s.name}</div>
                  <div className="mt-0.5 text-[11.5px] font-medium text-slate-500">
                    Score {formatHours(s.score)}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {s.reasons.slice(0, 2).map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-white/70 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 ring-1 ring-slate-900/[0.05]"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onPickManual}
            className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-white/70 px-3 py-2.5 text-left shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.05] hover:bg-white"
          >
            <div className="grid size-8 place-items-center rounded-2xl bg-slate-50 text-slate-500 ring-1 ring-slate-200">
              <UserRound className="size-[16px]" />
            </div>
            <div className="text-[12.5px] font-semibold text-slate-700">+ Velg manuelt</div>
          </button>
        </div>
      </div>
    </div>
  );
}
