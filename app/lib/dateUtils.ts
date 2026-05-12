import { monthsShort } from "@/app/lib/mockData";

export function getToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Week starts on Monday (0=Mon .. 6=Sun)
export function getWeekStart(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const jsDay = d.getDay(); // 0=Sun .. 6=Sat
  const mondayIndex = (jsDay + 6) % 7;
  d.setDate(d.getDate() - mondayIndex);
  return d;
}

export function addWeeks(date: Date, amount: number) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + amount * 7);
  return d;
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isDateInWeek(date: Date, weekStartDate: Date) {
  const start = getWeekStart(weekStartDate);
  const end = addWeeks(start, 1);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return start.getTime() <= d.getTime() && d.getTime() < end.getTime();
}

export function formatWeekLabel(weekStartDate: Date) {
  const start = getWeekStart(weekStartDate);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  end.setDate(end.getDate() + 6);

  const startLabel = `${start.getDate()}.`;
  const endLabel = `${end.getDate()}. ${monthsShort[end.getMonth()]} ${end.getFullYear()}`;
  return `${startLabel} – ${endLabel}`;
}

