"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/app/lib/cn";

export function cellId(employeeId: string, day: number) {
  return `cell:${employeeId}:${day}`;
}

export function parseCellId(id: string) {
  const parts = id.split(":");
  if (parts.length !== 3) return null;
  if (parts[0] !== "cell") return null;
  const employeeId = parts[1] ?? "";
  const day = Number(parts[2]);
  if (!employeeId || !Number.isFinite(day)) return null;
  return { employeeId, day };
}

export function DroppableDayCell({
  id,
  disabled,
  className,
  children,
}: {
  id: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled: Boolean(disabled) });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        className,
        // Subtle hover highlight for valid drop zones
        isOver && !disabled && "relative",
      )}
    >
      <div
        className={cn(
          "h-full w-full rounded-[22px] transition-colors",
          isOver && !disabled && "ring-2 ring-violet-200/80 bg-violet-50/30",
        )}
      >
        {children}
      </div>
    </div>
  );
}

