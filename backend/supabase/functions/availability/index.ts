// Public endpoint: GET /availability?date=YYYY-MM-DD&serviceId=1
// Returns free start times ('HH:MM') for that date + service duration.
import { handlePreflight, json } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { svc } from "../_shared/services.ts";
import { businessHoursFor } from "../_shared/availability.ts";
import { dublinTodayStr } from "../_shared/dublinTime.ts";

function t2m(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function m2t(m: number) { return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
const LUNCH: [number, number] = [13, 14];

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const serviceId = Number(url.searchParams.get("serviceId"));
  if (!date || !serviceId) return json({ error: "date and serviceId are required" }, 400);

  const bh = businessHoursFor(date);
  if (!bh) return json({ slots: [] });

  const service = svc(serviceId);
  const sb = supabaseAdmin();
  const { data: existing, error } = await sb
    .from("appointments")
    .select("appt_time, duration_min")
    .eq("appt_date", date)
    .neq("status", "cancelled");
  if (error) return json({ error: error.message }, 500);

  const busy = (existing ?? []).map((a) => {
    const start = t2m(a.appt_time.slice(0, 5));
    return { start, end: start + a.duration_min };
  });

  const isToday = date === dublinTodayStr();
  const nowMin = isToday ? t2m(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date())) : -1;

  const slots: string[] = [];
  const dayStart = bh[0] * 60, dayEnd = bh[1] * 60;
  for (let m = dayStart; m + service.dur <= dayEnd; m += 15) {
    const slotEnd = m + service.dur;
    if (m < LUNCH[1] * 60 && slotEnd > LUNCH[0] * 60) continue;
    if (isToday && m <= nowMin + 30) continue;
    if (busy.some((b) => m < b.end && slotEnd > b.start)) continue;
    slots.push(m2t(m));
  }
  return json({ slots });
});
