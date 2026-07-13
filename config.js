/* ────────────────────────────────────────────────────────────────────────
   Backend configuration. Leave BACKEND_URL empty to run in local demo
   mode — everything works exactly as before (localStorage, simulated
   Stripe, simulated emails). Fill this in once the Supabase backend in
   /backend is deployed (see backend/SETUP.md) to switch both pages over
   to real bookings, real Stripe Checkout, and real emails.

   No admin secret lives in this file — admin-dashboard.html gets its
   access key at login time from the admin-login endpoint, and holds it
   only in the browser's localStorage on Oana's own device. That's what
   makes it safe for this file (and admin-dashboard.html) to be hosted
   publicly alongside booking.html.
   ──────────────────────────────────────────────────────────────────────── */

// e.g. 'https://YOUR-PROJECT-REF.supabase.co/functions/v1'
const BACKEND_URL = 'https://cxcppaaddvriwcgtkbxk.supabase.co/functions/v1';

// Set at runtime after a successful admin login (see admin-dashboard.html).
let ADMIN_KEY = '';

function backendEnabled() { return !!BACKEND_URL; }

async function backendGet(fn, params, adminAuthed) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`${BACKEND_URL}/${fn}${qs}`, {
    headers: adminAuthed ? { 'x-admin-key': ADMIN_KEY } : {}
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${fn} failed`);
  return res.json();
}
async function backendPost(fn, body, adminAuthed) {
  const res = await fetch(`${BACKEND_URL}/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(adminAuthed ? { 'x-admin-key': ADMIN_KEY } : {}) },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${fn} failed`);
  return res.json();
}
