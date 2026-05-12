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
import {
  employeesInScope,
  shiftsInScope,
  siteKeyFromStore,
} from "@/app/lib/dashboardScope";
import { addDays, baseWeekStart, dayShort, formatNorDate, monthsShort } from "@/app/lib/mockData";
import { formatHours, round1, shiftDurationHours, sumEmployeeWeekHours } from "@/app/lib/hours";
import { buildScheduleExportModel, openSchedulePrintPreview } from "@/app/lib/exportSchedule";
import { cn } from "@/app/lib/cn";
import { useAlerts } from "@/app/components/AlertsProvider";
import { CalendarPlus, ChevronRight, Download, Store, UserPlus } from "lucide-react";
import { useRequests } from "@/app/components/RequestsProvider";
import { makeId } from "@/app/lib/mockData";
import { currentWeekOffset, isoFromDate, todayLocal, weekOffsetFromDate, weekStartDateFromOffset } from "@/app/lib/weekDate";
import { formatWeekLabel, getWeekStart } from "@/app/lib/dateUtils";
import { getContractStatus, getPlannedHoursForEmployee } from "@/app/lib/rules/contracts";
import { getStaffingStatusForDay } from "@/app/lib/rules/staffing";
import type { ContractStatus } from "@/app/lib/rules/contracts";

function countAvailabilityConflicts(scopedShifts: Shift[], employees: Employee[]): number {
  const byId = new Map(employees.map((e) => [e.id, e] as const));
  let c = 0;
  for (const s of scopedShifts) {
    if (s.store === "Fri" || !s.startTime || !s.endTime) continue;
    const e = byId.get(s.employeeId);
    if (e?.unavailableDays.includes(s.day)) c++;
  }
  return c;
}

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
  const { employees, shifts, setEmployees, setShifts } = useWorkforce();
  const { stores } = useStores();
  const { settings } = useSettings();
  const { activeAlerts, alertCount, alertsHydrated } = useAlerts();
  const { requests, setRequests } = useRequests();

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

  const siteKey = siteKeyFromStore(selectedRetail);

  const weekShiftsAll = useMemo(() => shifts.filter((s) => s.week === weekOffset), [shifts, weekOffset]);
  const scopedShifts = useMemo(() => shiftsInScope(weekShiftsAll, siteKey), [weekShiftsAll, siteKey]);
  const scopedEmployees = useMemo(() => employeesInScope(employees, siteKey), [employees, siteKey]);

  // Alerts are sourced from the shared AlertsProvider (activeAlerts/alertCount).

  const topAlerts = useMemo(
    () => [...activeAlerts].sort((a, b) => alertRank(a.severity) - alertRank(b.severity)).slice(0, 5),
    [activeAlerts],
  );

  const totalPlannedHours = useMemo(
    () => round1(scopedShifts.reduce((acc, s) => acc + shiftDurationHours(s), 0)),
    [scopedShifts],
  );

  const exportModel = useMemo(() => {
    const storeName = selectedRetail?.name ?? (storeId === "alle" ? "Alle butikker" : "Butikk");
    return buildScheduleExportModel({
      storeName,
      weekLabel,
      weekStart: baseWeekStart,
      weekOffset,
      employees: scopedEmployees,
      shifts: scopedShifts,
      alertsCount: activeAlerts.length,
    });
  }, [activeAlerts.length, scopedEmployees, scopedShifts, selectedRetail, storeId, weekLabel, weekOffset]);

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

  const conflictCount = useMemo(
    () => countAvailabilityConflicts(scopedShifts, employees),
    [scopedShifts, employees],
  );

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

  const pendingRequests = useMemo(() => requests.filter((r) => r.status === "pending"), [requests]);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e] as const)), [employees]);

  function approveRequest(id: string) {
    const req = requests.find((r) => r.id === id) ?? null;
    if (!req || req.status !== "pending") return;

    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));

    if (req.type === "bytt_vakt") return; // placeholder

    // Add unavailability + remove shifts that match the approved date for this employee.
    setShifts((prev) =>
      prev.filter((s) => {
        if (s.employeeId !== req.employeeId) return true;
        const d = addDays(baseWeekStart, s.week * 7 + s.day);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return iso !== req.date;
      }),
    );

    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== req.employeeId) return e;
        const reason = req.type === "meld_sykdom" ? "Syk" : "Fri";
        const period = { id: makeId(), startDate: req.date, endDate: req.date, reason } as const;
        const nextBadges = new Set(e.badges);
        if (reason === "Syk") nextBadges.add("Syk");
        if (reason === "Fri") nextBadges.add("Fri");
        nextBadges.delete("Tilgjengelig");
        return {
          ...e,
          unavailablePeriods: [...(e.unavailablePeriods ?? []), period],
          badges: Array.from(nextBadges) as typeof e.badges,
        };
      }),
    );
  }

  function rejectRequest(id: string) {
    setRequests((prev) =>
      prev.map((r) => (r.id === id && r.status === "pending" ? { ...r, status: "rejected" } : r)),
    );
  }

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
            alertsCount={alertCount}
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

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                title: "Planlagte timer",
                value: `${formatHours(totalPlannedHours)} t`,
                hint: "Valgt uke og butikkfilter",
              },
              {
                title: "Ansatte over kontrakt",
                value: String(overContractCount),
                hint: "Basert på plan vs kontrakt",
              },
              {
                title: "Manglende bemanning",
                value: `${daysUnderStaffed} dag${daysUnderStaffed === 1 ? "" : "er"}`,
                hint: "Under minstekrav",
              },
              {
                title: "Utilgjengelige ansatte",
                value: String(conflictCount),
                hint: "Vakter på utilgjengelige dager",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-3xl bg-white/80 p-6 shadow-[0_20px_44px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04] backdrop-blur"
              >
                <div className="text-[12.5px] font-semibold uppercase tracking-wide text-slate-500">{c.title}</div>
                <div className="mt-3 text-[28px] font-semibold tracking-tight text-slate-900">{c.value}</div>
                <div className="mt-2 text-[12.5px] font-medium text-slate-500">{c.hint}</div>
              </div>
            ))}
          </div>

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

          <section className="rounded-3xl bg-white/80 p-6 shadow-[0_20px_44px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.04] backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-[17px] font-semibold text-slate-900">Forespørsler</h2>
                <p className="mt-1 text-[13px] font-medium text-slate-500">Forespørsler fra ansatte.</p>
              </div>
              <div className="rounded-full bg-violet-50 px-3 py-1 text-[12px] font-semibold text-violet-800 ring-1 ring-violet-100">
                {pendingRequests.length} pending
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {requests
                .slice()
                .sort((a, b) => {
                  const sRank = (s: typeof a.status) => (s === "pending" ? 0 : s === "approved" ? 1 : 2);
                  const rank = sRank(a.status) - sRank(b.status);
                  if (rank !== 0) return rank;
                  return String(b.date).localeCompare(String(a.date));
                })
                .slice(0, 10)
                .map((r) => {
                  const emp = employeeById.get(r.employeeId);
                  const typeLabel =
                    r.type === "be_om_fri" ? "Be om fri" : r.type === "meld_sykdom" ? "Meld sykdom" : "Bytt vakt";
                  const statusLabel = r.status === "pending" ? "Pending" : r.status === "approved" ? "Godkjent" : "Avslått";
                  const statusStyles =
                    r.status === "approved"
                      ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
                      : r.status === "rejected"
                        ? "bg-rose-50 text-rose-800 ring-rose-100"
                        : "bg-white/70 text-slate-700 ring-slate-900/[0.05]";

                  return (
                    <div
                      key={r.id}
                      className="rounded-[28px] bg-[#F6F8FC] p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[13px] font-semibold text-slate-900">
                            {typeLabel} · {emp?.name ?? "Ansatt"}
                          </div>
                          <div className="mt-1 text-[12.5px] font-medium text-slate-600">
                            {r.date}
                            {r.message ? ` · ${r.message}` : ""}
                          </div>
                        </div>
                        <span className={cn("rounded-full px-3 py-1 text-[11.5px] font-semibold ring-1", statusStyles)}>
                          {statusLabel}
                        </span>
                      </div>

                      {r.status === "pending" ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => approveRequest(r.id)}
                            className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_14px_28px_rgba(16,185,129,0.25)] hover:bg-emerald-500"
                          >
                            Godkjenn
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectRequest(r.id)}
                            className="rounded-2xl bg-white/80 px-4 py-2.5 text-[13px] font-semibold text-rose-700 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-rose-100 hover:bg-rose-50"
                          >
                            Avslå
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}

              {requests.length === 0 ? (
                <div className="rounded-[28px] bg-[#F6F8FC] p-4 text-[13px] font-semibold text-slate-600 ring-1 ring-slate-900/[0.04]">
                  Ingen forespørsler ennå.
                </div>
              ) : null}
            </div>
          </section>
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
