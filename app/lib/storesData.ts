import type { RetailStore, StoreDaySchedule } from "@/app/lib/types";

export function createDefaultStoreDays(): StoreDaySchedule[] {
  return Array.from({ length: 7 }, (_, dayIndex) => ({
    dayIndex,
    open: true,
    startTime: "10:00",
    endTime: "18:00",
    minStaff: 3,
    staffingNote: "",
  }));
}

function dayTemplate(dayIndex: number, patch: Partial<StoreDaySchedule>): StoreDaySchedule {
  return {
    dayIndex,
    open: true,
    startTime: "10:00",
    endTime: "18:00",
    minStaff: 3,
    staffingNote: "",
    ...patch,
  };
}

export function summarizeOpeningHours(days: StoreDaySchedule[]): string {
  if (days.every((d) => !d.open)) return "Stengt alle dager";
  const slot = (d: StoreDaySchedule) => `${d.startTime}–${d.endTime}`;
  const openDays = days.filter((d) => d.open);
  const uniq = new Set(openDays.map(slot));
  if (uniq.size === 1 && openDays[0]) {
    const s = openDays[0];
    if (openDays.length === 7) return `Alle dager ${slot(s)}`;
    const weekdaysOnly =
      days.slice(0, 5).every((d) => d.open) && !days[5]?.open && !days[6]?.open && openDays.length === 5;
    if (weekdaysOnly) return `Man–fre ${slot(s)}`;
  }
  return `${openDays.length} dager · varierende tider`;
}

export function summarizeWeeklyStaffing(days: StoreDaySchedule[]): string {
  const openDays = days.filter((d) => d.open);
  const total = openDays.reduce((acc, d) => acc + (Number.isFinite(d.minStaff) ? Math.max(0, d.minStaff) : 0), 0);
  const denom = openDays.length || 1;
  const avg = total / denom;
  return `Min. ${total} personer/uke (snitt ${avg.toFixed(1).replace(".", ",")} per åpen dag)`;
}

export const initialRetailStores: RetailStore[] = [
  {
    id: "shop-solsiden",
    name: "Bjørklund Solsiden",
    address: "Nedre Bakklandet 58, 7014 Trondheim",
    phone: "+47 73 12 34 56",
    status: "active",
    notes: "Hovedbutikk · god flyt i rushtidene.",
    employeeSiteKey: "Solsiden",
    days: [
      dayTemplate(0, { startTime: "09:00", endTime: "20:00", minStaff: 4 }),
      dayTemplate(1, { startTime: "09:00", endTime: "20:00", minStaff: 4 }),
      dayTemplate(2, { startTime: "09:00", endTime: "20:00", minStaff: 4 }),
      dayTemplate(3, { startTime: "09:00", endTime: "20:00", minStaff: 4 }),
      dayTemplate(4, { startTime: "09:00", endTime: "21:00", minStaff: 5 }),
      dayTemplate(5, { startTime: "10:00", endTime: "18:00", minStaff: 4 }),
      dayTemplate(6, { open: false, startTime: "10:00", endTime: "16:00", minStaff: 0 }),
    ],
  },
  {
    id: "shop-citylade",
    name: "Bjørklund City Lade",
    address: "City Syd, 7075 Tiller",
    phone: "+47 73 98 76 54",
    status: "active",
    notes: "Kjøpesenter · ekstra vaktbehov i helger.",
    employeeSiteKey: "City Lade",
    days: [
      dayTemplate(0, { startTime: "10:00", endTime: "20:00", minStaff: 3 }),
      dayTemplate(1, { startTime: "10:00", endTime: "20:00", minStaff: 3 }),
      dayTemplate(2, { startTime: "10:00", endTime: "20:00", minStaff: 3 }),
      dayTemplate(3, { startTime: "10:00", endTime: "20:00", minStaff: 3 }),
      dayTemplate(4, { startTime: "10:00", endTime: "20:00", minStaff: 3 }),
      dayTemplate(5, {
        startTime: "10:00",
        endTime: "18:00",
        minStaff: 5,
        staffingNote: "Ekstra bemanning lørdag",
      }),
      dayTemplate(6, { startTime: "12:00", endTime: "17:00", minStaff: 2 }),
    ],
  },
];
