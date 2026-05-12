"use client";

export type ExportFormat = "pdf" | "excel";

export type ShiftTemplate = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
};

export type ShiftlySettings = {
  fullTimeHours: number;
  autoCalculateContractHours: boolean;
  nearContractThreshold: number; // 0..1

  warnOverContract: boolean;
  warnNearContract: boolean;
  markOverContractShifts: boolean;

  minStaffPerOpenDay: number;
  extraSaturdayStaffing: boolean;

  allowMultiStoreWork: boolean;
  allowShiftSwap: boolean;
  requireShiftSwapApproval: boolean;
  blockSwapIfOverContract: boolean;
  blockSwapIfUnavailable: boolean;

  notifyNewShift: boolean;
  notifyChangedShift: boolean;
  notifyUnderstaffing: boolean;
  notifyUnavailableConflict: boolean;
  notifyNearContract: boolean;
  notifyOverContract: boolean;

  defaultExportFormat: ExportFormat;

  // Existing MVP settings (keep current UI/features working)
  defaultPauseDeducted: boolean;
  defaultPauseMinutes: number;
  showMerTimeWarningPartTime: boolean;
  warnBeforePublishOverContract: boolean;

  shiftTemplates: ShiftTemplate[];

  allowEmployeeAvailability: boolean;
  requireManagerAbsenceApproval: boolean;
  absenceTypes: string[];

  showStorePickerInPlanning: boolean;
  confirmBeforePublishWeek: boolean;
  sendWeekPlanOnPublish: boolean;
  showUnpublishedAsUnconfirmed: boolean;

  exportShowPositionPercent: boolean;
  exportShowContractHours: boolean;
  exportIncludeAlerts: boolean;

  // Backwards-compat aliases (to be removed later)
  fullTimeWeeklyHours: number;
  autoContractFromPercent: boolean;
  warnNearContractPercent: number; // 0..100
  markShiftsOverContract: boolean;
  extraStaffSaturday: boolean;
  swapRequireManagerApproval: boolean;
  swapDisallowOverContract: boolean;
  swapDisallowUnavailable: boolean;
  pushNewShift: boolean;
  pushChangedShift: boolean;
  notifyUnderstaffed: boolean;
  notifyUnavailableScheduled: boolean;
};

export function createDefaultSettings(): ShiftlySettings {
  return {
    fullTimeHours: 37.5,
    autoCalculateContractHours: true,
    nearContractThreshold: 0.9,

    warnOverContract: true,
    warnNearContract: true,
    markOverContractShifts: true,

    minStaffPerOpenDay: 2,
    extraSaturdayStaffing: true,

    allowMultiStoreWork: true,
    allowShiftSwap: true,
    requireShiftSwapApproval: true,
    blockSwapIfOverContract: true,
    blockSwapIfUnavailable: true,

    notifyNewShift: true,
    notifyChangedShift: true,
    notifyUnderstaffing: true,
    notifyUnavailableConflict: true,
    notifyNearContract: true,
    notifyOverContract: true,

    defaultExportFormat: "pdf",

    defaultPauseDeducted: false,
    defaultPauseMinutes: 30,
    showMerTimeWarningPartTime: true,
    warnBeforePublishOverContract: true,

    shiftTemplates: [
      { id: "tpl-tidlig", name: "Tidligvakt", startTime: "09:00", endTime: "16:00" },
      { id: "tpl-dag", name: "Dagvakt", startTime: "10:00", endTime: "17:00" },
      { id: "tpl-kveld", name: "Kveldsvakt", startTime: "12:00", endTime: "20:00" },
      { id: "tpl-lordag", name: "Lørdag", startTime: "10:00", endTime: "18:00" },
    ],

    allowEmployeeAvailability: true,
    requireManagerAbsenceApproval: true,
    absenceTypes: ["Fri", "Ferie", "Syk", "Skole", "Annet"],

    showStorePickerInPlanning: true,
    confirmBeforePublishWeek: true,
    sendWeekPlanOnPublish: true,
    showUnpublishedAsUnconfirmed: true,

    exportShowPositionPercent: true,
    exportShowContractHours: true,
    exportIncludeAlerts: false,

    // aliases
    fullTimeWeeklyHours: 37.5,
    autoContractFromPercent: true,
    warnNearContractPercent: 90,
    markShiftsOverContract: true,
    extraStaffSaturday: true,
    swapRequireManagerApproval: true,
    swapDisallowOverContract: true,
    swapDisallowUnavailable: true,
    pushNewShift: true,
    pushChangedShift: true,
    notifyUnderstaffed: true,
    notifyUnavailableScheduled: true,
  };
}

export function normalizeSettings(input: Partial<ShiftlySettings> | null | undefined): ShiftlySettings {
  const defaults = createDefaultSettings();
  const s = { ...defaults, ...(input ?? {}) };

  // Map legacy keys to new ones if new ones are missing.
  if (typeof (input as any)?.fullTimeHours !== "number" && typeof (input as any)?.fullTimeWeeklyHours === "number") {
    s.fullTimeHours = Number((input as any).fullTimeWeeklyHours);
  }
  if (
    typeof (input as any)?.autoCalculateContractHours !== "boolean" &&
    typeof (input as any)?.autoContractFromPercent === "boolean"
  ) {
    s.autoCalculateContractHours = Boolean((input as any).autoContractFromPercent);
  }
  if (
    typeof (input as any)?.nearContractThreshold !== "number" &&
    typeof (input as any)?.warnNearContractPercent === "number"
  ) {
    s.nearContractThreshold = Number((input as any).warnNearContractPercent) / 100;
  }
  if (
    typeof (input as any)?.markOverContractShifts !== "boolean" &&
    typeof (input as any)?.markShiftsOverContract === "boolean"
  ) {
    s.markOverContractShifts = Boolean((input as any).markShiftsOverContract);
  }
  if (
    typeof (input as any)?.requireShiftSwapApproval !== "boolean" &&
    typeof (input as any)?.swapRequireManagerApproval === "boolean"
  ) {
    s.requireShiftSwapApproval = Boolean((input as any).swapRequireManagerApproval);
  }
  if (
    typeof (input as any)?.blockSwapIfOverContract !== "boolean" &&
    typeof (input as any)?.swapDisallowOverContract === "boolean"
  ) {
    s.blockSwapIfOverContract = Boolean((input as any).swapDisallowOverContract);
  }
  if (
    typeof (input as any)?.blockSwapIfUnavailable !== "boolean" &&
    typeof (input as any)?.swapDisallowUnavailable === "boolean"
  ) {
    s.blockSwapIfUnavailable = Boolean((input as any).swapDisallowUnavailable);
  }
  if (
    typeof (input as any)?.notifyUnderstaffing !== "boolean" &&
    typeof (input as any)?.notifyUnderstaffed === "boolean"
  ) {
    s.notifyUnderstaffing = Boolean((input as any).notifyUnderstaffed);
  }
  if (
    typeof (input as any)?.notifyUnavailableConflict !== "boolean" &&
    typeof (input as any)?.notifyUnavailableScheduled === "boolean"
  ) {
    s.notifyUnavailableConflict = Boolean((input as any).notifyUnavailableScheduled);
  }
  if (
    typeof (input as any)?.extraSaturdayStaffing !== "boolean" &&
    typeof (input as any)?.extraStaffSaturday === "boolean"
  ) {
    s.extraSaturdayStaffing = Boolean((input as any).extraStaffSaturday);
  }
  if (typeof (input as any)?.notifyNewShift !== "boolean" && typeof (input as any)?.pushNewShift === "boolean") {
    s.notifyNewShift = Boolean((input as any).pushNewShift);
  }
  if (typeof (input as any)?.notifyChangedShift !== "boolean" && typeof (input as any)?.pushChangedShift === "boolean") {
    s.notifyChangedShift = Boolean((input as any).pushChangedShift);
  }

  const near = Number(s.nearContractThreshold);
  s.nearContractThreshold = Number.isFinite(near) ? Math.max(0, Math.min(1, near)) : defaults.nearContractThreshold;

  const ft = Number(s.fullTimeHours);
  s.fullTimeHours = Number.isFinite(ft) ? Math.max(0, ft) : defaults.fullTimeHours;

  const min = Number(s.minStaffPerOpenDay);
  s.minStaffPerOpenDay = Number.isFinite(min) ? Math.max(0, min) : defaults.minStaffPerOpenDay;

  // Keep aliases in sync (for existing code paths until fully migrated).
  s.fullTimeWeeklyHours = s.fullTimeHours;
  s.autoContractFromPercent = s.autoCalculateContractHours;
  s.warnNearContractPercent = Math.round(s.nearContractThreshold * 100);
  s.markShiftsOverContract = s.markOverContractShifts;
  s.extraStaffSaturday = s.extraSaturdayStaffing;
  s.swapRequireManagerApproval = s.requireShiftSwapApproval;
  s.swapDisallowOverContract = s.blockSwapIfOverContract;
  s.swapDisallowUnavailable = s.blockSwapIfUnavailable;
  s.pushNewShift = s.notifyNewShift;
  s.pushChangedShift = s.notifyChangedShift;
  s.notifyUnderstaffed = s.notifyUnderstaffing;
  s.notifyUnavailableScheduled = s.notifyUnavailableConflict;

  return s;
}

