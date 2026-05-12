"use client";

import { useMemo, useState } from "react";
import type { Employee, ReportTabId } from "@/app/lib/types";
import {
  employeesInScope,
  shiftsInScope,
  siteKeyFromStore,
} from "@/app/lib/dashboardScope";
import { Sidebar } from "@/app/components/Sidebar";
import { TopBar } from "@/app/components/TopBar";
import { AlertsPanel } from "@/app/components/AlertsPanel";
import { useWorkforce } from "@/app/components/WorkforceProvider";
import { useStores } from "@/app/components/StoresProvider";
import { useSettings } from "@/app/components/SettingsProvider";
import { addDays, baseWeekStart, dayShort, formatNorDate } from "@/app/lib/mockData";
import {
  employeeStatus,
  formatHours,
  round1,
  shiftDurationHours,
  sumEmployeeWeekHours,
} from "@/app/lib/hours";
import { cn } from "@/app/lib/cn";
import { useAlerts } from "@/app/components/AlertsProvider";
import { buildScheduleExportModel, downloadScheduleCsv, openSchedulePrintPreview } from "@/app/lib/exportSchedule";
import { addWeeks, formatWeekLabel, getToday, getWeekStart } from "@/app/lib/dateUtils";
import { getContractStatus, getPlannedHoursForEmployee } from "@/app/lib/rules/contracts";
import { getStaffingStatusForDay } from "@/app/lib/rules/staffing";

function hasUtilgjengelig(e: Employee) {
  return e.unavailableDays.length > 0 || (e.unavailablePeriods?.length ?? 0) > 0;
}

function statusLabel(s: "within" | "near" | "over") {
  if (s === "over") return "Over kontrakt";
  if (s === "near") return "Nær grense";
  return "Innenfor";
}

const reportTabs: Array<{ id: ReportTabId; label: string }> = [
  { id: "timer", label: "Timer" },
  { id: "overtid", label: "Overtid/mertid" },
  { id: "bemanning", label: "Bemanning" },
  { id: "fravaer", label: "Fravær" },
];

export function RapporterClient() {
  const { employees, shifts } = useWorkforce();
  const { stores } = useStores();
  const { settings } = useSettings();
  const { activeAlerts, alertCount } = useAlerts();

  const [weekOffset, setWeekOffset] = useState(() => {
    const today = getToday();
    const base = getWeekStart(baseWeekStart);
    const current = getWeekStart(today);
    return Math.round((current.getTime() - base.getTime()) / (7 * 24 * 60 * 60 * 1000));
  });
  const [storeId, setStoreId] = useState<string>("alle");
  const [reportTab, setReportTab] = useState<ReportTabId>("timer");
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [alertsAnchorRect, setAlertsAnchorRect] = useState<DOMRect | null>(null);

  const weekStartDate = useMemo(() => addWeeks(getWeekStart(baseWeekStart), weekOffset), [weekOffset]);

  const days = useMemo(() => {
    const start = weekStartDate;
    return dayShort.map((short, idx) => {
      const d = addDays(start, idx);
      return { short, date: formatNorDate(d), dayIndex: idx };
    });
  }, [weekStartDate]);

  const weekLabel = useMemo(() => {
    return formatWeekLabel(weekStartDate);
  }, [weekStartDate]);

  const selectedRetail = useMemo(
    () => (storeId === "alle" ? null : stores.find((s) => s.id === storeId) ?? null),
    [storeId, stores],
  );

  const siteKey = siteKeyFromStore(selectedRetail);

  // Alerts are sourced from the shared AlertsProvider (activeAlerts/alertCount).

  const weekShiftsAll = useMemo(() => shifts.filter((s) => s.week === weekOffset), [shifts, weekOffset]);
  const scopedShifts = useMemo(() => shiftsInScope(weekShiftsAll, siteKey), [weekShiftsAll, siteKey]);
  const scopedEmployees = useMemo(() => employeesInScope(employees, siteKey), [employees, siteKey]);

  const reportRows = useMemo(() => {
    return scopedEmployees.map((e) => {
      const planned = getPlannedHoursForEmployee(e.id, scopedShifts);
      const status = getContractStatus(e, scopedShifts, settings);
      const diff = round1(planned - e.contractHours);
      return {
        employeeId: e.id,
        name: e.name,
        contractPercent: e.contractPercent,
        contractHours: e.contractHours,
        plannedHours: planned,
        diff,
        status,
      };
    });
  }, [scopedEmployees, scopedShifts, settings]);

  const totalPlannedHours = useMemo(
    () => round1(scopedShifts.reduce((acc, s) => acc + shiftDurationHours(s), 0)),
    [scopedShifts],
  );

  const overContractCount = useMemo(() => reportRows.filter((r) => r.status === "over").length, [reportRows]);

  const staffingByDay = useMemo(() => {
    return days.map((d) => {
      const dayShifts = scopedShifts.filter((s) => s.day === d.dayIndex && shiftDurationHours(s) > 0);
      const { planned, required, status } = getStaffingStatusForDay(dayShifts, selectedRetail, d.dayIndex, settings);
      const gap = status === "understaffed" ? Math.max(0, required - planned) : 0;
      return { ...d, planned, required, gap };
    });
  }, [days, scopedShifts, selectedRetail, settings]);

  const missingStaffingTotal = useMemo(() => staffingByDay.reduce((a, d) => a + d.gap, 0), [staffingByDay]);

  const unavailableCount = useMemo(() => scopedEmployees.filter(hasUtilgjengelig).length, [scopedEmployees]);

  const overContractList = useMemo(
    () =>
      reportRows
        .filter((r) => r.status === "over")
        .map((r) => ({
          name: r.name,
          overHours: round1(Math.max(0, r.plannedHours - r.contractHours)),
        })),
    [reportRows],
  );

  const storeOptions = useMemo(
    () => [{ value: "alle", label: "Alle butikker" }, ...stores.map((s) => ({ value: s.id, label: s.name }))],
    [stores],
  );

  const exportModel = useMemo(() => {
    const storeName = selectedRetail?.name ?? (storeId === "alle" ? "Alle butikker" : "Butikk");
    return buildScheduleExportModel({
      storeName,
      weekLabel,
      weekStart: getWeekStart(baseWeekStart),
      weekOffset,
      employees: scopedEmployees,
      shifts: scopedShifts,
      alertsCount: alertCount,
    });
  }, [alertCount, scopedEmployees, scopedShifts, selectedRetail, storeId, weekLabel, weekOffset]);

  return (
    <div className="min-h-screen w-full">
      <div className="mx-auto flex w-full max-w-[1280px] gap-7 px-6 py-6">
        <Sidebar
          onOpenAlerts={() => {
            setIsAlertsOpen(true);
            setAlertsAnchorRect(null);
          }}
        />

        <main className="min-w-0 flex-1">
          <TopBar
            mode="reports"
            title="Rapporter"
            alertsCount={alertCount}
            onBellClick={(rect) => {
              setAlertsAnchorRect(rect);
              setIsAlertsOpen((v) => !v);
            }}
            reportWeekStartDate={weekStartDate}
            onReportWeekChange={(newWeekStart) => {
              const base = getWeekStart(baseWeekStart);
              const next = getWeekStart(newWeekStart);
              setWeekOffset(Math.round((next.getTime() - base.getTime()) / (7 * 24 * 60 * 60 * 1000)));
            }}
            reportStoreValue={storeId}
            onReportStoreChange={setStoreId}
            reportStoreOptions={storeOptions}
            reportTab={reportTab}
            onReportTabChange={setReportTab}
            reportTabs={reportTabs}
            onExportPdf={() => openSchedulePrintPreview(exportModel)}
            onExportExcel={() => downloadScheduleCsv(exportModel, "shiftly-ukeplan.csv")}
          />

          <p className="mt-3 text-[12.5px] font-medium text-slate-500">
            Rapporter genereres automatisk fra valgt uke og butikk. Ingenting lagres før du eksporterer.
          </p>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Totalt planlagte timer", value: `${formatHours(totalPlannedHours)} t`, tone: "slate" },
              { label: "Ansatte over kontrakt", value: String(overContractCount), tone: "rose" },
              { label: "Manglende bemanning", value: `${missingStaffingTotal} hull`, tone: "amber" },
              { label: "Utilgjengelige ansatte", value: String(unavailableCount), tone: "violet" },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-[26px] bg-white/75 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05]"
              >
                <div className="text-[12px] font-semibold text-slate-500">{card.label}</div>
                <div className="mt-2 text-[22px] font-semibold tracking-tight text-slate-900">{card.value}</div>
              </div>
            ))}
          </section>

          {reportTab !== "fravaer" ? (
            <section className="mt-6 overflow-hidden rounded-[28px] bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] backdrop-blur">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-900/[0.06] bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Ansatt</th>
                      <th className="px-4 py-3">Stillingsprosent</th>
                      <th className="px-4 py-3">Kontraktstimer</th>
                      <th className="px-4 py-3">Planlagte timer</th>
                      <th className="px-4 py-3">Differanse</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((r) => (
                      <tr key={r.employeeId} className="border-b border-slate-900/[0.04] last:border-0">
                        <td className="px-4 py-3 font-semibold text-slate-900">{r.name}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{r.contractPercent}%</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{formatHours(r.contractHours)} t</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{formatHours(r.plannedHours)} t</td>
                        <td
                          className={cn(
                            "px-4 py-3 font-semibold",
                            r.diff > 0 ? "text-rose-600" : r.diff < 0 ? "text-emerald-600" : "text-slate-600",
                          )}
                        >
                          {r.diff > 0 ? "+" : ""}
                          {formatHours(r.diff)} t
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ring-1 ring-black/[0.04]",
                              r.status === "over" && "bg-rose-50 text-rose-800 ring-rose-100",
                              r.status === "near" && "bg-amber-50 text-amber-900 ring-amber-100",
                              r.status === "within" && "bg-emerald-50 text-emerald-900 ring-emerald-100",
                            )}
                          >
                            {statusLabel(r.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {reportTab === "overtid" ? (
            <section
              className={cn(
                "mt-6 rounded-[28px] p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)] ring-1 ring-amber-900/[0.08]",
                overContractList.length > 0 ? "bg-amber-50/80" : "bg-white/70 ring-slate-900/[0.05]",
              )}
            >
              <div className="text-[15px] font-semibold text-slate-900">Ansatte over kontrakt denne uken</div>
              {overContractList.length === 0 ? (
                <p className="mt-2 text-[13px] font-medium text-slate-600">Ingen ansatte over kontraktsgrensen i valgt filter.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {overContractList.map((o) => (
                    <li
                      key={o.name}
                      className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3 text-[13px] font-semibold text-slate-800 shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.04]"
                    >
                      <span>{o.name}</span>
                      <span className="text-rose-700">+{formatHours(o.overHours)} t over kontrakt</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {reportTab === "bemanning" ? (
            <section className="mt-6">
              <div className="text-[16px] font-semibold text-slate-900">Bemanning per dag</div>
              <p className="mt-1 text-[12.5px] font-medium text-slate-500">
                Planlagte vakter (med arbeidstid) mot minimumskrav for valgt butikkfilter.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {staffingByDay.map((d) => (
                  <div
                    key={d.dayIndex}
                    className={cn(
                      "rounded-[22px] p-4 shadow-[0_12px_26px_rgba(15,23,42,0.06)] ring-1",
                      d.gap > 0 ? "bg-rose-50/70 ring-rose-100" : "bg-white/75 ring-slate-900/[0.05]",
                    )}
                  >
                    <div className="text-[12px] font-semibold text-slate-500">
                      {d.short} <span className="text-slate-400">{d.date}</span>
                    </div>
                    <div className="mt-2 text-[20px] font-semibold text-slate-900">
                      {d.planned}
                      <span className="text-[13px] font-semibold text-slate-400"> / {d.required}</span>
                    </div>
                    <div className="mt-1 text-[11.5px] font-semibold text-slate-600">Vakter vs min. krav</div>
                    {d.gap > 0 ? (
                      <div className="mt-2 text-[12px] font-semibold text-rose-700">Mangler {d.gap}</div>
                    ) : (
                      <div className="mt-2 text-[12px] font-semibold text-emerald-700">Oppfylt</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {reportTab === "fravaer" ? (
            <section className="mt-6 rounded-[28px] bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] backdrop-blur">
              <div className="text-[16px] font-semibold text-slate-900">Fravær og utilgjengelighet</div>
              <p className="mt-1 text-[12.5px] font-medium text-slate-500">
                Oversikt over ansatte med faste utilgjengelige dager eller registrerte perioder.
              </p>
              <div className="mt-4 space-y-3">
                {scopedEmployees.filter(hasUtilgjengelig).map((e) => (
                  <div
                    key={e.id}
                    className="rounded-[22px] bg-[#F6F8FC] p-4 shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.04]"
                  >
                    <div className="font-semibold text-slate-900">{e.name}</div>
                    <div className="mt-1 text-[12.5px] font-medium text-slate-600">
                      {[
                        e.unavailableDays.length > 0
                          ? `Faste utilgjengelige dager: ${e.unavailableDays
                              .slice()
                              .sort((a, b) => a - b)
                              .map((i) => dayShort[i])
                              .join(", ")}`
                          : null,
                        e.unavailablePeriods.length > 0
                          ? `${e.unavailablePeriods.length} registrert${e.unavailablePeriods.length > 1 ? "e" : ""} periode${e.unavailablePeriods.length > 1 ? "r" : ""}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                ))}
                {scopedEmployees.filter(hasUtilgjengelig).length === 0 ? (
                  <p className="text-[13px] font-medium text-slate-600">Ingen registrert fravær/utilgjengelighet i utvalget.</p>
                ) : null}
              </div>
            </section>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-2xl bg-white/80 px-4 py-2.5 text-[13px] font-semibold text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:bg-white"
            >
              Eksporter PDF
            </button>
            <button
              type="button"
              className="rounded-2xl bg-white/80 px-4 py-2.5 text-[13px] font-semibold text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] hover:bg-white"
            >
              Eksporter Excel
            </button>
          </div>
        </main>
      </div>

      <AlertsPanel
        open={isAlertsOpen}
        anchorRect={alertsAnchorRect}
        alerts={activeAlerts}
        onClose={() => setIsAlertsOpen(false)}
      />
    </div>
  );
}
