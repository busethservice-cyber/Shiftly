"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmployeeComputed, Shift } from "@/app/lib/types";
import { Sidebar } from "@/app/components/Sidebar";
import { TopBar } from "@/app/components/TopBar";
import { ScheduleGrid } from "@/app/components/ScheduleGrid";
import { ShiftDetailsPanel } from "@/app/components/ShiftDetailsPanel";
import { EmployeeDetailsPanel } from "@/app/components/EmployeeDetailsPanel";
import { formatHours, isShiftOff, parseTimeToMinutes, round1, shiftDurationHours, sumEmployeeWeekHours } from "@/app/lib/hours";
import { createShiftSuggestions } from "@/app/lib/smartSuggestions";
import { ShiftSuggestionsPopup } from "@/app/components/ShiftSuggestionsPopup";
import { useAlerts } from "@/app/components/AlertsProvider";
import { AlertsPanel } from "@/app/components/AlertsPanel";
import { ConfirmCopyWeekModal } from "@/app/components/ConfirmCopyWeekModal";
import { PublishWeekModal } from "@/app/components/PublishWeekModal";
import { AutoPlanWeekModal } from "@/app/components/AutoPlanWeekModal";
import { buildScheduleExportModel, downloadScheduleCsv, openSchedulePrintPreview } from "@/app/lib/exportSchedule";
import { useWorkforce } from "@/app/components/WorkforceProvider";
import { useStores } from "@/app/components/StoresProvider";
import { useSettings } from "@/app/components/SettingsProvider";
import { addDays, baseWeekStart, dayShort, formatNorDate, makeId, monthsShort } from "@/app/lib/mockData";
import { getToday, getWeekStart, isSameDay } from "@/app/lib/dateUtils";
import { currentWeekOffset, weekOffsetFromDate, weekStartDateFromOffset } from "@/app/lib/weekDate";
import { cn } from "@/app/lib/cn";
import { getContractStatus, getPlannedHoursForEmployee } from "@/app/lib/rules/contracts";
import { getRequiredStaffForDay } from "@/app/lib/rules/staffing";
import { activeStores } from "@/app/lib/storeUtils";
import {
  canAssignShift,
  employeeUnavailableWholeCalendarDay,
  normalizeShiftStoreFields,
} from "@/app/lib/rules/shifts";

type PlanleggToast = { message: string; tone: "neutral" | "negative" };

export function PlanleggClient() {
  const { employees, updateEmployee, deleteEmployee: deleteEmployeePersist, shifts, setEmployees, setShifts, shiftsLoading, employeesLoading } = useWorkforce();
  const { stores, storesLoading } = useStores();
  const { settings } = useSettings();
  const { activeAlerts, alertCount } = useAlerts();

  const [weekOffset, setWeekOffset] = useState(() => currentWeekOffset());
  const [selectedStoreId, setSelectedStoreId] = useState<string>("alle");
  const [isCopyConfirmOpen, setIsCopyConfirmOpen] = useState(false);
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);
  const [isAutoPlanConfirmOpen, setIsAutoPlanConfirmOpen] = useState(false);
  const [autoPlanDraft, setAutoPlanDraft] = useState<Shift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [creatingShift, setCreatingShift] = useState<Shift | null>(null);
  const [isEmployeePanelOpen, setIsEmployeePanelOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [alertsAnchorRect, setAlertsAnchorRect] = useState<DOMRect | null>(null);
  const [toast, setToast] = useState<PlanleggToast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);
  const [suggestions, setSuggestions] = useState<{
    open: boolean;
    originEmployeeId: string;
    day: number;
    anchorRect: DOMRect | null;
  }>({ open: false, originEmployeeId: "", day: 0, anchorRect: null });

  const days = useMemo(() => {
    const start = addDays(baseWeekStart, weekOffset * 7);
    return dayShort.map((short, idx) => {
      const d = addDays(start, idx);
      return { short, date: formatNorDate(d), dateObj: d };
    });
  }, [weekOffset]);

  const scheduleWeekDayOptions = useMemo(
    () => days.map((d, i) => ({ day: i, label: `${d.short} ${d.date}` })),
    [days],
  );

  function defaultDayIndexForNewShift(week: number): number {
    const today = getToday();
    for (let day = 0; day < 7; day++) {
      const d = addDays(baseWeekStart, week * 7 + day);
      if (isSameDay(d, today)) return day;
    }
    return 0;
  }

  const weekStartDate = useMemo(() => getWeekStart(weekStartDateFromOffset(weekOffset)), [weekOffset]);
  const weekLabel = useMemo(() => {
    const start = addDays(baseWeekStart, weekOffset * 7);
    const end = addDays(start, 6);
    const startLabel = `${start.getDate()}.`;
    const endLabel = `${end.getDate()}. ${monthsShort[end.getMonth()]} ${end.getFullYear()}`;
    return `${startLabel} – ${endLabel}`;
  }, [weekOffset]);

  // weekStartDate is used by the shared navigator; weekOffset remains the scheduling key.

  const storesActive = useMemo(() => activeStores(stores), [stores]);

  const scheduleStoreOptions = useMemo(
    () => [{ value: "alle", label: "Alle butikker" }, ...storesActive.map((s) => ({ value: s.id, label: s.name }))],
    [storesActive],
  );

  useEffect(() => {
    if (selectedStoreId === "alle") return;
    if (!storesActive.some((s) => s.id === selectedStoreId)) setSelectedStoreId("alle");
  }, [storesActive, selectedStoreId]);

  const selectedStore = useMemo(
    () => (selectedStoreId === "alle" ? null : stores.find((s) => s.id === selectedStoreId) ?? null),
    [selectedStoreId, stores],
  );
  const selectedSiteKey = selectedStore?.employeeSiteKey ?? null;
  const selectedStoreUuid = selectedStore?.id ?? null;

  const scheduleStoresForPicker = useMemo(
    () => storesActive.map((s) => ({ id: s.id, name: s.name })),
    [storesActive],
  );

  const defaultShiftSlotTimes = useMemo(() => {
    const t = settings.shiftTemplates?.[0];
    return { startTime: t?.startTime ?? "10:00", endTime: t?.endTime ?? "17:00" };
  }, [settings.shiftTemplates]);

  const computed = useMemo(() => {
    const weekShiftsAll = shifts.filter((s) => s.week === weekOffset);
    const visibleWeekShifts =
      selectedStoreId === "alle"
        ? weekShiftsAll
        : weekShiftsAll.filter((s) => !isShiftOff(s) && s.storeId === selectedStoreId);

    const employeesForGrid =
      selectedStoreId === "alle"
        ? employees
        : employees.filter((e) => {
            const ids = e.storeIds ?? [];
            return ids.includes(selectedStoreId) || e.primaryStoreId === selectedStoreId;
          });

    const employeesView: EmployeeComputed[] = employeesForGrid.map((e) => {
      // Contract status/totals are GLOBAL across stores.
      const total = round1(getPlannedHoursForEmployee(e.id, weekShiftsAll));
      const contractStatus = getContractStatus(e, weekShiftsAll, settings);
      const status = contractStatus === "over" ? "over_limit" : contractStatus === "near" ? "near_limit" : "normal";
      const progress = e.contractHours > 0 ? total / e.contractHours : 0;
      const contractLabel = `${e.contractPercent}% • ${formatHours(total)}/${formatHours(e.contractHours)} t`;
      return { ...e, totalHours: total, progress, contractLabel, computedStatus: status };
    });

    const shiftsView: Shift[] = visibleWeekShifts.map((s) => ({
      ...s,
      status: isShiftOff(s)
        ? "unconfirmed"
        : (() => {
            const contractStatus = getContractStatus(
              employees.find((e) => e.id === s.employeeId) ?? { id: s.employeeId, contractHours: 0 },
              weekShiftsAll,
              settings,
            );
            return contractStatus === "over" ? "over_limit" : contractStatus === "near" ? "near_limit" : "normal";
          })(),
    }));

    return { employeesView, shiftsView, weekShiftsVisible: visibleWeekShifts, weekShiftsAll };
  }, [employees, shifts, selectedStoreId, settings, weekOffset]);

  const employeesView = computed.employeesView;
  const shiftsView = computed.shiftsView;

  const selectedEmployee = useMemo(
    () => (selectedEmployeeId ? employees.find((e) => e.id === selectedEmployeeId) ?? null : null),
    [employees, selectedEmployeeId],
  );
  const conflictShiftIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of activeAlerts) {
      if (a.type !== "unavailable_conflict") continue;
      if (a.shiftId) ids.add(a.shiftId);
    }
    return ids;
  }, [activeAlerts]);

  const hasCriticalAlerts = useMemo(
    () => activeAlerts.some((a) => a.severity === "critical"),
    [activeAlerts],
  );

  const exportModel = useMemo(() => {
    const storeName =
      selectedStoreId === "alle"
        ? "Alle butikker"
        : stores.find((s) => s.id === selectedStoreId)?.name ?? "Butikk";
    return buildScheduleExportModel({
      storeName,
      weekLabel,
      weekStart: baseWeekStart,
      weekOffset,
      employees: employeesView,
      shifts: computed.weekShiftsVisible,
      alertsCount: activeAlerts.length,
    });
  }, [activeAlerts.length, computed.weekShiftsVisible, employeesView, selectedStoreId, stores, weekLabel, weekOffset]);

  function clampShiftToOpening(args: { defaultStart: string; defaultEnd: string; openStart: string; openEnd: string }) {
    const { defaultStart, defaultEnd, openStart, openEnd } = args;
    const start = Math.max(parseTimeToMinutes(defaultStart), parseTimeToMinutes(openStart));
    const end = Math.min(parseTimeToMinutes(defaultEnd), parseTimeToMinutes(openEnd));
    if (end <= start) return null;
    const toHM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    return { startTime: toHM(start), endTime: toHM(end) };
  }

  function planAutoWeek() {
    if (selectedStoreId === "alle") {
      setToast({ message: "Velg en butikk før du legger til vakt", tone: "neutral" });
      return;
    }
    const weekShiftsAll = shifts.filter((s) => s.week === weekOffset);
    const targets =
      selectedStoreId === "alle"
        ? storesActive.filter((s) => Boolean(s.employeeSiteKey))
        : storesActive.filter((s) => s.id === selectedStoreId && Boolean(s.employeeSiteKey));

    const planned: Shift[] = [];
    const tempWeekShifts = () => [...weekShiftsAll, ...planned];

    for (const store of targets) {
      const siteKey = store.employeeSiteKey;
      if (!siteKey) continue;

      for (const d of store.days) {
        if (!d.open) continue;
        const required = getRequiredStaffForDay(store, d.dayIndex, settings);
        if (required <= 0) continue;

        const existingCount = tempWeekShifts().filter(
          (s) => s.storeId === store.id && s.day === d.dayIndex && shiftDurationHours(s) > 0,
        ).length;
        const gap = Math.max(0, required - existingCount);
        if (gap <= 0) continue;

        const startTime = "10:00";
        const endTime = d.dayIndex === 5 ? "18:00" : "17:00";

        for (let i = 0; i < gap; i++) {
          const usedEmployeeIds = new Set(
            tempWeekShifts()
              .filter((s) => s.day === d.dayIndex && shiftDurationHours(s) > 0)
              .map((s) => s.employeeId),
          );

          const suggestion = createShiftSuggestions({
            employees,
            shifts: tempWeekShifts(),
            alerts: activeAlerts,
            selectedStoreId: store.id,
            stores,
            settings,
            week: weekOffset,
            day: d.dayIndex,
            startTime,
            endTime,
            limit: 8,
          });

          const picked = suggestion.candidates.find((c) => {
            if (usedEmployeeIds.has(c.employeeId)) return false; // never same employee twice same day
            const emp = employees.find((e) => e.id === c.employeeId);
            if (!emp) return false;
            const storeLabel = store.employeeSiteKey ?? "";
            const candidateShift: Shift = {
              id: "candidate",
              week: weekOffset,
              employeeId: c.employeeId,
              storeId: store.id,
              day: d.dayIndex,
              startTime,
              endTime,
              store: storeLabel,
              status: "normal",
              publishState: "draft" as const,
            };
            const check = canAssignShift({ employee: emp, shift: candidateShift, shifts: tempWeekShifts(), settings, stores });
            if (!check.ok) return false;
            return true;
          });

          if (!picked) break;

          planned.push({
            id: makeId(),
            week: weekOffset,
            employeeId: picked.employeeId,
            storeId: store.id,
            day: d.dayIndex,
            startTime,
            endTime,
            store: siteKey,
            status: "normal",
            publishState: "draft" as const,
          });
        }
      }
    }

    setAutoPlanDraft(planned);
    setIsAutoPlanConfirmOpen(true);
  }

  function publishVisibleWeek() {
    const ids = new Set(computed.weekShiftsVisible.map((s) => s.id));
    setShifts((prev) => prev.map((s) => (ids.has(s.id) ? { ...s, publishState: "published" as const } : s)));
    setToast({ message: "Ukeplan publisert", tone: "neutral" });
  }

  function isUnavailable(employeeId: string, day: number) {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return false;
    if (emp.unavailableDays.includes(day)) return true;
    return employeeUnavailableWholeCalendarDay(emp, weekOffset, day);
  }

  function addShift(employeeId: string, day: number) {
    if (selectedStoreId === "alle" || !selectedStoreUuid) {
      setToast({ message: "Velg en butikk før du legger til vakt", tone: "neutral" });
      return;
    }
    if (isUnavailable(employeeId, day)) return;
    const store = selectedSiteKey ?? "";
    const { startTime: st, endTime: et } = defaultShiftSlotTimes;
    const next: Shift = {
      id: makeId(),
      week: weekOffset,
      employeeId,
      storeId: selectedStoreUuid ?? undefined,
      day,
      startTime: st,
      endTime: et,
      store,
      status: "normal",
      publishState: "draft" as const,
    };
    const emp = employees.find((e) => e.id === employeeId) ?? null;
    if (emp) {
      const check = canAssignShift({ employee: emp, shift: next, shifts: computed.weekShiftsAll, settings, stores });
      if (!check.ok) {
        setToast({ message: check.reason, tone: "negative" });
        return;
      }
    }
    setShifts((prev) => [...prev, next]);
  }

  function onShiftClick(shift: Shift) {
    setSelectedShiftId(shift.id);
    setCreatingShift(null);
  }

  const selectedShiftCore = useMemo(
    () => (selectedShiftId ? shifts.find((s) => s.id === selectedShiftId && s.week === weekOffset) ?? null : null),
    [selectedShiftId, shifts, weekOffset],
  );
  const selectedShift = useMemo(() => {
    if (!selectedShiftCore) return null;
    const vo = shiftsView.find((s) => s.id === selectedShiftCore.id);
    return vo ? { ...selectedShiftCore, status: vo.status } : selectedShiftCore;
  }, [selectedShiftCore, shiftsView]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    // eslint-disable-next-line no-console
    console.log("[Planlegg dev] selectedStoreId", selectedStoreId);
    for (const s of shifts.filter((x) => x.week === weekOffset)) {
      // eslint-disable-next-line no-console
      console.log("[Planlegg dev] shift", { id: s.id, storeId: s.storeId });
    }
    for (const e of employees) {
      // eslint-disable-next-line no-console
      console.log("[Planlegg dev] employee", {
        id: e.id,
        storeIds: e.storeIds,
        primaryStoreId: e.primaryStoreId,
      });
    }
  }, [selectedStoreId, shifts, employees, weekOffset]);
  const panelShift = creatingShift ?? selectedShift;
  const panelIsCreate = Boolean(creatingShift);

  function closePanel() {
    setSelectedShiftId(null);
    setCreatingShift(null);
  }

  function saveShift(updated: Shift) {
    const normalized = normalizeShiftStoreFields(updated, stores, selectedStoreUuid ?? null);

    const emp = employees.find((e) => e.id === normalized.employeeId) ?? null;
    if (emp) {
      const check = canAssignShift({ employee: emp, shift: normalized, shifts: computed.weekShiftsAll, settings, stores });
      if (!check.ok) {
        setToast({ message: check.reason, tone: "negative" });
        return;
      }
    }
    setShifts((prev) => {
      const exists = prev.some((s) => s.id === normalized.id);
      return exists ? prev.map((s) => (s.id === normalized.id ? normalized : s)) : [...prev, normalized];
    });
    setSelectedShiftId(normalized.id);
    setCreatingShift(null);
  }

  function deleteShift(shiftId: string) {
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    setSelectedShiftId(null);
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

        <main className="min-w-0 flex-1">
          <TopBar
            alertsCount={alertCount}
            onBellClick={(rect) => {
              setAlertsAnchorRect(rect);
              setIsAlertsOpen((v) => !v);
            }}
            weekStartDate={weekStartDate}
            onWeekChange={(d) => setWeekOffset(weekOffsetFromDate(d))}
            onCopyWeek={() => setIsCopyConfirmOpen(true)}
            onPublishWeek={() => setIsPublishConfirmOpen(true)}
            onAutoPlanWeek={planAutoWeek}
            onExportPdf={() => openSchedulePrintPreview(exportModel)}
            onExportExcel={() => downloadScheduleCsv(exportModel, "shiftly-ukeplan.csv")}
            scheduleStoreOptions={scheduleStoreOptions}
            scheduleStoreValue={selectedStoreId}
            onScheduleStoreChange={(id) => setSelectedStoreId(id)}
            onNewShift={() => {
              if (selectedStoreId === "alle" || !selectedStoreUuid) {
                setToast({ message: "Velg en butikk før du legger til vakt", tone: "neutral" });
                return;
              }
              const siteKey = selectedSiteKey ?? "";
              const employeeId = employeesView[0]?.id ?? "";
              const { startTime: st, endTime: et } = defaultShiftSlotTimes;
              const next: Shift = {
                id: makeId(),
                week: weekOffset,
                employeeId,
                storeId: selectedStoreUuid ?? undefined,
                day: defaultDayIndexForNewShift(weekOffset),
                startTime: st,
                endTime: et,
                store: siteKey,
                status: "normal",
                publishState: "draft" as const,
              };
              setCreatingShift(next);
              setSelectedShiftId(null);
            }}
          />

          {shiftsLoading || employeesLoading || storesLoading ? (
            <div className="mt-4 rounded-[22px] bg-white/70 px-4 py-3 text-[13px] font-semibold text-slate-600 shadow-[0_14px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]">
              Laster data…
            </div>
          ) : null}

          <ScheduleGrid
            days={days}
            weekOffset={weekOffset}
            employees={employeesView}
            shifts={shiftsView}
            conflictShiftIds={conflictShiftIds}
            suggestionsEnabled={selectedStoreId !== "alle" && Boolean(selectedStoreUuid)}
            onRequireStoreSelection={() =>
              setToast({ message: "Velg en butikk før du legger til vakt", tone: "neutral" })
            }
            onOpenEmployee={(id) => {
              setSelectedEmployeeId(id);
              setIsEmployeePanelOpen(true);
            }}
            onOpenSuggestions={(originEmployeeId, day, anchorRect) => {
              if (selectedStoreId === "alle" || !selectedStoreUuid) {
                setToast({ message: "Velg en butikk før du legger til vakt", tone: "neutral" });
                return;
              }
              setSuggestions({ open: true, originEmployeeId, day, anchorRect });
            }}
            onShiftClick={onShiftClick}
            onMoveShift={(shiftId, nextEmployeeId, nextDay) => {
              if (isUnavailable(nextEmployeeId, nextDay)) return;
              setShifts((prev) => {
                const current = prev.find((s) => s.id === shiftId) ?? null;
                if (!current) return prev;
                const nextShift = normalizeShiftStoreFields(
                  { ...current, employeeId: nextEmployeeId, day: nextDay },
                  stores,
                  selectedStoreUuid ?? null,
                );
                const emp = employees.find((e) => e.id === nextEmployeeId) ?? null;
                if (emp) {
                  const check = canAssignShift({ employee: emp, shift: nextShift, shifts: prev, settings, stores });
                  if (!check.ok) {
                    setToast({ message: check.reason, tone: "negative" });
                    return prev;
                  }
                }
                return prev.map((s) => (s.id === shiftId ? nextShift : s));
              });
            }}
          />
        </main>
      </div>

      <ConfirmCopyWeekModal
        open={isCopyConfirmOpen}
        onCancel={() => setIsCopyConfirmOpen(false)}
        onConfirm={() => {
          const fromWeek = weekOffset;
          const toWeek = weekOffset + 1;
          const toCopy = shifts.filter((s) => s.week === fromWeek);
          const copied = toCopy.map((s) => ({
            ...s,
            id: makeId(),
            week: toWeek,
            publishState: "draft" as const,
          }));
          setShifts((prev) => [...prev, ...copied]);
          setIsCopyConfirmOpen(false);
          setWeekOffset(toWeek);
        }}
      />

      <PublishWeekModal
        open={isPublishConfirmOpen}
        hasCritical={hasCriticalAlerts}
        onCancel={() => setIsPublishConfirmOpen(false)}
        onConfirm={() => {
          publishVisibleWeek();
          setIsPublishConfirmOpen(false);
        }}
      />

      <AutoPlanWeekModal
        open={isAutoPlanConfirmOpen}
        count={autoPlanDraft.length}
        onConfirm={() => {
          if (autoPlanDraft.length > 0) setShifts((prev) => [...prev, ...autoPlanDraft]);
          setAutoPlanDraft([]);
          setIsAutoPlanConfirmOpen(false);
          setToast({ message: "Ukeplan foreslått", tone: "neutral" });
        }}
        onCancel={() => {
          setAutoPlanDraft([]);
          setIsAutoPlanConfirmOpen(false);
        }}
      />

      <ShiftSuggestionsPopup
        open={suggestions.open}
        anchorRect={suggestions.anchorRect}
        dayLabel={`${days[suggestions.day]?.short ?? ""} ${days[suggestions.day]?.date ?? ""}`.trim()}
        shiftTemplates={settings.shiftTemplates}
        suggestions={createShiftSuggestions({
          employees: employeesView,
          shifts: computed.weekShiftsAll,
          alerts: activeAlerts,
          stores,
          selectedStoreId,
          settings,
          week: weekOffset,
          day: suggestions.day,
          limit: 5,
        }).candidates}
        onPickEmployee={(employeeId) => {
          addShift(employeeId, suggestions.day);
          setSuggestions({ open: false, originEmployeeId: "", day: 0, anchorRect: null });
        }}
        onPickManual={() => {
          if (selectedStoreId === "alle" || !selectedStoreUuid) {
            setToast({ message: "Velg en butikk før du legger til vakt", tone: "neutral" });
            setSuggestions({ open: false, originEmployeeId: "", day: 0, anchorRect: null });
            return;
          }
          const siteKey = selectedSiteKey ?? "";
          const { startTime: st, endTime: et } = defaultShiftSlotTimes;
          const next: Shift = {
            id: makeId(),
            week: weekOffset,
            employeeId: suggestions.originEmployeeId || employeesView[0]?.id || "",
            storeId: selectedStoreUuid ?? undefined,
            day: suggestions.day,
            startTime: st,
            endTime: et,
            store: siteKey,
            status: "normal",
            publishState: "draft" as const,
          };
          setCreatingShift(next);
          setSelectedShiftId(null);
          setSuggestions({ open: false, originEmployeeId: "", day: 0, anchorRect: null });
        }}
        onPickTemplate={(tpl) => {
          if (selectedStoreId === "alle" || !selectedStoreUuid) {
            setToast({ message: "Velg en butikk før du legger til vakt", tone: "neutral" });
            setSuggestions({ open: false, originEmployeeId: "", day: 0, anchorRect: null });
            return;
          }
          const siteKey = selectedSiteKey ?? "";
          const next: Shift = {
            id: makeId(),
            week: weekOffset,
            employeeId: suggestions.originEmployeeId || employeesView[0]?.id || "",
            storeId: selectedStoreUuid ?? undefined,
            day: suggestions.day,
            startTime: tpl.startTime,
            endTime: tpl.endTime,
            store: siteKey,
            status: "normal",
            publishState: "draft" as const,
          };
          setCreatingShift(next);
          setSelectedShiftId(null);
          setSuggestions({ open: false, originEmployeeId: "", day: 0, anchorRect: null });
        }}
        onClose={() => setSuggestions({ open: false, originEmployeeId: "", day: 0, anchorRect: null })}
      />

      <ShiftDetailsPanel
        open={Boolean(panelShift)}
        employees={employees}
        shift={panelShift}
        shiftsForWeekAllStores={computed.weekShiftsAll}
        settings={settings}
        stores={stores}
        preferredStoreId={selectedStoreUuid}
        scheduleStoresForPicker={scheduleStoresForPicker}
        scheduleWeekDays={scheduleWeekDayOptions}
        isCreate={panelIsCreate}
        onClose={closePanel}
        onSave={saveShift}
        onDelete={deleteShift}
        onValidationError={(msg) => setToast({ message: msg, tone: "negative" })}
      />

      <EmployeeDetailsPanel
        open={isEmployeePanelOpen}
        employee={selectedEmployee}
        onClose={() => setIsEmployeePanelOpen(false)}
        onSave={(updated) => updateEmployee(updated)}
        onDelete={(id) => {
          setShifts((prev) => prev.filter((s) => s.employeeId !== id));
          setIsEmployeePanelOpen(false);
          setSelectedEmployeeId(null);
          deleteEmployeePersist(id);
        }}
      />

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "fixed bottom-6 left-1/2 z-50 w-[min(100vw-1.25rem,16rem)] -translate-x-1/2 rounded-xl px-2.5 py-1.5 text-[11px] font-medium leading-snug shadow-sm backdrop-blur-sm",
            toast.tone === "negative"
              ? "border border-rose-200/65 bg-rose-50/88 text-rose-900/95 shadow-[0_3px_10px_rgba(190,18,60,0.06)]"
              : "border border-slate-200/55 bg-white/82 text-slate-700 shadow-[0_3px_12px_rgba(15,23,42,0.05)]",
          )}
        >
          {toast.message}
        </div>
      ) : null}

      <AlertsPanel
        open={isAlertsOpen}
        anchorRect={alertsAnchorRect}
        alerts={activeAlerts}
        onClose={() => setIsAlertsOpen(false)}
      />
    </div>
  );
}
