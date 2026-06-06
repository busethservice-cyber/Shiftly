"use client";

import type { Shift } from "@/app/lib/types";
import { cn } from "@/app/lib/cn";
import { getStatusPalette } from "@/app/lib/statusColors";
import { useStores } from "@/app/components/StoresProvider";
import { isShiftOff } from "@/app/lib/hours";

function timeRangeLabel(start: string, end: string): string {
  return `${start}–${end}`;
}

export function ShiftChip({
  shift,
  employeeName,
  showStoreName = false,
  onClick,
  onContextMenu,
  hasAlert,
}: {
  shift: Shift;
  employeeName?: string;
  showStoreName?: boolean;
  onClick: (shift: Shift, anchorRect: DOMRect) => void;
  onContextMenu?: (shift: Shift, x: number, y: number) => void;
  hasAlert?: boolean;
}) {
  const { stores } = useStores();
  const storeName = shift.storeId ? stores.find((s) => s.id === shift.storeId)?.name ?? "" : "";
  const isOff = isShiftOff(shift);
  const palette = getStatusPalette(isOff ? "unconfirmed" : shift.status);
  const timeLabel = isOff ? "Fri" : shift.startTime && shift.endTime ? timeRangeLabel(shift.startTime, shift.endTime) : "—";
  const nameLabel = employeeName?.trim() || "Ansatt";

  return (
    <button
      type="button"
      onClick={(e) => onClick(shift, (e.currentTarget as HTMLButtonElement).getBoundingClientRect())}
      onContextMenu={(e) => {
        if (!onContextMenu) return;
        e.preventDefault();
        onContextMenu(shift, e.clientX, e.clientY);
      }}
      className={cn(
        "group relative inline-flex w-full min-h-[54px] items-center justify-center rounded-2xl px-3 pb-2 pt-7 text-center shadow-[0_10px_22px_rgba(15,23,42,0.07)] ring-1 ring-black/[0.04]",
        "overflow-hidden",
        palette.pillBg,
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-200",
      )}
      title={!isOff ? `${timeLabel} · ${nameLabel}${storeName ? ` · ${storeName}` : ""}` : timeLabel}
    >
      <span
        className={cn(
          "absolute left-2 top-1.5 rounded-full px-2 py-0.5 text-[9.5px] font-semibold ring-1 ring-black/[0.03]",
          (shift.publishState ?? "draft") === "published"
            ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
            : "bg-white/60 text-slate-600 ring-slate-900/[0.06]",
        )}
      >
        {(shift.publishState ?? "draft") === "published" ? "Publisert" : "Utkast"}
      </span>
      {hasAlert ? (
        <span
          className="absolute right-2 top-2 inline-block size-2 rounded-full bg-rose-500 ring-2 ring-white/70"
          aria-hidden="true"
        />
      ) : null}
      <span className="flex min-w-0 flex-col items-center gap-0.5 px-0.5">
        <span className={cn("truncate whitespace-nowrap text-[13px] font-bold tracking-tight", palette.pillText)}>
          {timeLabel}
        </span>
        <span className={cn("max-w-full truncate whitespace-nowrap text-[11.5px] font-semibold", palette.pillSubtext)}>
          {nameLabel}
        </span>
        {!isOff && showStoreName && storeName ? (
          <span className="max-w-full truncate whitespace-nowrap text-[10.5px] font-medium text-slate-500">{storeName}</span>
        ) : null}
      </span>
    </button>
  );
}
