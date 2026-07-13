// Mirrors BUSINESS_HOURS/LUNCH in /data.js — keep both in sync.
const BUSINESS_HOURS: Record<number, [number, number]> = { 1: [9, 17], 2: [9, 17], 3: [9, 17], 4: [9, 17], 5: [9, 17] };
const LUNCH: [number, number] = [13, 14];

export function businessHoursFor(dateStr: string): [number, number] | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return BUSINESS_HOURS[wd] ?? null;
}

function t2m(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

// existing: [{ appt_time: 'HH:MM:SS', duration_min: number }]
export function isSlotFree(dateStr: string, time: string, durMin: number, existing: { appt_time: string; duration_min: number }[]): boolean {
  const bh = businessHoursFor(dateStr);
  if (!bh) return false;
  const start = t2m(time), end = start + durMin;
  if (start < bh[0] * 60 || end > bh[1] * 60) return false;
  if (start < LUNCH[1] * 60 && end > LUNCH[0] * 60) return false;
  return !existing.some((a) => {
    const bStart = t2m(a.appt_time.slice(0, 5));
    const bEnd = bStart + a.duration_min;
    return start < bEnd && end > bStart;
  });
}
