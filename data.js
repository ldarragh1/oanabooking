/* ────────────────────────────────────────────────────────────────────────
   Shared data + storage — Homeopathic Clinic Dublin booking system.

   Both admin-dashboard.html and booking.html include this file. Bookings
   made on the public page are written to localStorage so they appear
   instantly on the admin dashboard in the same browser — handy for demos.

   This is a front-end-only prototype: there is no real database, no real
   Stripe charge, and no real email sent. Before going live you'd swap
   loadStore()/saveStore() for calls to a real backend + database, add a
   Stripe Checkout/Payment Intent flow on a server, and wire up an email
   service (e.g. Resend/Postmark) to actually send confirmations.
   ──────────────────────────────────────────────────────────────────────── */

const STORE_KEY = 'oana_clinic_store_v1';

const SERVICES = [
  { id: 1, name: 'Initial Consultation', dur: 60, price: 160, desc: 'A full health history review — for new clients.', color: '#0d9488', bg: '#f0fdfa' },
  { id: 2, name: 'Follow-Up Consultation', dur: 45, price: 120, desc: 'For existing clients continuing treatment.', color: '#3b82f6', bg: '#eff6ff' }
];

// Required upfront (via Stripe) to secure a pay-in-person booking; the
// remainder is paid at the session. Forfeited on cancellations made less
// than 24 hours before the appointment. Keep in sync with DEPOSIT_AMOUNT
// in backend/supabase/functions/_shared/services.ts.
const DEPOSIT_AMOUNT = 20;

// Business hours by JS getDay() index (0=Sun..6=Sat), per session mode —
// hours can differ between online and in-person, and a day can be closed
// for one mode but not the other. `biweekly: true` means that day only
// runs every second week (see isBiweeklyActiveWeek below).
//   Mon: online 10-5, in-person 9-3 (last booking effectively ~2, since
//        Oana stays until 3 — encoded as a 9-3 window so a 60min session
//        starting at 2 still fits before the 3pm end cap)
//   Tue: online 10-5 only (no in-person)
//   Wed: online 9-6 only, every second week
//   Thu/Fri: closed
//   Sat: online 10-2 only, every second week
//   Sun: closed
const BUSINESS_HOURS = {
  1: { online: [10, 17], 'in-person': [9, 15] },
  2: { online: [10, 17] },
  3: { online: [9, 18], biweekly: true },
  6: { online: [10, 14], biweekly: true },
};

// Anchor for the biweekly Wed/Sat pattern: ISO weeks are "on" or "off" in
// alternation, anchored so the week containing today counts as "on" —
// adjust ISO_WEEK_PARITY_OFFSET (0 or 1) if Oana says the wrong weeks are showing.
const ISO_WEEK_PARITY_OFFSET = 0;
function isoWeekNumber(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((date - firstThursday) / (7 * 24 * 3600 * 1000));
}
function isBiweeklyActiveWeek(ds) {
  return (isoWeekNumber(ds) + ISO_WEEK_PARITY_OFFSET) % 2 === 1;
}

const AV_COLORS = ['#2f6f62', '#3b82f6', '#8b5cf6', '#c2843a', '#b45f5f', '#0d9488', '#ec4899', '#6366f1'];

// ── DATE / FORMAT HELPERS ───────────────────────────────────────────────
// NOTE: dates are formatted from local Y/M/D components, never toISOString()
// (which converts to UTC and silently shifts the date back a day for any
// timezone ahead of UTC — e.g. Ireland's IST/UTC+1 in summer).
function dateStr(dt) { return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); }
function todayStr() { return dateStr(new Date()); }
function addDays(d, n) { const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + n); return dateStr(dt); }
function weekOf(d) { const dt = new Date(d + 'T00:00:00'); const wd = dt.getDay(); dt.setDate(dt.getDate() - (wd === 0 ? 6 : wd - 1)); return dateStr(dt); }
function t2m(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function m2t(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function fmtDate(d) { return new Date(d + 'T00:00:00').toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' }); }
function fmtDateLong(d) { return new Date(d + 'T00:00:00').toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
function inits(name) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(); }
function avColor(name) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AV_COLORS.length; return AV_COLORS[h]; }
function svcById(id) { return SERVICES.find(s => s.id === id); }

// ── AVAILABILITY ────────────────────────────────────────────────────────
// mode is 'online' or 'in-person'. Returns [startHour, endHour] or null if
// closed for that mode on that date.
function businessHoursFor(dateStr, mode) {
  const wd = new Date(dateStr + 'T00:00:00').getDay();
  const day = BUSINESS_HOURS[wd];
  if (!day) return null;
  if (day.biweekly && !isBiweeklyActiveWeek(dateStr)) return null;
  return day[mode] || null;
}
// True if EITHER mode has any hours on this date — used only for the
// admin calendar's visual "closed" styling (Oana can still click to book
// any time regardless; this restriction is for the public booking flow).
function anyModeOpen(dateStr) {
  return !!businessHoursFor(dateStr, 'online') || !!businessHoursFor(dateStr, 'in-person');
}
// Returns an array of 'HH:MM' start times that fit a session of durMin
// minutes on dateStr for the given mode, without overlapping existing
// bookings or (if dateStr is today) the past / next 30 minutes.
function getAvailableSlots(store, dateStr, durMin, mode) {
  const bh = businessHoursFor(dateStr, mode);
  if (!bh) return [];
  const busy = store.appts
    .filter(a => a.date === dateStr && a.status !== 'cancelled')
    .map(a => ({ start: t2m(a.t), end: t2m(a.t) + (a.dur || 60) }));
  const dayStart = bh[0] * 60, dayEnd = bh[1] * 60;
  const isToday = dateStr === todayStr();
  const nowM = isToday ? (new Date().getHours() * 60 + new Date().getMinutes()) : -1;
  const slots = [];
  for (let m = dayStart; m + durMin <= dayEnd; m += 15) {
    const slotEnd = m + durMin;
    if (isToday && m <= nowM + 30) continue;
    if (busy.some(b => m < b.end && slotEnd > b.start)) continue;
    slots.push(m2t(m));
  }
  return slots;
}

// ── SEED DATA ────────────────────────────────────────────────────────────
function seedStore() {
  const T = todayStr();
  const clients = [
    { id: 1, name: 'Orla Cunningham', phone: '087 123 4567', email: 'orla.cunningham@gmail.com', dob: '1985-03-12', address: 'Rathmines, Dublin 6', since: addDays(T, -200), visits: 6, lastVisit: addDays(T, -14), color: avColor('Orla Cunningham'), notes: [
      { id: 1, date: addDays(T, -90), text: 'Initial consult. Presenting with chronic fatigue, low mood, poor sleep. Prescribed Arsenicum Album 30C — one dose nightly.' },
      { id: 2, date: addDays(T, -60), text: 'Follow-up: sleep improved, energy still low. Moved to Kali Phosphoricum 6C, twice daily.' },
      { id: 3, date: addDays(T, -30), text: 'Noticeable improvement in energy and mood. Continue current remedy, review in 4 weeks.' },
      { id: 4, date: addDays(T, -14), text: 'Doing well. Reduced dosage to once daily as maintenance.' }
    ]},
    { id: 2, name: "Cian O'Sullivan", phone: '086 234 5678', email: 'cian.os@gmail.com', dob: '1990-07-22', address: 'Terenure, Dublin 6W', since: addDays(T, -120), visits: 3, lastVisit: addDays(T, -21), color: avColor("Cian O'Sullivan"), notes: [
      { id: 1, date: addDays(T, -120), text: 'Initial consult — seasonal allergies, hay fever. Prescribed Allium Cepa 30C as needed during flare-ups.' },
      { id: 2, date: addDays(T, -21), text: 'Good response during allergy season. Continue as needed.' }
    ]},
    { id: 3, name: 'Siobhan Kelly', phone: '085 345 6789', email: 'siobhan.k@hotmail.com', dob: '1978-11-02', address: 'Ranelagh, Dublin 6', since: addDays(T, -300), visits: 9, lastVisit: addDays(T, -7), color: avColor('Siobhan Kelly'), notes: [
      { id: 1, date: addDays(T, -300), text: 'Recurring migraines, stress-related. Prescribed Natrum Muriaticum 30C weekly.' },
      { id: 2, date: addDays(T, -200), text: 'Frequency of migraines reduced from weekly to monthly.' },
      { id: 3, date: addDays(T, -60), text: 'Migraines mostly resolved. Discussed lifestyle/stress triggers.' },
      { id: 4, date: addDays(T, -7), text: 'Maintenance visit — doing very well, no migraines in 6 weeks.' }
    ]},
    { id: 4, name: 'Padraig Brennan', phone: '087 456 7890', email: 'p.brennan@gmail.com', dob: '1995-01-30', address: 'Rathgar, Dublin 6', since: addDays(T, -45), visits: 2, lastVisit: addDays(T, -10), color: avColor('Padraig Brennan'), notes: [
      { id: 1, date: addDays(T, -45), text: 'Initial consult — anxiety and digestive issues. Prescribed Argentum Nitricum 30C before stressful events.' }
    ]},
    { id: 5, name: 'Niamh Fitzgerald', phone: '086 567 8901', email: 'niamh.f@gmail.com', dob: '1982-05-18', address: 'Dundrum, Dublin 14', since: addDays(T, -500), visits: 14, lastVisit: addDays(T, -28), color: avColor('Niamh Fitzgerald'), notes: [
      { id: 1, date: addDays(T, -500), text: 'Long-term client — eczema management. Sulphur 30C protocol established.' },
      { id: 2, date: addDays(T, -28), text: 'Skin much clearer over summer. Continue seasonal check-ins.' }
    ]},
    { id: 6, name: 'Declan Walsh', phone: '085 678 9012', email: 'd.walsh@icloud.com', dob: '1988-09-09', address: "Harold's Cross, Dublin 6W", since: addDays(T, -15), visits: 1, lastVisit: addDays(T, -15), color: avColor('Declan Walsh'), notes: [
      { id: 1, date: addDays(T, -15), text: 'New client — joint pain, worse in damp weather. Prescribed Rhus Toxicodendron 30C.' }
    ]}
  ];

  const appts = [
    { id: 1, cId: 1, serviceId: 2, date: addDays(T, -14), t: '10:00', dur: 45, mode: 'online', payMethod: 'stripe', payStatus: 'paid', status: 'completed', source: 'online', notes: '' },
    { id: 2, cId: 3, serviceId: 2, date: addDays(T, -7), t: '11:00', dur: 45, mode: 'in-person', payMethod: 'in-person', payStatus: 'paid', status: 'completed', source: 'admin', notes: 'Paid cash at session.' },
    { id: 3, cId: 5, serviceId: 2, date: addDays(T, -28), t: '09:00', dur: 45, mode: 'in-person', payMethod: 'stripe', payStatus: 'paid', status: 'completed', source: 'online', notes: '' },
    { id: 4, cId: 2, serviceId: 2, date: T, t: '10:00', dur: 45, mode: 'online', payMethod: 'stripe', payStatus: 'paid', status: 'confirmed', source: 'online', notes: '' },
    { id: 5, cId: 4, serviceId: 2, date: T, t: '15:00', dur: 45, mode: 'in-person', payMethod: 'in-person', payStatus: 'unpaid', status: 'confirmed', source: 'online', notes: '' },
    { id: 6, cId: 6, serviceId: 1, date: addDays(T, 1), t: '09:00', dur: 60, mode: 'in-person', payMethod: 'stripe', payStatus: 'paid', status: 'confirmed', source: 'online', notes: '' },
    { id: 7, cId: 1, serviceId: 2, date: addDays(T, 2), t: '11:00', dur: 45, mode: 'online', payMethod: 'stripe', payStatus: 'paid', status: 'confirmed', source: 'online', notes: '' },
    { id: 8, cId: 3, serviceId: 2, date: addDays(T, 3), t: '14:15', dur: 45, mode: 'in-person', payMethod: 'in-person', payStatus: 'unpaid', status: 'confirmed', source: 'online', notes: '' },
    { id: 9, cId: 5, serviceId: 1, date: addDays(T, 4), t: '10:00', dur: 60, mode: 'in-person', payMethod: 'stripe', payStatus: 'paid', status: 'pending', source: 'online', notes: 'Awaiting Oana to confirm availability.' }
  ];

  return { clients, appts, nextClientId: 7, nextApptId: 10, nextNoteId: 100 };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.clients && parsed.appts) return parsed;
    }
  } catch (e) {}
  const seeded = seedStore();
  saveStore(seeded);
  return seeded;
}
function saveStore(store) { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
function resetStore() { const seeded = seedStore(); saveStore(seeded); return seeded; }
