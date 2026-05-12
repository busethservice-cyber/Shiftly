/** Half-hour HH:mm slots from 06:00 through 23:30 (inclusive). */
export function openingHalfHourTimeOptions(): string[] {
  const out: string[] = [];
  for (let mins = 6 * 60; mins <= 23 * 60 + 30; mins += 30) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return out;
}

export const OPENING_HALF_HOUR_TIME_OPTIONS = openingHalfHourTimeOptions();
