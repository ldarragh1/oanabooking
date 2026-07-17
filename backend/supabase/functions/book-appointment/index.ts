// Public endpoint the booking page calls to submit a booking.
//
// - payMethod 'in-person': books immediately (status=confirmed, pay_status=
//   unpaid), sends a "booking received" email, and returns straight away.
// - payMethod 'stripe' (online sessions, or in-person + pay-online-now):
//   nothing is written to the database yet. A Stripe Checkout Session is
//   created with the booking details in its metadata, and its URL is
//   returned for the browser to redirect to. The appointment is only
//   created once Stripe confirms payment, via stripe-webhook — this is
//   what makes "only get a confirmed session if paid" actually true.
import Stripe from "npm:stripe@17";
import { corsHeaders, handlePreflight, json } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { svc } from "../_shared/services.ts";
import { isSlotFree } from "../_shared/availability.ts";
import { sendBookingReceivedEmail } from "../_shared/email.ts";

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const { serviceId, mode, payMethod, date, time, name, email, phone, notes } = body;

    if (!serviceId || !mode || !payMethod || !date || !time || !name || !email || !phone) {
      return json({ error: "Missing required fields." }, 400);
    }
    if (mode === "online" && payMethod !== "stripe") {
      return json({ error: "Online sessions must be paid via Stripe." }, 400);
    }

    const service = svc(serviceId);
    const sb = supabaseAdmin();

    const { data: existing, error: exErr } = await sb
      .from("appointments")
      .select("appt_time, duration_min")
      .eq("appt_date", date)
      .neq("status", "cancelled");
    if (exErr) throw exErr;

    if (!isSlotFree(date, time, service.dur, mode, existing ?? [])) {
      return json({ error: "That time is no longer available. Please pick another slot." }, 409);
    }

    if (payMethod === "stripe") {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
        httpClient: Stripe.createFetchHttpClient(),
        apiVersion: "2024-06-20",
      });
      const siteUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://example.com";
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{
          price_data: {
            currency: "eur",
            unit_amount: service.price * 100,
            product_data: { name: `${service.name} — ${mode === "online" ? "Online" : "In Person"}` },
          },
          quantity: 1,
        }],
        customer_email: email,
        success_url: `${siteUrl}/booking.html?paid=1`,
        cancel_url: `${siteUrl}/booking.html?cancelled=1`,
        metadata: { serviceId: String(serviceId), mode, date, time, name, email, phone, notes: notes || "" },
        // Shows a "promo code" field on Stripe's checkout page. Oana creates
        // and manages codes herself in the Stripe Dashboard (Product catalogue
        // → Coupons, then Payment links or Coupons → create a promotion code)
        // — no code changes needed for her to add/retire codes.
        allow_promotion_codes: true,
      });
      return json({ checkoutUrl: session.url });
    }

    // payMethod === 'in-person': book now, unpaid.
    let { data: client } = await sb.from("clients").select("*").ilike("email", email).maybeSingle();
    if (!client) {
      const { data: newClient, error: cErr } = await sb
        .from("clients")
        .insert({ name, phone, email, since: date, visits: 0, color: null })
        .select()
        .single();
      if (cErr) throw cErr;
      client = newClient;
    } else {
      await sb.from("clients").update({ phone }).eq("id", client.id);
    }

    const { data: appt, error: aErr } = await sb
      .from("appointments")
      .insert({
        client_id: client.id, service_id: serviceId, appt_date: date, appt_time: time,
        duration_min: service.dur, mode, pay_method: "in-person", pay_status: "unpaid",
        status: "confirmed", source: "online", notes: notes || "",
      })
      .select()
      .single();
    if (aErr) throw aErr;

    await sb.from("clients").update({ visits: (client.visits ?? 0) + 1, last_visit: date }).eq("id", client.id);
    await sendBookingReceivedEmail({ to: email, clientName: name, serviceName: service.name, apptDate: date, apptTime: time, price: service.price });

    return json({ ok: true, appointmentId: appt.id });
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
