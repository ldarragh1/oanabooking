// Keep this in sync with SERVICES in /data.js at the project root — the
// frontend and backend both need the name/duration/price for each service.
export const SERVICES: Record<number, { name: string; dur: number; price: number }> = {
  1: { name: "Initial Consultation", dur: 60, price: 160 },
  2: { name: "Follow-Up Consultation", dur: 45, price: 120 },
};

// Required upfront (via Stripe) to secure a pay-in-person booking; the
// remainder is paid at the session. Forfeited on cancellations made less
// than 24 hours before the appointment. Keep in sync with DEPOSIT_AMOUNT
// in /data.js.
export const DEPOSIT_AMOUNT = 20;

export function svc(id: number) {
  const s = SERVICES[id];
  if (!s) throw new Error(`Unknown serviceId ${id}`);
  return s;
}
