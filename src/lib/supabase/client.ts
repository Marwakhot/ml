import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Browser-safe Supabase client using the anon key, for read-only dashboard
 * queries directly from the client. Writes always go through API routes.
 */
export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables"
    );
  }

  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false },
  });
}
