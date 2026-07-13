// Returns all clients (with their notes) and all appointments for the
// admin dashboard. Protected by the x-admin-key header.
import { handlePreflight, json } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { isAdminAuthed } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (!isAdminAuthed(req)) return json({ error: "Unauthorized" }, 401);

  const sb = supabaseAdmin();
  const [{ data: clients, error: cErr }, { data: notes, error: nErr }, { data: appts, error: aErr }] = await Promise.all([
    sb.from("clients").select("*").order("name"),
    sb.from("client_notes").select("*").order("note_date", { ascending: false }),
    sb.from("appointments").select("*").order("appt_date").order("appt_time"),
  ]);
  if (cErr || nErr || aErr) return json({ error: (cErr || nErr || aErr)!.message }, 500);

  const notesByClient: Record<number, typeof notes> = {};
  for (const n of notes ?? []) (notesByClient[n.client_id] ??= []).push(n);
  const clientsOut = (clients ?? []).map((c) => ({ ...c, notes: notesByClient[c.id] ?? [] }));

  return json({ clients: clientsOut, appointments: appts ?? [] });
});
