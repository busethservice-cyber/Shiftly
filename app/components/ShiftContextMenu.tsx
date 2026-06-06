"use client";

import { useEffect } from "react";
import { Copy } from "lucide-react";

export function ShiftContextMenu({
  open,
  x,
  y,
  onCopy,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  onCopy: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onClick() {
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("click", onClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed z-[100] min-w-[160px] overflow-hidden rounded-xl bg-white/95 py-1 shadow-[0_18px_40px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/[0.08] backdrop-blur"
      style={{ top: y, left: x }}
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onCopy();
          onClose();
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold text-slate-800 hover:bg-violet-50"
      >
        <Copy className="size-4 text-slate-500" />
        Kopier vakt
      </button>
    </div>
  );
}
