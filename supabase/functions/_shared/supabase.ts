// _shared/supabase.ts — Supabase client factory (always service_role)

import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

let _client: SupabaseClient | null = null;

/** Returns a cached Supabase client with service_role key */
export function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
  }
  return _client;
}
