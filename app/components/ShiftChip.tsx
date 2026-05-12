"use client";

import type { Shift } from "@/app/lib/types";
import { cn } from "@/app/lib/cn";
import { getStatusPalette } from "@/app/lib/statusColors";
import { useStores } from "@/app/components/StoresProvider";
import { isShiftOff } from "@/app/lib/hours";

function timeRangeCompact(start: string, end: string) {
  const sh = start.split(":")[0] ?? start;
  const eh = end.split(":")[0] ?? end;
  return `${sh}–${eh}`;
}

function chipLabel(shift: Shift) {
  if (isShiftOff(shift)) return "Fri";
  if (!shift.startTime || !shift.endTime) return "TT";
  return timeRangeCompact(shift.startTime, shift.endTime);
}

export function ShiftChip({
  shift,
  onClick,
  hasAlert,
}: {
  shift: Shift;
  onClick: (shift: Shift) => void;
  hasAlert?: boolean;
}) {
  const { stores } = useStores();
  const storeName = shift.storeId ? stores.find((s) => s.id === shift.storeId)?.name ?? "" : "";
  const isOff = isShiftOff(shift);
  const palette = getStatusPalette(isOff ? "unconfirmed" : shift.status);
  const label = chipLabel(shift);
  const store = !isOff ? (storeName || "—") : "";

  return (
    <button
      type="button"
      onClick={() => onClick(shift)}
      className={cn(
        "group relative inline-flex w-full items-center justify-center rounded-2xl px-2.5 pb-1.5 pt-6 text-center shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.03]",
        "overflow-hidden",
        palette.pillBg,
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-200",
      )}
      title={!isOff ? `${label} • ${store}` : label}
    >
      <span
        className={cn(
          "absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-black/[0.03]",
          (shift.publishState ?? "draft") === "published"
            ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
            : "bg-white/60 text-slate-600 ring-slate-900/[0.06]",
        )}
      >
        {(shift.publishState ?? "draft") === "published" ? "Publisert" : "Utkast"}
      </span>
      {hasAlert ? (
        <span
          className="absolute right-1.5 top-1.5 inline-block size-2 rounded-full bg-rose-500 ring-2 ring-white/70"
          aria-hidden="true"
        />
      ) : null}
      <span className="flex min-w-0 flex-col items-center">
        <span className={cn("truncate whitespace-nowrap text-[12.5px] font-semibold tracking-tight", palette.pillText)}>
          {label}
        </span>
        {!isOff ? (
          <span className={cn("mt-0.5 max-w-full truncate whitespace-nowrap text-[11px] font-semibold", palette.pillSubtext)}>
            {store}
          </span>
        ) : null}
      </span>
    </button>
  );
}

