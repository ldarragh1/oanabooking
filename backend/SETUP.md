# Going live: real bookings, real Stripe payments, real emails

This turns the demo into a working system. It uses:

- **Supabase** — free Postgres database + the serverless functions that do all the work. (Free tier: 500MB database, 500K function calls/month — miles more than a solo clinic needs.)
- **Resend** — sends the emails. (Free tier: 3,000 emails/month.)
- **Stripe** — takes the card payments. (No monthly fee — just their standard ~1.5–2.9% + fixed fee per transaction.)
- Somewhere to host the 4 static files (`admin-dashboard.html`, `booking.html`, `data.js`, `config.js`) — e.g. **Vercel** or **Netlify** (both free), or wherever homeopathicclinicdublin.com already lives.

Nothing in `/backend` is deployed yet — this is a checklist to do that. I can't do the account-creation steps for you (they need your email/payment details), but I can walk through any step live with you.

## 1. Create the accounts

1. [supabase.com](https://supabase.com) → New Project. Pick a region close to Ireland (e.g. `eu-west-2` London). Note the **Project URL** and, under Project Settings → API, the **anon public key** and **service_role key** (keep the service_role key secret — never put it in the frontend).
2. [resend.com](https://resend.com) → sign up → API Keys → create one. For real deliverability, add and verify `homeopathicclinicdublin.com` under Domains (needs a few DNS records added wherever the domain is managed) — until that's done you can still test using Resend's shared `onboarding@resend.dev` sender.
3. [stripe.com](https://stripe.com) → sign up → Developers → API keys → note the **Secret key** (starts `sk_`). Stripe starts in test mode, which is perfect for trying the whole flow with fake card `4242 4242 4242 4242` before going live.

## 2. Install the Supabase CLI and deploy the schema

```bash
brew install supabase/tap/supabase   # or see supabase.com/docs/guides/cli
cd backend
supabase login
supabase link --project-ref YOUR-PROJECT-REF   # from the Supabase dashboard URL
supabase db push                                # runs migrations/0001_init.sql
```

## 3. Set the function secrets

```bash
supabase secrets set \
  RESEND_API_KEY=re_xxx \
  EMAIL_FROM="Homeopathic Clinic Dublin <hello@homeopathicclinicdublin.com>" \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  ADMIN_KEY=$(openssl rand -hex 16) \
  PUBLIC_SITE_URL=https://your-booking-page-domain.com
```

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically inside Edge Functions — no need to set those.)

`STRIPE_WEBHOOK_SECRET` comes from step 5 below — you can leave it out for now and set it after.

Save the `ADMIN_KEY` value somewhere — you'll paste it into `config.js` in step 6.

## 4. Deploy the functions

```bash
supabase functions deploy book-appointment --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy availability --no-verify-jwt
supabase functions deploy admin-data --no-verify-jwt
supabase functions deploy admin-mutate --no-verify-jwt
supabase functions deploy send-reminders --no-verify-jwt
```

(`--no-verify-jwt` because these use the app's own `x-admin-key` check / are intentionally public, not Supabase Auth.)

Your function base URL is `https://YOUR-PROJECT-REF.supabase.co/functions/v1`.

## 5. Point Stripe at the webhook

Stripe Dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://YOUR-PROJECT-REF.supabase.co/functions/v1/stripe-webhook`
- Event: `checkout.session.completed`

Copy the **Signing secret** (`whsec_...`) it gives you and set it:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase functions deploy stripe-webhook --no-verify-jwt   # redeploy to pick it up
```

## 6. Point the frontend at the backend

Edit `/config.js`:

```js
const BACKEND_URL = 'https://YOUR-PROJECT-REF.supabase.co/functions/v1';
const ADMIN_KEY = 'the value you generated in step 3';
```

Deploy `admin-dashboard.html`, `booking.html`, `data.js`, `config.js` together to Vercel/Netlify/wherever. Make sure `PUBLIC_SITE_URL` (step 3) matches that hosting domain exactly — Stripe redirects back there after payment.

## 7. Schedule the 24-hour reminders

Supabase Dashboard → Edge Functions → `send-reminders` → there's a **Cron** tab in newer projects; add a schedule like `*/30 * * * *` (every 30 minutes).

If your project doesn't show that tab yet, do it via SQL instead (SQL Editor):

```sql
select cron.schedule(
  'send-appointment-reminders',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
```

(Needs the `pg_cron` and `pg_net` extensions enabled — Database → Extensions in the dashboard.)

## 8. Test it for real before going live

1. Open the hosted `booking.html`, book an online session, pay with Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC. Confirm the confirmation email arrives.
2. Book an in-person / pay-in-person session. Confirm it shows up on `admin-dashboard.html` with the "Pay in person" flag, and that you got a "booking received" email.
3. In the Supabase SQL editor, temporarily backdate an appointment's `appt_date`/`appt_time` to ~24 hours from now, then manually invoke `send-reminders` (its function URL, any GET request) and confirm the reminder email arrives and `reminder_sent` flips to `true`.
4. Only once all three work, switch `STRIPE_SECRET_KEY` to your **live** key (`sk_live_...`) and repeat the Stripe webhook step (step 5) for the live-mode webhook — test and live mode have separate webhooks/secrets in Stripe.

## What I could not verify myself

I don't have Supabase/Resend/Stripe accounts to deploy against, so none of the backend code above has run against real infrastructure yet — I've written it carefully and it follows each provider's documented patterns, but treat step 8 as the real test, not a formality. If something doesn't behave as expected, the Supabase function logs (Dashboard → Edge Functions → *function name* → Logs) are the first place to look — paste me the error and I'll fix it.
