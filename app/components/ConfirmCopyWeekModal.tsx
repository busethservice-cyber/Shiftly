"use client";

import { cn } from "@/app/lib/cn";

export function ConfirmCopyWeekModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        onClick={onCancel}
        className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px]"
        aria-label="Lukk"
      />

      <div className="absolute left-1/2 top-1/2 w-[360px] -translate-x-1/2 -translate-y-1/2 p-4">
        <div className="rounded-[28px] bg-white/90 p-5 shadow-[0_28px_70px_rgba(15,23,42,0.18)] ring-1 ring-slate-900/[0.06] backdrop-blur">
          <div className="text-[14px] font-semibold text-slate-900">Kopier uke</div>
          <div className="mt-2 text-[12.5px] font-medium text-slate-600">
            Vil du kopiere denne uken til neste uke?
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-2xl bg-violet-600 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_18px_36px_rgba(124,58,237,0.28)] hover:bg-violet-500"
            >
              Ja
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={cn(
                "flex-1 rounded-2xl bg-white/70 px-4 py-2.5 text-[13.5px] font-semibold text-slate-700",
                "shadow-[0_14px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:bg-white",
              )}
            >
              Avbryt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

