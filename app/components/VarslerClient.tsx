"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AlertItem } from "@/app/lib/rules/alerts";
import { Sidebar } from "@/app/components/Sidebar";
import { TopBar } from "@/app/components/TopBar";
import { AlertsPanel } from "@/app/components/AlertsPanel";
import { useAlerts } from "@/app/components/AlertsProvider";
import { useWorkforce } from "@/app/components/WorkforceProvider";
import { useStores } from "@/app/components/StoresProvider";
import { useSettings } from "@/app/components/SettingsProvider";
import { addDays, baseWeekStart, dayShort, formatNorDate, monthsShort } from "@/app/lib/mockData";
import { getWeekStart } from "@/app/lib/dateUtils";
import { currentWeekOffset, weekOffsetFromDate, weekStartDateFromOffset } from "@/app/lib/weekDate";
import { generateAlerts } from "@/app/lib/rules/alerts";
import { cn } from "@/app/lib/cn";
import {
  employeesInScope,
  shiftsInScope,
  siteKeyFromStore,
} from "@/app/lib/dashboardScope";
import { AlertTriangle, Ban, CheckCircle2, Info, ShieldAlert } from "lucide-react";

type FilterChip = "alle" | "contract" | "understaffed" | "unavailable" | "resolved";

function kindLabel(type: AlertItem["type"]) {
  if (type === "over_contract" || type === "near_contract") return "Overtid/mertid";
  if (type === "understaffed") return "Bemanning";
  return "Utilgjengelighet";
}

function kindIcon(type: AlertItem["type"]) {
  if (type === "unavailable_conflict") return Ban;
  if (type === "over_contract" || type === "near_contract") return AlertTriangle;
  return Info;
}

function severityChip(sev: AlertItem["severity"]) {
  if (sev === "critical") return "bg-rose-50 text-rose-800 ring-rose-100";
  if (sev === "warning") return "bg-amber-50 text-amber-900 ring-amber-100";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function severityLabel(sev: AlertItem["severity"]) {
  if (sev === "critical") return "Kritisk";
  if (sev === "warning") return "Advarsel";
  return "Info";
}

function relatedLine(a: AlertItem, employeeNameById: Map<string, string>, storeNameById: Map<string, string>) {
  const parts: string[] = [];
  if (a.employeeId) parts.push(employeeNameById.get(a.employeeId) ?? "Ansatt");
  if (a.storeId) parts.push(storeNameById.get(a.storeId) ?? "Butikk");
  if (typeof a.day === "number") parts.push(dayShort[a.day] ?? `Dag ${a.day}`);
  return parts.join(" • ");
}

export function VarslerClient() {
  const { employees, shifts } = useWorkforce();
  const { stores } = useStores();
  const { settings } = useSettings();
  const { activeAlerts, alertCount, markAlertResolved, isResolved } = useAlerts();

  const [weekOffset, setWeekOffset] = useState(() => currentWeekOffset());
  const [storeId, setStoreId] = useState<string>("alle");
  const [filter, setFilter] = useState<FilterChip>("alle");
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [alertsAnchorRect, setAlertsAnchorRect] = useState<DOMRect | null>(null);

  const days = useMemo(() => {
    const start = addDays(baseWeekStart, weekOffset * 7);
    return dayShort.map((short, idx) => {
      const d = addDays(start, idx);
      return { short, date: formatNorDate(d) };
    });
  }, [weekOffset]);

  const weekStartDate = useMemo(() => getWeekStart(weekStartDateFromOffset(weekOffset)), [weekOffset]);
  const weekLabel = useMemo(() => {
    const start = addDays(baseWeekStart, weekOffset * 7);
    const end = addDays(start, 6);
    const startLabel = `${start.getDate()}.`;
    const endLabel = `${end.getDate()}. ${monthsShort[end.getMonth()]} ${end.getFullYear()}`;
    return `${startLabel} – ${endLabel}`;
  }, [weekOffset]);

  const selectedRetail = useMemo(
    () => (storeId === "alle" ? null : stores.find((s) => s.id === storeId) ?? null),
    [storeId, stores],
  );
  const siteKey = siteKeyFromStore(selectedRetail);

  const scopedEmployees = useMemo(() => employeesInScope(employees, siteKey), [employees, siteKey]);
  const weekShiftsAll = useMemo(() => shifts.filter((s) => s.week === weekOffset), [shifts, weekOffset]);
  const scopedShifts = useMemo(() => shiftsInScope(weekShiftsAll, siteKey), [weekShiftsAll, siteKey]);

  const alerts = useMemo(
    () => generateAlerts({ employees: scopedEmployees, shifts: scopedShifts, stores, selectedStoreId: storeId, settings }),
    [scopedEmployees, scopedShifts, stores, storeId, settings],
  );

  const storeOptions = useMemo(
    () => [{ value: "alle", label: "Alle butikker" }, ...stores.map((s) => ({ value: s.id, label: s.name }))],
    [stores],
  );

  const enriched = useMemo(() => {
    return alerts.map((a) => ({ ...a, resolved: isResolved(a.id) }));
  }, [alerts, isResolved]);

  const filtered = useMemo(() => {
    return enriched.filter((a) => {
      if (filter === "resolved") return a.resolved;
      if (filter === "alle") return !a.resolved;
      if (a.resolved) return false;
      if (filter === "contract") return a.type === "over_contract" || a.type === "near_contract";
      if (filter === "understaffed") return a.type === "understaffed";
      if (filter === "unavailable") return a.type === "unavailable_conflict";
      return true;
    });
  }, [enriched, filter]);
  const employeeNameById = useMemo(() => new Map(employees.map((e) => [e.id, e.name] as const)), [employees]);
  const storeNameById = useMemo(() => new Map(stores.map((s) => [s.id, s.name] as const)), [stores]);

  const summary = useMemo(() => {
    const all = enriched;
    return {
      critical: all.filter((a) => a.severity === "critical" && !a.resolved).length,
      warning: all.filter((a) => a.severity === "warning" && !a.resolved).length,
      info: all.filter((a) => a.severity === "info" && !a.resolved).length,
      total: all.filter((a) => !a.resolved).length,
    };
  }, [enriched]);

  function onMarkResolved(id: string) {
    markAlertResolved(id);
  }

  return (
    <div className="min-h-screen w-full">
      <div className="mx-auto flex w-full max-w-[1280px] gap-7 px-6 py-6">
        <Sidebar
          onOpenAlerts={() => {
            // Sidebar Varsler is a page now; no popup here.
          }}
        />

        <main className="min-w-0 flex-1">
          <TopBar
            mode="overview"
            title="Varsler"
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

          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Kritiske", value: summary.critical, icon: ShieldAlert, tone: "rose" as const },
              { label: "Advarsler", value: summary.warning, icon: AlertTriangle, tone: "amber" as const },
              { label: "Info", value: summary.info, icon: Info, tone: "slate" as const },
              { label: "Totalt", value: summary.total, icon: CheckCircle2, tone: "violet" as const },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.label}
                  className="rounded-[26px] bg-white/80 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] backdrop-blur"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-semibold text-slate-500">{c.label}</div>
                      <div className="mt-2 text-[24px] font-semibold tracking-tight text-slate-900">{c.value}</div>
                    </div>
                    <div className="grid size-10 place-items-center rounded-2xl bg-[#F6F8FC] ring-1 ring-slate-900/[0.05]">
                      <Icon className="size-[18px] text-slate-500" />
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="mt-6 rounded-[34px] bg-white/80 p-5 shadow-[0_20px_44px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04] backdrop-blur">
            <div className="flex flex-wrap gap-2 px-1">
              {(
                [
                  { id: "alle" as const, label: "Alle" },
                  { id: "contract" as const, label: "Overtid/mertid" },
                  { id: "understaffed" as const, label: "Bemanning" },
                  { id: "unavailable" as const, label: "Utilgjengelighet" },
                  { id: "resolved" as const, label: "Løst" },
                ] satisfies Array<{ id: FilterChip; label: string }>
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFilter(c.id)}
                  className={cn(
                    "rounded-full px-4 py-2 text-[12.5px] font-semibold shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.05]",
                    filter === c.id ? "bg-violet-600 text-white ring-violet-200" : "bg-white/70 text-slate-700 hover:bg-white",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {filtered.map((a) => {
                const Icon = kindIcon(a.type);
                const rel = relatedLine(a, employeeNameById, storeNameById);
                return (
                  <div
                    key={a.id}
                    className="rounded-[28px] bg-white/70 p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05]"
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn("grid size-11 place-items-center rounded-2xl ring-1 ring-black/[0.03]", severityChip(a.severity))}>
                        <Icon className="size-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("rounded-full px-3 py-1 text-[11.5px] font-semibold ring-1 ring-black/[0.04]", severityChip(a.severity))}>
                            {severityLabel(a.severity)}
                          </span>
                          <span className="rounded-full bg-[#F6F8FC] px-3 py-1 text-[11.5px] font-semibold text-slate-700 ring-1 ring-slate-900/[0.05]">
                            {kindLabel(a.type)}
                          </span>
                          <span className={cn("rounded-full px-3 py-1 text-[11.5px] font-semibold ring-1 ring-slate-900/[0.06]", a.resolved ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-violet-50 text-violet-800 ring-violet-100")}>
                            {a.resolved ? "Løst" : "Ny"}
                          </span>
                        </div>
                        <div className="mt-2 text-[14px] font-semibold text-slate-900">{a.title}</div>
                        <div className="mt-1 text-[12.5px] font-medium text-slate-600">{a.description}</div>
                        {rel ? (
                          <div className="mt-2 text-[12px] font-semibold text-slate-500">{rel}</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-2.5 text-[13px] font-semibold text-slate-800 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.06] hover:bg-white"
                      >
                        Gå til plan
                      </Link>
                      {!a.resolved ? (
                        <button
                          type="button"
                          onClick={() => onMarkResolved(a.id)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_14px_28px_rgba(16,185,129,0.25)] hover:bg-emerald-500"
                        >
                          Marker som løst
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 ? (
                <div className="rounded-[28px] bg-[#F6F8FC] p-4 text-[13px] font-semibold text-slate-600 ring-1 ring-slate-900/[0.04]">
                  Ingen varsler i dette filteret.
                </div>
              ) : null}
            </div>
          </section>
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

