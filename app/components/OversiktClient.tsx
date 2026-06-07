"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Employee, Shift, ShiftStatus } from "@/app/lib/types";
import type { AlertItem } from "@/app/lib/rules/alerts";
import { Sidebar } from "@/app/components/Sidebar";
import { TopBar } from "@/app/components/TopBar";
import { AlertsPanel } from "@/app/components/AlertsPanel";
import { useWorkforce } from "@/app/components/WorkforceProvider";
import { useStores } from "@/app/components/StoresProvider";
import { useSettings } from "@/app/components/SettingsProvider";
import { getScheduleWeekData } from "@/app/lib/scheduleWeekData";
import { buildScheduleExportModelFromWeekData, openSchedulePrintPreview } from "@/app/lib/exportSchedule";
import { addDays, baseWeekStart, dayShort, formatNorDate, monthsShort } from "@/app/lib/mockData";
import { formatHours, round1, shiftDurationHours, sumEmployeeWeekHours } from "@/app/lib/hours";
import { cn } from "@/app/lib/cn";
import { useAlerts } from "@/app/components/AlertsProvider";
import { CalendarPlus, ChevronRight, Download, Store, UserPlus } from "lucide-react";
import { useRequests } from "@/app/components/RequestsProvider";
import { EmployeeRequestsSection } from "@/app/components/EmployeeRequestsSection";
import { currentWeekOffset, isoFromDate, todayLocal, weekOffsetFromDate, weekStartDateFromOffset } from "@/app/lib/weekDate";
import { formatWeekLabel, getWeekStart } from "@/app/lib/dateUtils";
import { getContractStatus, getPlannedHoursForEmployee } from "@/app/lib/rules/contracts";
import { getStaffingStatusForDay } from "@/app/lib/rules/staffing";
import type { ContractStatus } from "@/app/lib/rules/contracts";
import {
  absenceTypeBadgeClass,
  getWeeklyAbsenceOverview,
} from "@/app/lib/absenceOverview";

function alertRank(s: AlertItem["severity"]) {
  if (s === "critical") return 0;
  if (s === "warning") return 1;
  return 2;
}

function severityStyles(sev: AlertItem["severity"]) {
  if (sev === "critical") return "border-l-4 border-l-rose-500 bg-rose-50/80 ring-rose-100";
  if (sev === "warning") return "border-l-4 border-l-amber-400 bg-amber-50/80 ring-amber-100";
  return "border-l-4 border-l-slate-300 bg-slate-50/90 ring-slate-200";
}

function contractBadge(status: ShiftStatus | ContractStatus) {
  if (status === "over") return "bg-rose-50 text-rose-800 ring-rose-100";
  if (status === "near") return "bg-amber-50 text-amber-900 ring-amber-100";
  if (status === "over_limit") return "bg-rose-50 text-rose-800 ring-rose-100";
  if (status === "near_limit") return "bg-amber-50 text-amber-900 ring-amber-100";
  if (status === "unconfirmed") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-emerald-50 text-emerald-900 ring-emerald-100";
}

function contractLabel(status: ShiftStatus | ContractStatus) {
  if (status === "over") return "Over kontrakt";
  if (status === "near") return "Nær grense";
  if (status === "over_limit") return "Over kontrakt";
  if (status === "near_limit") return "Nær grense";
  if (status === "unconfirmed") return "Ubekreftet";
  return "Innenfor";
}

export function OversiktClient() {
  const { employees, shifts } = useWorkforce();
  const { stores } = useStores();
  const { settings } = useSettings();
  const { activeAlerts, alertCount, alertsHydrated } = useAlerts();
  const { requests, pendingCount, approveRequest, rejectRequest, isMutating } = useRequests();

  const [weekOffset, setWeekOffset] = useState(() => currentWeekOffset());
  const [storeId, setStoreId] = useState<string>("alle");
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [alertsAnchorRect, setAlertsAnchorRect] = useState<DOMRect | null>(null);

  const days = useMemo(() => {
    const start = addDays(baseWeekStart, weekOffset * 7);
    return dayShort.map((short, idx) => {
      const d = addDays(start, idx);
      return { short, date: formatNorDate(d), dayIndex: idx };
    });
  }, [weekOffset]);

  const weekStartDate = useMemo(() => getWeekStart(weekStartDateFromOffset(weekOffset)), [weekOffset]);
  const weekLabel = useMemo(() => formatWeekLabel(weekStartDate), [weekStartDate]);
  const weekStartIso = useMemo(() => isoFromDate(weekStartDate), [weekStartDate]);

  const todayKey = useMemo(() => isoFromDate(todayLocal()), []);

  const selectedRetail = useMemo(
    () => (storeId === "alle" ? null : stores.find((s) => s.id === storeId) ?? null),
    [storeId, stores],
  );

  const scheduleData = useMemo(
    () =>
      getScheduleWeekData({
        employees,
        shifts,
        stores,
        weekOffset,
        selectedStoreId: storeId,
      }),
    [employees, shifts, stores, weekOffset, storeId],
  );

  const scopedShifts = scheduleData.shifts;
  const scopedEmployees = scheduleData.employees;
  const totalPlannedHours = scheduleData.totalPlannedHours;

  const topAlerts = useMemo(
    () => [...activeAlerts].sort((a, b) => alertRank(a.severity) - alertRank(b.severity)).slice(0, 5),
    [activeAlerts],
  );

  const exportModel = useMemo(() => buildScheduleExportModelFromWeekData(scheduleData), [scheduleData]);

  const reportRows = useMemo(() => {
    return scopedEmployees.map((e) => {
      const planned = getPlannedHoursForEmployee(e.id, scopedShifts);
      const status = getContractStatus(e, scopedShifts, settings);
      return { employeeId: e.id, name: e.name, contractHours: e.contractHours, plannedHours: planned, status };
    });
  }, [scopedEmployees, scopedShifts, settings]);

  const overContractCount = useMemo(() => reportRows.filter((r) => r.status === "over").length, [reportRows]);

  const staffingByDay = useMemo(() => {
    return days.map((d) => {
      const dayShifts = scopedShifts.filter((s) => s.day === d.dayIndex && shiftDurationHours(s) > 0);
      const { planned, required, status } = getStaffingStatusForDay(dayShifts, selectedRetail, d.dayIndex, settings);
      const gap = status === "understaffed" ? Math.max(0, required - planned) : 0;
      return { ...d, shiftCount: planned, required, gap };
    });
  }, [days, scopedShifts, selectedRetail, settings]);

  const daysUnderStaffed = useMemo(() => staffingByDay.filter((d) => d.gap > 0).length, [staffingByDay]);

  const activeEmployeeCount = scopedEmployees.length;

  const weeklyAbsence = useMemo(
    () => getWeeklyAbsenceOverview(scopedEmployees, weekOffset, 12),
    [scopedEmployees, weekOffset],
  );

  const absenceCount = weeklyAbsence.absenceEmployeeCount;
  const sickCount = weeklyAbsence.sickEmployeeCount;
  const upcomingAbsences = weeklyAbsence.rows;

  const nearEmployees = useMemo(() => {
    return reportRows
      .filter((r) => r.status === "near" || r.status === "over")
      .sort((a, b) => b.plannedHours / Math.max(0.1, b.contractHours) - a.plannedHours / Math.max(0.1, a.contractHours))
      .slice(0, 8);
  }, [reportRows]);

  const storeOptions = useMemo(
    () => [{ value: "alle", label: "Alle butikker" }, ...stores.map((s) => ({ value: s.id, label: s.name }))],
    [stores],
  );

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e.name] as const)), [employees]);

  return (
    <div className="min-h-screen w-full">
      <div className="mx-auto flex w-full max-w-[1280px] gap-7 px-6 py-6">
        <Sidebar
          onOpenAlerts={() => {
            setIsAlertsOpen(true);
            setAlertsAnchorRect(null);
          }}
        />

        <main className="min-w-0 flex-1 space-y-8 pb-10">
          <TopBar
            mode="overview"
            title="Oversikt"
            alertsCount={alertCount + pendingCount}
            onBellClick={(rect) => {
              setAlertsAnchorRect(rect);
              setIsAlertsOpen((v) => !v);
            }}
            reportWeekStartDate={weekStartDate}
            onReportWeekChange={(d) => setWeekOffset(weekOffsetFromDate(d))}
            reportStoreValue={storeId}
            onReportStoreChange={setStoreId}
            reportStoreOptions={storeOptions}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              {
                title: "Ansatte",
                value: String(activeEmployeeCount),
                hint: "Aktive i valgt område",
              },
              {
                title: "Fravær",
                value: String(absenceCount),
                hint: "Denne uken",
              },
              {
                title: "Sykmeldte",
                value: String(sickCount),
                hint: "Denne uken",
              },
              {
                title: "Planlagte timer",
                value: `${formatHours(totalPlannedHours)} t`,
                hint: "Valgt uke og butikk",
              },
              {
                title: "Over kontrakt",
                value: String(overContractCount),
                hint: "Plan vs kontrakt",
              },
              {
                title: "Underbemannede dager",
                value: String(daysUnderStaffed),
                hint: "Under minstekrav",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-3xl bg-white/80 p-5 shadow-[0_20px_44px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04] backdrop-blur"
              >
                <div className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">{c.title}</div>
                <div className="mt-2.5 text-[26px] font-semibold tracking-tight text-slate-900">{c.value}</div>
                <div className="mt-1.5 text-[11.5px] font-medium text-slate-500">{c.hint}</div>
              </div>
            ))}
          </div>

          <section className="rounded-3xl bg-white/80 p-6 shadow-[0_20px_44px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04] backdrop-blur">
            <h2 className="text-[17px] font-semibold text-slate-900">Kommende fravær</h2>
            <p className="mt-1 text-[13px] font-medium text-slate-500">Fravær i valgt uke.</p>
            <ul className="mt-5 space-y-2.5">
              {upcomingAbsences.map((row) => (
                <li
                  key={row.id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1 ring-slate-900/[0.04]",
                    row.isActive ? "bg-violet-50/50 ring-violet-100/80" : "bg-[#F6F8FC]/90",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-slate-900">{row.employeeName}</span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ring-1",
                          absenceTypeBadgeClass(row.type),
                        )}
                      >
                        {row.type}
                      </span>
                      {row.isActive ? (
                        <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Aktiv
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[12px] font-medium text-slate-600">{row.whenLabel}</div>
                    {row.timeLabel ? (
                      <div className="mt-0.5 text-[11.5px] font-medium text-sky-800">{row.timeLabel}</div>
                    ) : null}
                    {row.note ? (
                      <div className="mt-0.5 truncate text-[11px] text-slate-500">{row.note}</div>
                    ) : null}
                  </div>
                </li>
              ))}
              {upcomingAbsences.length === 0 ? (
                <li className="rounded-2xl bg-slate-50/80 px-4 py-3 text-[13px] font-medium text-slate-600 ring-1 ring-slate-900/[0.04]">
                  Ingen registrert fravær denne uken.
                </li>
              ) : null}
            </ul>
          </section>

          <section className="rounded-3xl bg-white/80 p-6 shadow-[0_20px_44px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04] backdrop-blur">
            <h2 className="text-[17px] font-semibold text-slate-900">Denne uken</h2>
            <p className="mt-1 text-[13px] font-medium text-slate-500">Kompakt oversikt over vakter og bemanningsstatus.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {staffingByDay.map((d) => (
                (() => {
                  const start = addDays(baseWeekStart, weekOffset * 7);
                  const dateObj = addDays(start, d.dayIndex);
                  const isToday = isoFromDate(dateObj) === todayKey;
                  return (
                <div
                  key={d.dayIndex}
                  className={cn(
                    "rounded-3xl p-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)] ring-1",
                    d.gap > 0 ? "bg-rose-50/70 ring-rose-100" : "bg-[#F6F8FC]/90 ring-slate-900/[0.04]",
                    isToday && (d.gap > 0 ? "ring-violet-200" : "bg-violet-50/60 ring-violet-100"),
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{d.short}</div>
                    {isToday ? (
                      <span className="rounded-full bg-violet-600 px-2.5 py-1 text-[10.5px] font-semibold text-white shadow-sm">
                        I dag
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[13px] font-semibold text-slate-700">{d.date}</div>
                  <div className="mt-4 text-[22px] font-semibold text-slate-900">{d.shiftCount}</div>
                  <div className="text-[11.5px] font-semibold text-slate-500">vakter</div>
                  <div className="mt-3 text-[12px] font-semibold text-slate-600">
                    Krav: {d.required > 0 ? `${d.required} min` : "—"}
                  </div>
                  {d.gap > 0 ? (
                    <div className="mt-2 text-[12px] font-semibold text-rose-700">Under bemanning</div>
                  ) : (
                    <div className="mt-2 text-[12px] font-semibold text-emerald-700">OK</div>
                  )}
                </div>
                  );
                })()
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl bg-white/80 p-6 shadow-[0_20px_44px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04] backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[17px] font-semibold text-slate-900">Viktigste varsler</h2>
                  <p className="mt-1 text-[13px] font-medium text-slate-500">Topp 5 etter alvorlighetsgrad.</p>
                </div>
              </div>
              <ul className="mt-5 space-y-3">
                {!alertsHydrated ? (
                  <li className="rounded-2xl bg-slate-50/80 px-4 py-3 text-[13px] font-medium text-slate-600 ring-1 ring-slate-900/[0.04]">
                    Laster varsler…
                  </li>
                ) : (
                  <>
                    {topAlerts.map((a) => (
                      <li
                        key={a.id}
                        className={cn("rounded-2xl px-4 py-3 ring-1", severityStyles(a.severity))}
                      >
                        <div className="text-[13px] font-semibold text-slate-900">{a.title}</div>
                        <div className="mt-1 text-[12.5px] font-medium text-slate-600">{a.description}</div>
                      </li>
                    ))}
                    {topAlerts.length === 0 ? (
                      <li className="rounded-2xl bg-slate-50/80 px-4 py-3 text-[13px] font-medium text-slate-600 ring-1 ring-slate-900/[0.04]">
                        Ingen varsler akkurat nå.
                      </li>
                    ) : null}
                  </>
                )}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setIsAlertsOpen(true);
                  setAlertsAnchorRect(null);
                }}
                className="mt-5 inline-flex items-center gap-1 text-[13px] font-semibold text-violet-700 hover:text-violet-600"
              >
                Se alle varsler
                <ChevronRight className="size-4" />
              </button>
            </section>

            <section className="rounded-3xl bg-white/80 p-6 shadow-[0_20px_44px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04] backdrop-blur">
              <h2 className="text-[17px] font-semibold text-slate-900">Ansatte nær grense</h2>
              <p className="mt-1 text-[13px] font-medium text-slate-500">Planlagt mot kontrakt for valgt filter.</p>
              <ul className="mt-5 space-y-3">
                {nearEmployees.map((r) => (
                  <li
                    key={r.employeeId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#F6F8FC]/90 px-4 py-3 ring-1 ring-slate-900/[0.04]"
                  >
                    <div>
                      <div className="text-[13px] font-semibold text-slate-900">{r.name}</div>
                      <div className="mt-0.5 text-[12.5px] font-medium text-slate-600">
                        {formatHours(r.plannedHours)} t / {formatHours(r.contractHours)} t
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-[11.5px] font-semibold ring-1 ring-black/[0.04]",
                        contractBadge(r.status),
                      )}
                    >
                      {contractLabel(r.status)}
                    </span>
                  </li>
                ))}
                {nearEmployees.length === 0 ? (
                  <li className="rounded-2xl bg-slate-50/80 px-4 py-3 text-[13px] font-medium text-slate-600 ring-1 ring-slate-900/[0.04]">
                    Ingen ansatte nær eller over kontraktsgrensen.
                  </li>
                ) : null}
              </ul>
            </section>
          </div>

          <section className="rounded-3xl bg-white/80 p-6 shadow-[0_20px_44px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04] backdrop-blur">
            <h2 className="text-[17px] font-semibold text-slate-900">Hurtighandlinger</h2>
            <p className="mt-1 text-[13px] font-medium text-slate-500">Vanlige oppgaver og snarveier.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_14px_28px_rgba(124,58,237,0.3)] hover:bg-violet-500"
              >
                <CalendarPlus className="size-[18px]" />
                Gå til planlegging
              </Link>
              <Link
                href="/ansatte"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2.5 text-[13px] font-semibold text-slate-800 ring-1 ring-slate-900/[0.08] hover:bg-white"
              >
                <UserPlus className="size-[18px] text-slate-500" />
                Legg til ansatt
              </Link>
              <Link
                href="/butikker"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2.5 text-[13px] font-semibold text-slate-800 ring-1 ring-slate-900/[0.08] hover:bg-white"
              >
                <Store className="size-[18px] text-slate-500" />
                Legg til butikk
              </Link>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/90 px-4 py-2.5 text-[13px] font-semibold text-slate-800 ring-1 ring-slate-900/[0.08] hover:bg-white"
                onClick={() => openSchedulePrintPreview(exportModel)}
              >
                <Download className="size-[18px] text-slate-500" />
                Eksporter ukeplan
              </button>
            </div>
          </section>

          <EmployeeRequestsSection
            requests={requests}
            employeeNameById={employeeById}
            pendingCount={pendingCount}
            isMutating={isMutating}
            onApprove={(id) => void approveRequest(id)}
            onReject={(id) => void rejectRequest(id)}
            limit={10}
          />
        </main>
      </div>

      <AlertsPanel
        open={isAlertsOpen}
        anchorRect={alertsAnchorRect}
        alerts={alertsHydrated ? activeAlerts : []}
        onClose={() => setIsAlertsOpen(false)}
      />
    </div>
  );
}
