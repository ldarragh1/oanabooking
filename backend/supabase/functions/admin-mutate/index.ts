// Single dispatcher for all admin writes (appointments, clients, progress
// notes, block-time). Protected by the x-admin-key header. Consolidated
// into one function — this is a small, single-tenant tool, so one
// action-routed endpoint is simpler to deploy and maintain than half a
// dozen near-identical tiny functions.
import { handlePreflight, json } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { isAdminAuthed } from "../_shared/adminAuth.ts";

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!isAdminAuthed(req)) return json({ error: "Unauthorized" }, 401);

  const sb = supabaseAdmin();
  const { action, payload } = await req.json();

  try {
    switch (action) {
      case "createAppt": {
        const { data: appt, error } = await sb.from("appointments").insert({
          client_id: payload.clientId, service_id: payload.serviceId, appt_date: payload.date,
          appt_time: payload.time, duration_min: payload.durationMin, mode: payload.mode,
          pay_method: payload.payMethod, pay_status: payload.payStatus, status: payload.status,
          source: "admin", notes: payload.notes || "",
        }).select().single();
        if (error) throw error;
        if (payload.clientId) {
          const { data: c } = await sb.from("clients").select("visits").eq("id", payload.clientId).single();
          await sb.from("clients").update({ visits: (c?.visits ?? 0) + 1, last_visit: payload.date }).eq("id", payload.clientId);
        }
        return json({ ok: true, appointment: appt });
      }
      case "updateAppt": {
        const { id, ...fields } = payload;
        const patch: Record<string, unknown> = {};
        if (fields.clientId !== undefined) patch.client_id = fields.clientId;
        if (fields.serviceId !== undefined) patch.service_id = fields.serviceId;
        if (fields.date !== undefined) patch.appt_date = fields.date;
        if (fields.time !== undefined) patch.appt_time = fields.time;
        if (fields.durationMin !== undefined) patch.duration_min = fields.durationMin;
        if (fields.mode !== undefined) patch.mode = fields.mode;
        if (fields.payMethod !== undefined) patch.pay_method = fields.payMethod;
        if (fields.payStatus !== undefined) patch.pay_status = fields.payStatus;
        if (fields.status !== undefined) patch.status = fields.status;
        if (fields.notes !== undefined) patch.notes = fields.notes;
        const { error } = await sb.from("appointments").update(patch).eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }
      case "deleteAppt": {
        const { error } = await sb.from("appointments").delete().eq("id", payload.id);
        if (error) throw error;
        return json({ ok: true });
      }
      case "markStatus": {
        const { error } = await sb.from("appointments").update({ status: payload.status }).eq("id", payload.id);
        if (error) throw error;
        return json({ ok: true });
      }
      case "markPaid": {
        const { error } = await sb.from("appointments").update({ pay_status: "paid" }).eq("id", payload.id);
        if (error) throw error;
        return json({ ok: true });
      }
      case "saveClient": {
        const fields = {
          name: payload.name, phone: payload.phone, email: payload.email,
          dob: payload.dob || null, address: payload.address || null,
        };
        if (payload.id) {
          const { error } = await sb.from("clients").update(fields).eq("id", payload.id);
          if (error) throw error;
          return json({ ok: true, id: payload.id });
        }
        const { data, error } = await sb.from("clients")
          .insert({ ...fields, since: new Date().toISOString().slice(0, 10), visits: 0 })
          .select().single();
        if (error) throw error;
        return json({ ok: true, id: data.id });
      }
      case "addNote": {
        const { error } = await sb.from("client_notes").insert({
          client_id: payload.clientId, note_date: payload.noteDate, body: payload.body,
        });
        if (error) throw error;
        return json({ ok: true });
      }
      case "blockTime": {
        const rows = [];
        let d = payload.from;
        const to = payload.to || payload.from;
        const startT = payload.timeFrom || "08:00";
        const endT = payload.timeTo || "20:00";
        const [sh, sm] = startT.split(":").map(Number);
        const [eh, em] = endT.split(":").map(Number);
        const durMin = Math.max((eh * 60 + em) - (sh * 60 + sm), 15);
        while (d <= to) {
          rows.push({
            client_id: null, service_id: null, appt_date: d, appt_time: startT,
            duration_min: durMin, mode: "in-person", status: "blocked", source: "admin",
            notes: payload.reason || "Blocked",
          });
          const [y, mo, day] = d.split("-").map(Number);
          const next = new Date(Date.UTC(y, mo - 1, day + 1));
          d = next.toISOString().slice(0, 10);
        }
        const { error } = await sb.from("appointments").insert(rows);
        if (error) throw error;
        return json({ ok: true, count: rows.length });
      }
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
