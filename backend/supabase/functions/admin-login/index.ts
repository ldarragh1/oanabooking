// Public endpoint: the admin dashboard's login screen posts the typed
// password here. If it matches the ADMIN_PASSWORD secret, we hand back
// the real ADMIN_KEY (used to authorize admin-data/admin-mutate calls)
// for the browser to hold for this session — this key never sits inside
// the static admin-dashboard.html file itself, which is what makes it
// safe to host that file publicly alongside booking.html.
import { handlePreflight, json } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { password } = await req.json().catch(() => ({}));
  const expected = Deno.env.get("ADMIN_PASSWORD");
  const adminKey = Deno.env.get("ADMIN_KEY");

  if (!expected || !adminKey) return json({ error: "Server not configured" }, 500);
  if (password !== expected) return json({ error: "Incorrect password." }, 401);

  return json({ ok: true, adminKey });
});
