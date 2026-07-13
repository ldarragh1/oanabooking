import { createClient } from "npm:@supabase/supabase-js@2";

// Service-role client — full access, server-side only. Never send this
// key to the browser. Set via `supabase secrets set` (see SETUP.md).
export function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}
