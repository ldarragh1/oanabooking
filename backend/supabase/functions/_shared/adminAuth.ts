// Simple shared-secret check for the admin-only functions. This is a
// solo-practitioner tool, not a multi-user system, so one secret header
// (set as a Supabase secret and pasted into config.js) is proportionate —
// swap for real Supabase Auth if Oana ever needs staff logins.
export function isAdminAuthed(req: Request): boolean {
  const key = req.headers.get("x-admin-key");
  const expected = Deno.env.get("ADMIN_KEY");
  return !!expected && key === expected;
}
