const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// apptDate is 'YYYY-MM-DD' — format without going through JS Date/UTC
// conversion so it can't drift a day (see dublinTime.ts).
function fmtDateLong(apptDate: string): string {
  const [y, m, d] = apptDate.split("-").map(Number);
  const dow = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dow}, ${d} ${MON[m - 1]} ${y}`;
}

// "Name <email@domain.com>" -> { name, email }. Falls back to a bare email
// if there's no "Name <...>" wrapper.
function parseFrom(from: string): { email: string; name?: string } {
  const m = from.match(/^(.*)<(.+)>$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { email: from.trim() };
}

async function sendViaResend(apiKey: string, from: string, to: string, subject: string, html: string, replyTo?: string) {
  const body: Record<string, unknown> = { from, to, subject, html };
  if (replyTo) body.reply_to = replyTo;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error("Resend error", res.status, await res.text());
  return res.ok;
}

// SendGrid verifies a sending domain with CNAME records only (no MX) — the
// fallback for domains, like this one, hosted somewhere (Wix) that won't
// allow custom MX records. Switch providers by setting EMAIL_PROVIDER=
// sendgrid and SENDGRID_API_KEY — no further code changes needed.
async function sendViaSendGrid(apiKey: string, from: string, to: string, subject: string, html: string, replyTo?: string) {
  const body: Record<string, unknown> = {
    personalizations: [{ to: [{ email: to }] }],
    from: parseFrom(from),
    subject,
    content: [{ type: "text/html", value: html }],
  };
  if (replyTo) body.reply_to = { email: replyTo };
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error("SendGrid error", res.status, await res.text());
  return res.ok;
}

async function sendEmail(to: string, subject: string, html: string) {
  const provider = (Deno.env.get("EMAIL_PROVIDER") || "resend").toLowerCase();
  const from = Deno.env.get("EMAIL_FROM") || "Homeopathic Clinic Dublin <onboarding@resend.dev>";
  const replyTo = Deno.env.get("EMAIL_REPLY_TO"); // e.g. homeopathicclinicdublin@gmail.com — the inbox Oana actually checks

  if (provider === "sendgrid") {
    const apiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!apiKey) {
      console.warn(`SENDGRID_API_KEY not set — skipping email to ${to}: ${subject}`);
      return { skipped: true };
    }
    return { skipped: false, ok: await sendViaSendGrid(apiKey, from, to, subject, html, replyTo) };
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.warn(`RESEND_API_KEY not set — skipping email to ${to}: ${subject}`);
    return { skipped: true };
  }
  return { skipped: false, ok: await sendViaResend(apiKey, from, to, subject, html, replyTo) };
}

function wrapper(bodyHtml: string) {
  return `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#23291f">
    <h2 style="font-family:Georgia,serif;color:#0d9488;margin-bottom:4px">Homeopathic Clinic Dublin</h2>
    ${bodyHtml}
    <p style="font-size:13px;color:#756f60;margin-top:32px;border-top:1px solid #e6e1d3;padding-top:16px">
      Elmwood House, 35 Ranelagh, Dublin 6 · +353 86 213 6885<br>
      Need to reschedule or cancel? Just reply to this email.
    </p>
  </div>`;
}

export async function sendConfirmationEmail(opts: {
  to: string; clientName: string; serviceName: string; mode: "online" | "in-person";
  apptDate: string; apptTime: string; price: number;
}) {
  const where = opts.mode === "online" ? "Online (video call — link to follow separately)" : "Elmwood House, 35 Ranelagh, Dublin 6";
  const html = wrapper(`
    <p>Hi ${opts.clientName},</p>
    <p>Your <strong>${opts.serviceName}</strong> is confirmed.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:6px 0;color:#756f60">When</td><td style="padding:6px 0;text-align:right;font-weight:700">${fmtDateLong(opts.apptDate)} · ${opts.apptTime}</td></tr>
      <tr><td style="padding:6px 0;color:#756f60">Where</td><td style="padding:6px 0;text-align:right;font-weight:700">${where}</td></tr>
      <tr><td style="padding:6px 0;color:#756f60">Paid</td><td style="padding:6px 0;text-align:right;font-weight:700">€${opts.price}</td></tr>
    </table>
    <p>We look forward to seeing you.</p>`);
  return sendEmail(opts.to, "Your appointment is confirmed", html);
}

export async function sendBookingReceivedEmail(opts: {
  to: string; clientName: string; serviceName: string;
  apptDate: string; apptTime: string; price: number;
}) {
  const html = wrapper(`
    <p>Hi ${opts.clientName},</p>
    <p>Your <strong>${opts.serviceName}</strong> is booked at Elmwood House, 35 Ranelagh, Dublin 6.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:6px 0;color:#756f60">When</td><td style="padding:6px 0;text-align:right;font-weight:700">${fmtDateLong(opts.apptDate)} · ${opts.apptTime}</td></tr>
      <tr><td style="padding:6px 0;color:#756f60">Payment</td><td style="padding:6px 0;text-align:right;font-weight:700">€${opts.price} — pay in person</td></tr>
    </table>
    <p>Please bring payment (cash or card) to your session.</p>`);
  return sendEmail(opts.to, "Your appointment is booked", html);
}

export async function sendReminderEmail(opts: {
  to: string; clientName: string; serviceName: string; mode: "online" | "in-person";
  apptDate: string; apptTime: string;
}) {
  const where = opts.mode === "online" ? "This will be an online session — check your email for the video link." : "Elmwood House, 35 Ranelagh, Dublin 6";
  const html = wrapper(`
    <p>Hi ${opts.clientName},</p>
    <p>Just a reminder — your <strong>${opts.serviceName}</strong> is tomorrow.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:6px 0;color:#756f60">When</td><td style="padding:6px 0;text-align:right;font-weight:700">${fmtDateLong(opts.apptDate)} · ${opts.apptTime}</td></tr>
      <tr><td style="padding:6px 0;color:#756f60">Where</td><td style="padding:6px 0;text-align:right;font-weight:700">${where}</td></tr>
    </table>
    <p>See you soon!</p>`);
  return sendEmail(opts.to, "Reminder: your appointment is tomorrow", html);
}
