// Public endpoint the booking page calls to submit a booking.
//
// Every path now goes through Stripe Checkout before anything is written
// to the database — the appointment is only created once Stripe confirms
// payment, via stripe-webhook. This is what makes "only get a confirmed
// session if paid [something]" actually true, deposit included:
//
// - payMethod 'stripe' (online sessions, or in-person + pay-online-now):
//   charges the full service price. pay_status ends up 'paid'.
// - payMethod 'in-person': charges only the €20 deposit (DEPOSIT_AMOUNT)
//   to secure the slot — the remainder is paid at the session. pay_status
//   ends up 'deposit_paid'. Forfeited on cancellations inside 24 hours.
import Stripe from "npm:stripe@17";
import { corsHeaders, handlePreflight, json } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { svc, DEPOSIT_AMOUNT } from "../_shared/services.ts";
import { isSlotFree } from "../_shared/availability.ts";

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

    const isDeposit = payMethod === "in-person";
    const amount = isDeposit ? DEPOSIT_AMOUNT : service.price;
    const productLabel = isDeposit
      ? `${service.name} — Deposit (€${service.price - DEPOSIT_AMOUNT} balance due in person)`
      : `${service.name} — ${mode === "online" ? "Online" : "In Person"}`;

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
          unit_amount: amount * 100,
          product_data: { name: productLabel },
        },
        quantity: 1,
      }],
      customer_email: email,
      success_url: `${siteUrl}/booking.html?paid=1`,
      cancel_url: `${siteUrl}/booking.html?cancelled=1`,
      metadata: {
        serviceId: String(serviceId), mode, date, time, name, email, phone, notes: notes || "",
        depositOnly: isDeposit ? "1" : "0",
      },
      // Shows a "promo code" field on Stripe's checkout page. Oana creates
      // and manages codes herself in the Stripe Dashboard (Product catalogue
      // → Coupons, then Payment links or Coupons → create a promotion code)
      // — no code changes needed for her to add/retire codes. Deposits are
      // intentionally excluded — a discount code should reduce the full
      // session price, not a fixed booking deposit.
      allow_promotion_codes: !isDeposit,
    });
    return json({ checkoutUrl: session.url });
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
