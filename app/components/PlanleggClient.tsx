"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Employee, EmployeeComputed, Shift } from "@/app/lib/types";
import { Sidebar } from "@/app/components/Sidebar";
import { TopBar } from "@/app/components/TopBar";
import { ScheduleGrid } from "@/app/components/ScheduleGrid";
import { ShiftDetailsPanel } from "@/app/components/ShiftDetailsPanel";
import { EmployeeDetailsPanel } from "@/app/components/EmployeeDetailsPanel";
import { formatHours, isShiftOff, parseTimeToMinutes, round1, shiftDurationHours } from "@/app/lib/hours";
import { createShiftSuggestions } from "@/app/lib/smartSuggestions";
import { useAlerts } from "@/app/components/AlertsProvider";
import { AlertsPanel } from "@/app/components/AlertsPanel";
import { ConfirmCopyWeekModal } from "@/app/components/ConfirmCopyWeekModal";
import { PublishWeekModal } from "@/app/components/PublishWeekModal";
import { AutoPlanWeekModal } from "@/app/components/AutoPlanWeekModal";
import { OverContractConfirmModal } from "@/app/components/OverContractConfirmModal";
import { QuickShiftCreatePopup } from "@/app/components/QuickShiftCreatePopup";
import { QuickShiftEditPopup } from "@/app/components/QuickShiftEditPopup";
import { CopyShiftModal } from "@/app/components/CopyShiftModal";
import { PlannerDayActionsModal } from "@/app/components/PlannerDayActionsModal";
import { ShiftContextMenu } from "@/app/components/ShiftContextMenu";
import { PlannerToolbar } from "@/app/components/PlannerToolbar";
import { buildScheduleExportModel, downloadScheduleCsv, openSchedulePrintPreview } from "@/app/lib/exportSchedule";
import { useWorkforce } from "@/app/components/WorkforceProvider";
import { useStores } from "@/app/components/StoresProvider";
import { useSettings } from "@/app/components/SettingsProvider";
import { addDays, baseWeekStart, dayShort, formatNorDate, makeId, monthsShort } from "@/app/lib/mockData";
import { getToday, getWeekStart, isSameDay } from "@/app/lib/dateUtils";
import { currentWeekOffset, weekLabelShort, weekOffsetFromDate, weekStartDateFromOffset } from "@/app/lib/weekDate";
import { cn } from "@/app/lib/cn";
import { getContractStatus, getPlannedHoursForEmployee } from "@/app/lib/rules/contracts";
import { getRequiredStaffForDay, getStaffingLevel, getStaffingStatusForDay } from "@/app/lib/rules/staffing";
import { activeStores } from "@/app/lib/storeUtils";
import {
  canAssignShift,
  employeeUnavailableWholeCalendarDay,
  isAssignBlocked,
  normalizeShiftStoreFields,
} from "@/app/lib/rules/shifts";

type PlanleggToast = { message: string; tone: "neutral" | "negative" };

const LAST_SCHEDULE_STORE_KEY = "shiftly:lastScheduleStoreId";

function resolveInitialScheduleStoreId(activeStoreIds: string[]): string {
  if (typeof window === "undefined") return "alle";
  try {
    const saved = window.localStorage.getItem(LAST_SCHEDULE_STORE_KEY);
    if (saved && saved !== "alle" && activeStoreIds.includes(saved)) return saved;
  } catch {
    /* ignore */
  }
  if (activeStoreIds.length === 1) return activeStoreIds[0]!;
  return "alle";
}

export function PlanleggClient() {
  const { employees, updateEmployee, deleteEmployee: deleteEmployeePersist, shifts, setEmployees, setShifts, shiftsLoading, employeesLoading } = useWorkforce();
  const { stores, storesLoading } = useStores();
  const { settings } = useSettings();
  const { activeAlerts, alertCount } = useAlerts();

  const [weekOffset, setWeekOffset] = useState(() => currentWeekOffset());
  const [selectedStoreId, setSelectedStoreId] = useState<string>("alle");
  const storeSelectionInitialized = useRef(false);
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
  const [overContractPending, setOverContractPending] = useState<{ message: string; action: () => void } | null>(null);
  const [quickCreate, setQuickCreate] = useState<{
    open: boolean;
    employeeId: string;
    day: number;
    anchorRect: DOMRect | null;
  }>({ open: false, employeeId: "", day: 0, anchorRect: null });
  const [quickEdit, setQuickEdit] = useState<{ open: boolean; shiftId: string; anchorRect: DOMRect | null }>({
    open: false,
    shiftId: "",
    anchorRect: null,
  });
  const [copyShiftId, setCopyShiftId] = useState<string | null>(null);
  const [shiftContextMenu, setShiftContextMenu] = useState<{ shiftId: string; x: number; y: number } | null>(null);
  const [dayActions, setDayActions] = useState<{ open: boolean; mode: "copy_day" | "clear_day" }>({
    open: false,
    mode: "copy_day",
  });

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

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

  const isAlleStoresMode = selectedStoreId === "alle";

  useEffect(() => {
    if (storesLoading || storeSelectionInitialized.current) return;
    if (storesActive.length === 0) return;
    storeSelectionInitialized.current = true;
    setSelectedStoreId(resolveInitialScheduleStoreId(storesActive.map((s) => s.id)));
  }, [storesLoading, storesActive]);

  useEffect(() => {
    if (selectedStoreId === "alle") return;
    try {
      window.localStorage.setItem(LAST_SCHEDULE_STORE_KEY, selectedStoreId);
    } catch {
      /* ignore */
    }
  }, [selectedStoreId]);

  useEffect(() => {
    if (selectedStoreId === "alle") return;
    if (!storesActive.some((s) => s.id === selectedStoreId)) setSelectedStoreId("alle");
  }, [storesActive, selectedStoreId]);

  function selectScheduleStore(id: string) {
    setSelectedStoreId(id);
    if (id !== "alle") {
      try {
        window.localStorage.setItem(LAST_SCHEDULE_STORE_KEY, id);
      } catch {
        /* ignore */
      }
    }
  }

  function requireStoreForEditing() {
    setToast({ message: "Velg en butikk før du legger til vakt", tone: "neutral" });
  }

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

  const staffingByDay = useMemo(() => {
    const weekShifts = computed.weekShiftsAll;
    return days.map((_, dayIndex) => {
      if (isAlleStoresMode) {
        let required = 0;
        for (const store of storesActive) {
          required += getRequiredStaffForDay(store, dayIndex, settings);
        }
        const planned = weekShifts.filter((s) => s.day === dayIndex && shiftDurationHours(s) > 0).length;
        if (required <= 0) return null;
        return getStaffingLevel(planned, required);
      }
      if (!selectedStore) return null;
      const storeShifts = weekShifts.filter((s) => s.storeId === selectedStore.id);
      const dayShifts = storeShifts.filter((s) => s.day === dayIndex && shiftDurationHours(s) > 0);
      const { required, level } = getStaffingStatusForDay(dayShifts, selectedStore, dayIndex, settings);
      if (required <= 0) return null;
      return level;
    });
  }, [computed.weekShiftsAll, days, isAlleStoresMode, selectedStore, settings, storesActive]);

  const copyWeekPreview = useMemo(() => {
    const destStart = addDays(baseWeekStart, (weekOffset + 1) * 7);
    return {
      count: computed.weekShiftsVisible.length,
      sourceLabel: weekLabelShort(weekStartDate),
      destLabel: weekLabelShort(destStart),
      shifts: computed.weekShiftsVisible,
    };
  }, [computed.weekShiftsVisible, weekOffset, weekStartDate]);

  const quickEditShift = useMemo(
    () => (quickEdit.shiftId ? shifts.find((s) => s.id === quickEdit.shiftId && s.week === weekOffset) ?? null : null),
    [quickEdit.shiftId, shifts, weekOffset],
  );

  const copyShiftSource = useMemo(
    () => (copyShiftId ? shifts.find((s) => s.id === copyShiftId && s.week === weekOffset) ?? null : null),
    [copyShiftId, shifts, weekOffset],
  );

  const quickCreateEmployeeName = useMemo(
    () => employeesView.find((e) => e.id === quickCreate.employeeId)?.name ?? "Ansatt",
    [employeesView, quickCreate.employeeId],
  );

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
    });
  }, [computed.weekShiftsVisible, employeesView, selectedStoreId, stores, weekLabel, weekOffset]);

  function runWithAssignCheck(employee: Employee, shift: Shift, weekShifts: Shift[], onProceed: () => void) {
    const check = canAssignShift({ employee, shift, shifts: weekShifts, settings, stores });
    if (isAssignBlocked(check)) {
      setToast({ message: check.reason, tone: "negative" });
      return;
    }
    if (check.status === "warning") {
      setOverContractPending({ message: check.reason, action: onProceed });
      return;
    }
    onProceed();
  }

  function clampShiftToOpening(args: { defaultStart: string; defaultEnd: string; openStart: string; openEnd: string }) {
    const { defaultStart, defaultEnd, openStart, openEnd } = args;
    const start = Math.max(parseTimeToMinutes(defaultStart), parseTimeToMinutes(openStart));
    const end = Math.min(parseTimeToMinutes(defaultEnd), parseTimeToMinutes(openEnd));
    if (end <= start) return null;
    const toHM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    return { startTime: toHM(start), endTime: toHM(end) };
  }

  function planAutoWeek() {
    if (isAlleStoresMode) {
      requireStoreForEditing();
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
            if (check.status !== "allowed") return false;
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

  function createShiftAt(args: { employeeId: string; day: number; startTime: string; endTime: string; onDone?: () => void }) {
    if (isAlleStoresMode || !selectedStoreUuid) {
      requireStoreForEditing();
      return;
    }
    if (isUnavailable(args.employeeId, args.day)) {
      setToast({ message: "Ansatt er utilgjengelig denne dagen", tone: "negative" });
      return;
    }
    const store = selectedSiteKey ?? "";
    const next: Shift = {
      id: makeId(),
      week: weekOffset,
      employeeId: args.employeeId,
      storeId: selectedStoreUuid ?? undefined,
      day: args.day,
      startTime: args.startTime,
      endTime: args.endTime,
      store,
      status: "normal",
      publishState: "draft" as const,
    };
    const emp = employees.find((e) => e.id === args.employeeId) ?? null;
    const apply = () => {
      setShifts((prev) => [...prev, next]);
      args.onDone?.();
      setToast({ message: "Vakt opprettet", tone: "neutral" });
    };
    if (emp) {
      runWithAssignCheck(emp, next, computed.weekShiftsAll, apply);
      return;
    }
    apply();
  }

  function closeQuickCreate() {
    setQuickCreate({ open: false, employeeId: "", day: 0, anchorRect: null });
  }

  function duplicateShiftToDays(source: Shift, targetDays: number[]) {
    const additions: Shift[] = [];
    for (const day of targetDays) {
      const next: Shift = {
        ...source,
        id: makeId(),
        day,
        publishState: "draft" as const,
      };
      const emp = employees.find((e) => e.id === next.employeeId);
      if (!emp) continue;
      const check = canAssignShift({
        employee: emp,
        shift: next,
        shifts: [...computed.weekShiftsAll, ...additions],
        settings,
        stores,
      });
      if (check.status === "blocked") continue;
      additions.push(next);
    }
    if (additions.length === 0) {
      setToast({ message: "Kunne ikke kopiere vakt", tone: "negative" });
      return;
    }
    setShifts((prev) => [...prev, ...additions]);
    setToast({ message: `${additions.length} vakt${additions.length === 1 ? "" : "er"} kopiert`, tone: "neutral" });
    setCopyShiftId(null);
  }

  function copyDayShifts(sourceDay: number, targetDays: number[]) {
    const sourceShifts = computed.weekShiftsVisible.filter((s) => s.day === sourceDay);
    const additions = targetDays.flatMap((targetDay) =>
      sourceShifts.map((s) => ({
        ...s,
        id: makeId(),
        day: targetDay,
        publishState: "draft" as const,
      })),
    );
    if (additions.length === 0) {
      setToast({ message: "Ingen vakter å kopiere", tone: "neutral" });
      return;
    }
    setShifts((prev) => [...prev, ...additions]);
    setToast({ message: `${additions.length} vakter kopiert`, tone: "neutral" });
    setDayActions({ open: false, mode: "copy_day" });
  }

  function clearDayShifts(day: number) {
    const ids = new Set(computed.weekShiftsVisible.filter((s) => s.day === day).map((s) => s.id));
    setShifts((prev) => prev.filter((s) => !ids.has(s.id)));
    setToast({ message: "Vakter fjernet", tone: "neutral" });
    setDayActions({ open: false, mode: "clear_day" });
  }

  function shiftCountForDay(day: number) {
    return computed.weekShiftsVisible.filter((s) => s.day === day).length;
  }

  function onShiftClick(shift: Shift, anchorRect: DOMRect) {
    if (isAlleStoresMode) {
      requireStoreForEditing();
      return;
    }
    setQuickEdit({ open: true, shiftId: shift.id, anchorRect });
    setSelectedShiftId(null);
    setCreatingShift(null);
  }

  function quickSaveShift(updated: Shift) {
    const normalized = normalizeShiftStoreFields(updated, stores, selectedStoreUuid ?? null);
    const emp = employees.find((e) => e.id === normalized.employeeId) ?? null;
    const apply = () => {
      saveShift(normalized);
      setQuickEdit({ open: false, shiftId: "", anchorRect: null });
      setToast({ message: "Vakt lagret", tone: "neutral" });
    };
    if (emp) {
      const weekShiftsExcluding = computed.weekShiftsAll.filter((s) => s.id !== normalized.id);
      runWithAssignCheck(emp, normalized, weekShiftsExcluding, apply);
      return;
    }
    apply();
  }

  function openFullPanelFromQuick(shift: Shift) {
    setQuickEdit({ open: false, shiftId: "", anchorRect: null });
    const normalized = normalizeShiftStoreFields(shift, stores, selectedStoreUuid ?? null);
    setShifts((prev) => prev.map((s) => (s.id === normalized.id ? normalized : s)));
    setSelectedShiftId(normalized.id);
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
            onExportExcel={() => downloadScheduleCsv(exportModel, "shiftly-ukeplan.xls")}
            scheduleStoreOptions={scheduleStoreOptions}
            scheduleStoreValue={selectedStoreId}
            onScheduleStoreChange={selectScheduleStore}
            scheduleEditingDisabled={isAlleStoresMode}
            onNewShift={() => {
              if (isAlleStoresMode || !selectedStoreUuid) {
                requireStoreForEditing();
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

          {isAlleStoresMode && storesActive.length > 0 ? (
            <div
              className="mt-4 rounded-[22px] bg-violet-50/55 px-4 py-3.5 shadow-[0_14px_30px_rgba(15,23,42,0.05)] ring-1 ring-violet-100/80"
              role="status"
            >
              <p className="text-[13px] font-semibold text-violet-900/90">
                Velg en butikk for å legge til eller redigere vakter.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {storesActive.map((store) => (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => selectScheduleStore(store.id)}
                    className="rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-semibold text-violet-700 shadow-[0_10px_22px_rgba(15,23,42,0.05)] ring-1 ring-violet-100 hover:bg-violet-50"
                  >
                    {store.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <PlannerToolbar
            disabled={isAlleStoresMode}
            onCopyDay={() => {
              if (isAlleStoresMode) {
                requireStoreForEditing();
                return;
              }
              setDayActions({ open: true, mode: "copy_day" });
            }}
            onCopyWeek={() => setIsCopyConfirmOpen(true)}
            onClearDay={() => {
              if (isAlleStoresMode) {
                requireStoreForEditing();
                return;
              }
              setDayActions({ open: true, mode: "clear_day" });
            }}
          />

          <ScheduleGrid
            days={days}
            weekOffset={weekOffset}
            employees={employeesView}
            shifts={shiftsView}
            conflictShiftIds={conflictShiftIds}
            staffingByDay={staffingByDay}
            suggestionsEnabled={!isAlleStoresMode && Boolean(selectedStoreUuid)}
            dragEnabled={!isAlleStoresMode}
            onRequireStoreSelection={requireStoreForEditing}
            onOpenEmployee={(id) => {
              setSelectedEmployeeId(id);
              setIsEmployeePanelOpen(true);
            }}
            onOpenSuggestions={(originEmployeeId, day, anchorRect) => {
              if (isAlleStoresMode || !selectedStoreUuid) {
                requireStoreForEditing();
                return;
              }
              setQuickCreate({ open: true, employeeId: originEmployeeId, day, anchorRect });
            }}
            onShiftClick={onShiftClick}
            onShiftContextMenu={(shift, x, y) => {
              if (isAlleStoresMode) return;
              setShiftContextMenu({ shiftId: shift.id, x, y });
            }}
            showStoreOnShifts={isAlleStoresMode}
            onMoveShift={(shiftId, nextEmployeeId, nextDay) => {
              if (isAlleStoresMode) {
                requireStoreForEditing();
                return;
              }
              if (isUnavailable(nextEmployeeId, nextDay)) return;
              const current = shifts.find((s) => s.id === shiftId) ?? null;
              if (!current) return;
              const nextShift = normalizeShiftStoreFields(
                { ...current, employeeId: nextEmployeeId, day: nextDay },
                stores,
                selectedStoreUuid ?? null,
              );
              const apply = () => {
                setShifts((prev) => prev.map((s) => (s.id === shiftId ? nextShift : s)));
              };
              const emp = employees.find((e) => e.id === nextEmployeeId) ?? null;
              if (!emp) {
                apply();
                return;
              }
              runWithAssignCheck(emp, nextShift, shifts.filter((s) => s.week === weekOffset), apply);
            }}
          />
        </main>
      </div>

      <ConfirmCopyWeekModal
        open={isCopyConfirmOpen}
        shiftCount={copyWeekPreview.count}
        sourceWeekLabel={copyWeekPreview.sourceLabel}
        destWeekLabel={copyWeekPreview.destLabel}
        onCancel={() => setIsCopyConfirmOpen(false)}
        onConfirm={() => {
          const toWeek = weekOffset + 1;
          const copied = copyWeekPreview.shifts.map((s) => ({
            ...s,
            id: makeId(),
            week: toWeek,
            publishState: "draft" as const,
          }));
          setShifts((prev) => [...prev, ...copied]);
          setIsCopyConfirmOpen(false);
          setWeekOffset(toWeek);
          setToast({ message: `${copied.length} vakter kopiert`, tone: "neutral" });
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

      <QuickShiftCreatePopup
        open={quickCreate.open}
        anchorRect={quickCreate.anchorRect}
        employeeName={quickCreateEmployeeName}
        dayLabel={`${days[quickCreate.day]?.short ?? ""} ${days[quickCreate.day]?.date ?? ""}`.trim()}
        storeName={selectedStore?.name ?? "Butikk"}
        shiftTemplates={settings.shiftTemplates}
        defaultStartTime={defaultShiftSlotTimes.startTime}
        defaultEndTime={defaultShiftSlotTimes.endTime}
        onPickTemplate={(tpl) => {
          createShiftAt({
            employeeId: quickCreate.employeeId,
            day: quickCreate.day,
            startTime: tpl.startTime,
            endTime: tpl.endTime,
            onDone: closeQuickCreate,
          });
        }}
        onCreateCustom={(startTime, endTime) => {
          createShiftAt({
            employeeId: quickCreate.employeeId,
            day: quickCreate.day,
            startTime,
            endTime,
            onDone: closeQuickCreate,
          });
        }}
        onClose={closeQuickCreate}
      />

      <QuickShiftEditPopup
        open={quickEdit.open}
        anchorRect={quickEdit.anchorRect}
        shift={quickEditShift}
        employees={employeesView}
        shiftTemplates={settings.shiftTemplates}
        onSave={quickSaveShift}
        onMoreOptions={openFullPanelFromQuick}
        onClose={() => setQuickEdit({ open: false, shiftId: "", anchorRect: null })}
      />

      <CopyShiftModal
        open={Boolean(copyShiftId)}
        shift={copyShiftSource}
        weekDays={scheduleWeekDayOptions}
        onConfirm={(targetDays) => {
          if (copyShiftSource) duplicateShiftToDays(copyShiftSource, targetDays);
        }}
        onCancel={() => setCopyShiftId(null)}
      />

      <PlannerDayActionsModal
        open={dayActions.open}
        mode={dayActions.mode}
        weekDays={scheduleWeekDayOptions}
        shiftCount={shiftCountForDay}
        onConfirm={(sourceDay, targetDays) => {
          if (dayActions.mode === "copy_day") copyDayShifts(sourceDay, targetDays);
          else clearDayShifts(sourceDay);
        }}
        onCancel={() => setDayActions({ open: false, mode: "copy_day" })}
      />

      <ShiftContextMenu
        open={Boolean(shiftContextMenu)}
        x={shiftContextMenu?.x ?? 0}
        y={shiftContextMenu?.y ?? 0}
        onCopy={() => {
          if (shiftContextMenu) setCopyShiftId(shiftContextMenu.shiftId);
        }}
        onClose={() => setShiftContextMenu(null)}
      />

      <ShiftDetailsPanel
        open={Boolean(panelShift) && !quickEdit.open}
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

      <OverContractConfirmModal
        open={Boolean(overContractPending)}
        message={overContractPending?.message ?? ""}
        onConfirm={() => {
          overContractPending?.action();
          setOverContractPending(null);
        }}
        onCancel={() => setOverContractPending(null)}
      />
    </div>
  );
}
