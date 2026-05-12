import type { Employee, Shift } from "@/app/lib/types";

export const baseWeekStart = new Date("2024-05-20T00:00:00");
export const dayShort = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"] as const;

export const monthsShort = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatNorDate(d: Date) {
  return `${d.getDate()}. ${monthsShort[d.getMonth()]}`;
}

export const initialEmployees: Employee[] = [
  {
    id: "anna",
    name: "Anna Johansen",
    contractPercent: 20,
    contractHours: 7.5,
    unavailableDays: [],
    unavailablePeriods: [
      { id: "anna-p1", startDate: "2024-06-10", endDate: "2024-06-14", reason: "Ferie" },
    ],
    primaryStoreId: "shop-solsiden",
    storeIds: ["shop-solsiden"],
    primaryStore: "Solsiden",
    badges: ["Tilgjengelig"],
    notes: "",
    avatarBg: "from-sky-200 to-indigo-200",
  },
  {
    id: "emil",
    name: "Emil Larsen",
    contractPercent: 40,
    contractHours: 15,
    unavailableDays: [],
    unavailablePeriods: [],
    primaryStoreId: "shop-citylade",
    storeIds: ["shop-citylade"],
    primaryStore: "City Lade",
    badges: ["Tilgjengelig"],
    notes: "",
    avatarBg: "from-emerald-200 to-cyan-200",
  },
  {
    id: "sara",
    name: "Sara Nilsen",
    contractPercent: 30,
    contractHours: 11.25,
    unavailableDays: [2],
    unavailablePeriods: [
      {
        id: "sara-p1",
        startDate: "2024-05-21",
        endDate: "2024-05-21",
        startTime: "16:00",
        endTime: "22:00",
        reason: "Skole",
      },
    ],
    primaryStoreId: "shop-solsiden",
    storeIds: ["shop-solsiden", "shop-citylade"],
    primaryStore: "Solsiden",
    badges: ["Ferie"],
    notes: "Ønsker ikke kveldsvakter på onsdager.",
    avatarBg: "from-violet-200 to-fuchsia-200",
  },
  {
    id: "jonas",
    name: "Jonas Berg",
    contractPercent: 60,
    contractHours: 22.5,
    unavailableDays: [4],
    unavailablePeriods: [],
    primaryStoreId: "shop-citylade",
    storeIds: ["shop-citylade"],
    primaryStore: "City Lade",
    badges: ["Fri"],
    notes: "",
    avatarBg: "from-amber-200 to-orange-200",
  },
  {
    id: "maria",
    name: "Maria Solberg",
    contractPercent: 20,
    contractHours: 7.5,
    unavailableDays: [],
    unavailablePeriods: [],
    primaryStoreId: "shop-citylade",
    storeIds: ["shop-citylade"],
    primaryStore: "City Lade",
    badges: ["Syk"],
    notes: "",
    avatarBg: "from-rose-200 to-pink-200",
  },
  {
    id: "lars",
    name: "Lars Hansen",
    contractPercent: 50,
    contractHours: 18.75,
    unavailableDays: [],
    unavailablePeriods: [],
    primaryStoreId: "shop-solsiden",
    storeIds: ["shop-solsiden", "shop-citylade"],
    primaryStore: "Solsiden",
    badges: ["Tilgjengelig"],
    notes: "",
    avatarBg: "from-teal-200 to-sky-200",
  },
  {
    id: "heidi",
    name: "Heidi Olsen",
    contractPercent: 80,
    contractHours: 30,
    unavailableDays: [],
    unavailablePeriods: [],
    primaryStoreId: "shop-citylade",
    storeIds: ["shop-citylade"],
    primaryStore: "City Lade",
    badges: ["Tilgjengelig"],
    notes: "",
    avatarBg: "from-lime-200 to-emerald-200",
  },
];

export const initialShifts: Shift[] = [
  {
    id: "a1",
    week: 0,
    employeeId: "anna",
    storeId: "shop-solsiden",
    day: 0,
    startTime: "10:00",
    endTime: "17:00",
    store: "Solsiden",
    status: "normal",
    publishState: "draft",
    showMenu: true,
  },
  { id: "a2", week: 0, employeeId: "anna", storeId: "shop-solsiden", day: 2, startTime: "12:00", endTime: "20:00", store: "Solsiden", status: "normal", publishState: "draft" },
  { id: "a3", week: 0, employeeId: "anna", storeId: "shop-solsiden", day: 3, startTime: "10:00", endTime: "16:00", store: "Solsiden", status: "normal", publishState: "draft" },

  {
    id: "e1",
    week: 0,
    employeeId: "emil",
    storeId: "shop-citylade",
    day: 1,
    startTime: "12:00",
    endTime: "20:00",
    store: "City Lade",
    status: "normal",
    publishState: "draft",
    showMenu: true,
  },
  { id: "e2", week: 0, employeeId: "emil", storeId: "shop-citylade", day: 3, startTime: "12:00", endTime: "20:00", store: "City Lade", status: "normal", publishState: "draft" },
  { id: "e3", week: 0, employeeId: "emil", storeId: "shop-citylade", day: 4, startTime: "09:00", endTime: "17:00", store: "City Lade", status: "normal", publishState: "draft" },

  { id: "s1", week: 0, employeeId: "sara", storeId: "shop-solsiden", day: 0, startTime: "10:00", endTime: "17:00", store: "Solsiden", status: "normal", publishState: "draft" },
  { id: "s2", week: 0, employeeId: "sara", storeId: "shop-solsiden", day: 5, startTime: "10:00", endTime: "18:00", store: "Solsiden", status: "near_limit", publishState: "draft" },
  { id: "s3", week: 0, employeeId: "sara", storeId: "shop-citylade", day: 6, startTime: "09:00", endTime: "15:00", store: "City Lade", status: "normal", publishState: "draft" },

  { id: "j1", week: 0, employeeId: "jonas", storeId: "shop-citylade", day: 1, startTime: "12:00", endTime: "18:00", store: "City Lade", status: "normal", publishState: "draft" },
  { id: "j2", week: 0, employeeId: "jonas", storeId: "shop-citylade", day: 3, startTime: "", endTime: "", store: "Fri", status: "normal", publishState: "draft" },
  { id: "j3", week: 0, employeeId: "jonas", storeId: "shop-citylade", day: 4, startTime: "", endTime: "", store: "Fri", status: "normal", publishState: "draft" },

  { id: "m1", week: 0, employeeId: "maria", storeId: "shop-citylade", day: 2, startTime: "16:00", endTime: "21:00", store: "City Lade", status: "normal", publishState: "draft" },
  { id: "m2", week: 0, employeeId: "maria", storeId: "shop-citylade", day: 3, startTime: "09:00", endTime: "17:00", store: "City Lade", status: "normal", publishState: "draft" },

  { id: "l1", week: 0, employeeId: "lars", storeId: "shop-solsiden", day: 0, startTime: "12:00", endTime: "20:00", store: "Solsiden", status: "normal", publishState: "draft" },
  { id: "l2", week: 0, employeeId: "lars", storeId: "shop-citylade", day: 1, startTime: "10:00", endTime: "20:00", store: "City Lade", status: "normal", publishState: "draft" },
  { id: "l3", week: 0, employeeId: "lars", storeId: "shop-solsiden", day: 4, startTime: "10:00", endTime: "18:00", store: "Solsiden", status: "near_limit", publishState: "draft" },

  { id: "h1", week: 0, employeeId: "heidi", storeId: "shop-citylade", day: 2, startTime: "10:00", endTime: "19:00", store: "City Lade", status: "over_limit", publishState: "draft" },
  { id: "h2", week: 0, employeeId: "heidi", storeId: "shop-citylade", day: 6, startTime: "14:00", endTime: "22:00", store: "City Lade", status: "over_limit", publishState: "draft" },
];

export function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}
