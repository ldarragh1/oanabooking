// Stripe calls this when a Checkout Session completes. This is the only
// place a Stripe-paid appointment actually gets written to the database —
// never trust the browser's redirect back alone, always confirm via webhook.
//
// In the Stripe Dashboard: Developers → Webhooks → Add endpoint →
//   <your-function-url>/stripe-webhook, event: checkout.session.completed.
import Stripe from "npm:stripe@17";
import { corsHeaders, handlePreflight, json } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { svc } from "../_shared/services.ts";
import { sendConfirmationEmail } from "../_shared/email.ts";

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: "2024-06-20",
  });

  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature!,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const m = session.metadata!;
    const serviceId = Number(m.serviceId);
    const service = svc(serviceId);
    const sb = supabaseAdmin();

    try {
      // Stripe may deliver the same event more than once — make this
      // idempotent so a retry can't create a duplicate appointment.
      const { data: already } = await sb
        .from("appointments").select("id").eq("stripe_session_id", session.id).maybeSingle();
      if (already) return json({ received: true, duplicate: true });

      let { data: client } = await sb.from("clients").select("*").ilike("email", m.email).maybeSingle();
      if (!client) {
        const { data: newClient, error: cErr } = await sb
          .from("clients")
          .insert({ name: m.name, phone: m.phone, email: m.email, since: m.date, visits: 0 })
          .select()
          .single();
        if (cErr) throw cErr;
        client = newClient;
      } else {
        await sb.from("clients").update({ phone: m.phone }).eq("id", client.id);
      }

      await sb.from("appointments").insert({
        client_id: client.id, service_id: serviceId, appt_date: m.date, appt_time: m.time,
        duration_min: service.dur, mode: m.mode, pay_method: "stripe", pay_status: "paid",
        status: "confirmed", source: "online", notes: m.notes || "", stripe_session_id: session.id,
      });
      await sb.from("clients").update({ visits: (client.visits ?? 0) + 1, last_visit: m.date }).eq("id", client.id);

      await sendConfirmationEmail({
        to: m.email, clientName: m.name, serviceName: service.name,
        mode: m.mode as "online" | "in-person", apptDate: m.date, apptTime: m.time, price: service.price,
      });
    } catch (e) {
      console.error("Failed to finalize paid booking:", e);
      // Returning 500 makes Stripe retry the webhook — safe, since the
      // insert above isn't guaranteed idempotent yet (see SETUP.md notes).
      return new Response("Internal error", { status: 500 });
    }
  }

  return json({ received: true });
});
