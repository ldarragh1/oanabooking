// Everything in this system (appt_date/appt_time columns, business hours)
// is a Dublin wall-clock value with no timezone attached. To compare "now"
// against those values correctly across the GMT/IST (UTC+0/+1) switch, we
// read the current wall-clock time in Europe/Dublin via Intl and treat it
// as a naive timestamp — never mix it with the server's real UTC "now"
// directly, or you get the same off-by-one-hour class of bug that hit the
// frontend's date helpers (see data.js comment on dateStr()).

function dublinParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Dublin",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) if (p.type !== "literal") parts[p.type] = p.value;
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second),
  };
}

// Naive ms timestamp representing the current Dublin wall-clock moment,
// constructed as if it were UTC. Only ever compare this to other values
// built the same way (see apptNaiveMs below).
export function dublinNowNaiveMs(): number {
  const p = dublinParts(new Date());
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

// appt_date is 'YYYY-MM-DD', appt_time is 'HH:MM:SS' (Postgres time format).
export function apptNaiveMs(apptDate: string, apptTime: string): number {
  const [y, mo, d] = apptDate.split("-").map(Number);
  const [h, mi] = apptTime.split(":").map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, 0);
}

export function dublinTodayStr(): string {
  const p = dublinParts(new Date());
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
