"use client";

import { Bell, ChevronLeft, ChevronRight, Copy, Plus, Search } from "lucide-react";
import type { ReportTabId } from "@/app/lib/types";
import { cn } from "@/app/lib/cn";
import { WeekNavigator } from "@/app/components/WeekNavigator";
import { useAlerts } from "@/app/components/AlertsProvider";

export function TopBar({
  alertsCount,
  onBellClick,
  mode = "schedule",
  title = "Planlegg",
  weekStartDate,
  onWeekChange,
  onCopyWeek,
  scheduleStoreValue,
  onScheduleStoreChange,
  scheduleStoreOptions,
  onPublishWeek,
  onAutoPlanWeek,
  onExportPdf,
  onExportExcel,
  searchValue,
  onSearchChange,
  primaryActionLabel,
  onPrimaryAction,
  reportWeekStartDate,
  onReportWeekChange,
  reportStoreValue,
  onReportStoreChange,
  reportStoreOptions,
  reportTab,
  onReportTabChange,
  reportTabs,
  onNewShift,
}: {
  alertsCount?: number;
  onBellClick: (anchorRect: DOMRect) => void;
  mode?: "schedule" | "employees" | "stores" | "settings" | "overview" | "reports";
  title?: string;
  weekStartDate?: Date;
  onWeekChange?: (newWeekStartDate: Date) => void;
  onCopyWeek?: () => void;
  scheduleStoreValue?: string;
  onScheduleStoreChange?: (value: string) => void;
  scheduleStoreOptions?: Array<{ value: string; label: string }>;
  onPublishWeek?: () => void;
  onAutoPlanWeek?: () => void;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  reportWeekStartDate?: Date;
  onReportWeekChange?: (newWeekStartDate: Date) => void;
  reportStoreValue?: string;
  onReportStoreChange?: (value: string) => void;
  reportStoreOptions?: Array<{ value: string; label: string }>;
  reportTab?: ReportTabId;
  onReportTabChange?: (tab: ReportTabId) => void;
  reportTabs?: Array<{ id: ReportTabId; label: string }>;
  onNewShift?: () => void;
}) {
  const { alertCount, alertsHydrated } = useAlerts();
  const effectiveAlertsCount = typeof alertsCount === "number" ? alertsCount : alertCount;
  return (
    <header className="flex items-start justify-between gap-6">
      <div>
        <div className="text-[26px] font-semibold tracking-tight text-slate-900">{title}</div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {mode === "schedule" ? (
            <>
              {weekStartDate && onWeekChange ? <WeekNavigator weekStartDate={weekStartDate} onWeekChange={onWeekChange} /> : null}

              <button
                type="button"
                onClick={onCopyWeek}
                className="flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-2.5 text-[13.5px] font-semibold text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] hover:bg-white"
              >
                <Copy className="size-[18px] text-slate-500" />
                <span>Kopier uke</span>
              </button>

              <button
                type="button"
                onClick={onAutoPlanWeek}
                className="flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-2.5 text-[13.5px] font-semibold text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] hover:bg-white"
              >
                <span>Auto-planlegg</span>
              </button>

              <button
                type="button"
                onClick={onExportPdf}
                className="flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-2.5 text-[13.5px] font-semibold text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] hover:bg-white"
              >
                <span>Eksporter PDF</span>
              </button>

              <button
                type="button"
                onClick={onExportExcel}
                className="flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-2.5 text-[13.5px] font-semibold text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] hover:bg-white"
              >
                <span>Eksporter Excel</span>
              </button>

              <button
                type="button"
                onClick={onPublishWeek}
                className="flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_18px_36px_rgba(124,58,237,0.28)] hover:bg-violet-500"
              >
                <span>Publiser ukeplan</span>
              </button>

              {scheduleStoreOptions ? (
                <div className="min-w-[220px]">
                  <select
                    value={scheduleStoreValue ?? "alle"}
                    onChange={(e) => onScheduleStoreChange?.(e.target.value)}
                    className="w-full rounded-2xl bg-white/70 px-4 py-2.5 text-[13.5px] font-semibold text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] focus:outline-none focus:ring-2 focus:ring-violet-200"
                    aria-label="Butikk"
                  >
                    {scheduleStoreOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </>
          ) : mode === "employees" ? (
            <>
              <div className="relative w-[min(520px,calc(100vw-520px))] min-w-[240px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  value={searchValue ?? ""}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder="Søk etter ansatt..."
                  className="w-full rounded-2xl bg-white/70 py-2.5 pl-10 pr-3 text-[13.5px] font-semibold text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>

              <button
                type="button"
                onClick={onPrimaryAction}
                className="flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_18px_36px_rgba(124,58,237,0.28)] hover:bg-violet-500"
              >
                <span>{primaryActionLabel ?? "Ny ansatt"}</span>
              </button>
            </>
          ) : mode === "stores" ? (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_18px_36px_rgba(124,58,237,0.28)] hover:bg-violet-500"
            >
              <span>{primaryActionLabel ?? "+ Ny butikk"}</span>
            </button>
          ) : mode === "settings" ? (
            <p className="text-[13.5px] font-medium leading-relaxed text-slate-600">
              Regler, standarder og varsler for planlegging og rapportering.
            </p>
          ) : mode === "overview" ? (
            <>
              {reportWeekStartDate && onReportWeekChange ? (
                <WeekNavigator weekStartDate={reportWeekStartDate} onWeekChange={onReportWeekChange} />
              ) : null}

              <div className="min-w-[200px]">
                <select
                  value={reportStoreValue ?? "alle"}
                  onChange={(e) => onReportStoreChange?.(e.target.value)}
                  className="w-full rounded-2xl bg-white/70 px-4 py-2.5 text-[13.5px] font-semibold text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] focus:outline-none focus:ring-2 focus:ring-violet-200"
                  aria-label="Butikk"
                >
                  {(reportStoreOptions ?? [{ value: "alle", label: "Alle butikker" }]).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : mode === "reports" ? (
            <>
              {reportWeekStartDate && onReportWeekChange ? (
                <WeekNavigator weekStartDate={reportWeekStartDate} onWeekChange={onReportWeekChange} />
              ) : null}

              <div className="min-w-[200px]">
                <select
                  value={reportStoreValue ?? "alle"}
                  onChange={(e) => onReportStoreChange?.(e.target.value)}
                  className="w-full rounded-2xl bg-white/70 px-4 py-2.5 text-[13.5px] font-semibold text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] focus:outline-none focus:ring-2 focus:ring-violet-200"
                  aria-label="Butikk"
                >
                  {(reportStoreOptions ?? [{ value: "alle", label: "Alle butikker" }]).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={onExportPdf}
                className="flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-2.5 text-[13.5px] font-semibold text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] hover:bg-white"
              >
                <span>Eksporter PDF</span>
              </button>

              <button
                type="button"
                onClick={onExportExcel}
                className="flex items-center gap-2 rounded-2xl bg-white/70 px-4 py-2.5 text-[13.5px] font-semibold text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] hover:bg-white"
              >
                <span>Eksporter Excel</span>
              </button>

              <div className="flex w-full max-w-[520px] flex-wrap gap-2 rounded-2xl bg-white/70 p-1.5 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]">
                {(reportTabs ?? []).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onReportTabChange?.(t.id)}
                    className={cn(
                      "rounded-xl px-3 py-2 text-[12.5px] font-semibold transition-colors",
                      reportTab === t.id ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          className="grid size-11 place-items-center rounded-2xl bg-white/70 text-slate-500 shadow-[0_14px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] hover:bg-white"
          aria-label="Søk"
        >
          <Search className="size-[18px]" />
        </button>

        <button
          type="button"
          className="relative grid size-11 place-items-center rounded-2xl bg-white/70 text-slate-500 shadow-[0_14px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] hover:bg-white"
          aria-label="Varsler"
          onClick={(e) => onBellClick(e.currentTarget.getBoundingClientRect())}
        >
          <Bell className="size-[18px]" />
          {alertsHydrated && effectiveAlertsCount > 0 ? (
            <>
              <span className="absolute right-2 top-2 inline-block size-2 rounded-full bg-rose-500 ring-2 ring-white/70" />
              <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                {effectiveAlertsCount}
              </span>
            </>
          ) : null}
        </button>

        {mode === "schedule" ? (
          <button
            type="button"
            onClick={onNewShift}
            className="flex items-center gap-2 rounded-2xl bg-violet-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_18px_36px_rgba(124,58,237,0.28)] hover:bg-violet-500"
          >
            <Plus className="size-[18px]" />
            <span>Ny vakt</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}

