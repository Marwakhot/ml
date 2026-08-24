import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Server-only Supabase client using the service role key. Used from API
 * routes exclusively — never import this into client components. There's no
 * auth in this app (single-session/anonymous use), so RLS is left open and
 * this key is what lets server routes read/write freely; it must never reach
 * the browser bundle.
 */
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
