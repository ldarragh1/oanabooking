/* ────────────────────────────────────────────────────────────────────────
   Backend configuration. Leave BACKEND_URL empty to run in local demo
   mode — everything works exactly as before (localStorage, simulated
   Stripe, simulated emails). Fill these in once the Supabase backend in
   /backend is deployed (see backend/SETUP.md) to switch both pages over
   to real bookings, real Stripe Checkout, and real emails.

   This is a TEMPLATE. Copy it to config.js and fill in the real values —
   config.js itself is gitignored so the live keys never end up in git
   history. The real values are saved in the password manager note
   "Oana Clinic — config.js" (see /RECOVERY.md).
   ──────────────────────────────────────────────────────────────────────── */

// e.g. 'https://YOUR-PROJECT-REF.supabase.co/functions/v1'
const BACKEND_URL = '';

// Must match the ADMIN_KEY secret set on the backend (see SETUP.md).
// Only used by admin-dashboard.html.
const ADMIN_KEY = '';

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
