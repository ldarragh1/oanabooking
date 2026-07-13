// Scheduled function — set up a Supabase Cron job to call this every
// 30 minutes (see SETUP.md). Finds confirmed appointments starting in
// roughly 24 hours that haven't been reminded yet, emails them, and
// marks them as reminded so they're never sent twice.
import { handlePreflight, json } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { svc } from "../_shared/services.ts";
import { sendReminderEmail } from "../_shared/email.ts";
import { dublinNowNaiveMs, apptNaiveMs } from "../_shared/dublinTime.ts";

const WINDOW_MS = 30 * 60 * 1000; // ± this function's cron interval

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const sb = supabaseAdmin();
  const now = dublinNowNaiveMs();
  const windowStart = now + 24 * 3600 * 1000 - WINDOW_MS;
  const windowEnd = now + 24 * 3600 * 1000 + WINDOW_MS;

  // Narrow with a date range first (cheap index hit), then filter exactly
  // in JS since Postgres doesn't know about our "naive Dublin ms" scheme.
  const { data: candidates, error } = await sb
    .from("appointments")
    .select("*, clients(name, email)")
    .eq("status", "confirmed")
    .eq("reminder_sent", false)
    .gte("appt_date", new Date(windowStart - 86400000).toISOString().slice(0, 10))
    .lte("appt_date", new Date(windowEnd + 86400000).toISOString().slice(0, 10));

  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  for (const a of candidates ?? []) {
    const ms = apptNaiveMs(a.appt_date, a.appt_time);
    if (ms < windowStart || ms > windowEnd) continue;
    const client = (a as unknown as { clients: { name: string; email: string } | null }).clients;
    if (!client?.email) continue;

    const service = svc(a.service_id);
    await sendReminderEmail({
      to: client.email, clientName: client.name, serviceName: service.name,
      mode: a.mode, apptDate: a.appt_date, apptTime: a.appt_time.slice(0, 5),
    });
    await sb.from("appointments").update({ reminder_sent: true }).eq("id", a.id);
    sent++;
  }

  return json({ checked: candidates?.length ?? 0, sent });
});
