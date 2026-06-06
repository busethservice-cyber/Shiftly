"use client";

import { useEffect, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { Shift } from "@/app/lib/types";
import { ShiftChip } from "@/app/components/ShiftChip";
import { cn } from "@/app/lib/cn";

export function DraggableShiftChip({
  shift,
  employeeName,
  showStoreName,
  onClick,
  onContextMenu,
  hasAlert,
  dragEnabled = true,
}: {
  shift: Shift;
  employeeName?: string;
  showStoreName?: boolean;
  onClick: (shift: Shift, anchorRect: DOMRect) => void;
  onContextMenu?: (shift: Shift, x: number, y: number) => void;
  hasAlert?: boolean;
  dragEnabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: shift.id,
    data: { type: "shift" as const, shiftId: shift.id },
    disabled: !dragEnabled,
  });

  const wasDraggingRef = useRef(false);
  useEffect(() => {
    if (isDragging) wasDraggingRef.current = true;
  }, [isDragging]);

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0) scale(${isDragging ? 1.03 : 1})`
      : undefined,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "w-full min-w-0 transition-transform duration-150 ease-out",
        isDragging && "drop-shadow-[0_18px_38px_rgba(15,23,42,0.18)]",
      )}
    >
      <div
        {...(dragEnabled ? listeners : {})}
        {...(dragEnabled ? attributes : {})}
        onClickCapture={(e) => {
          if (wasDraggingRef.current) {
            e.preventDefault();
            e.stopPropagation();
            wasDraggingRef.current = false;
          }
        }}
      >
        <ShiftChip
          shift={shift}
          employeeName={employeeName}
          showStoreName={showStoreName}
          onClick={onClick}
          onContextMenu={onContextMenu}
          hasAlert={hasAlert}
        />
      </div>
    </div>
  );
}
