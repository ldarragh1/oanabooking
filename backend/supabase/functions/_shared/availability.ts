// Mirrors BUSINESS_HOURS in /data.js — keep both in sync.
//   Mon: online 10-5, in-person 10-3
//   Tue: online 10-5 only (no in-person)
//   Wed: online 9-6 only, every second week
//   Thu/Fri: closed
//   Sat: online 10-2 only, every second week
//   Sun: closed
type DayHours = { online?: [number, number]; "in-person"?: [number, number]; biweekly?: boolean };
const BUSINESS_HOURS: Record<number, DayHours> = {
  1: { online: [10, 17], "in-person": [10, 15] },
  2: { online: [10, 17] },
  3: { online: [9, 18], biweekly: true },
  6: { online: [10, 14], biweekly: true },
};

// Must match ISO_WEEK_PARITY_OFFSET in /data.js.
const ISO_WEEK_PARITY_OFFSET = 0;
function isoWeekNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}
function isBiweeklyActiveWeek(dateStr: string): boolean {
  return (isoWeekNumber(dateStr) + ISO_WEEK_PARITY_OFFSET) % 2 === 1;
}

export function businessHoursFor(dateStr: string, mode: "online" | "in-person"): [number, number] | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const day = BUSINESS_HOURS[wd];
  if (!day) return null;
  if (day.biweekly && !isBiweeklyActiveWeek(dateStr)) return null;
  return day[mode] ?? null;
}

function t2m(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

// existing: [{ appt_time: 'HH:MM:SS', duration_min: number }]
export function isSlotFree(dateStr: string, time: string, durMin: number, mode: "online" | "in-person", existing: { appt_time: string; duration_min: number }[]): boolean {
  const bh = businessHoursFor(dateStr, mode);
  if (!bh) return false;
  const start = t2m(time), end = start + durMin;
  if (start < bh[0] * 60 || end > bh[1] * 60) return false;
  return !existing.some((a) => {
    const bStart = t2m(a.appt_time.slice(0, 5));
    const bEnd = bStart + a.duration_min;
    return start < bEnd && end > bStart;
  });
}
