// _shared/auth.ts — Role-based authorization (async, queries api_keys table)

import type { Action, AuthResult, Module, Role } from "./types.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sha256 } from "./crypto.ts";

const PERMISSIONS: Record<Role, Record<Action, Module[]>> = {
  general: {
    read: ["events", "items"],
    create: ["events", "items"],
    update: ["events", "items"],
    import: ["schedules"],
    delete: [],
    manage: [],
  },
  maintainer: {
    read: ["events", "items", "processing"],
    create: ["events", "items"],
    update: ["events", "items"],
    import: ["schedules"],
    delete: ["events", "items"],
    manage: ["storage", "keys"],
  },
};

/**
 * Validates the x-api-key header by hashing it and querying the api_keys table.
 * Returns AuthResult on success, or a Response (401/403) to return immediately.
 *
 * Usage:
 *   const supabase = getClient();
 *   const auth = await authorize(req, supabase, "import", "schedules");
 *   if (auth instanceof Response) return auth;
 */
export async function authorize(
  req: Request,
  supabase: SupabaseClient,
  action: Action,
  module: Module,
): Promise<AuthResult | Response> {
  const key = req.headers.get("x-api-key") || "";

  // Hash the key
  const hash = await sha256(key);

  // Look up in database
  const { data, error: dbError } = await supabase
    .from("api_keys")
    .select("role, id")
    .eq("key_hash", hash)
    .eq("is_active", true)
    .maybeSingle();

  if (dbError || !data) {
    return new Response(
      JSON.stringify({ error: "Unauthorized — invalid or missing API key" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const role = data.role as Role;

  // Update last_used_at (fire-and-forget — don't block on this)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(({ error }) => {
      if (error) console.error("Failed to update last_used_at:", error.message);
    });

  // Check permissions
  if (!PERMISSIONS[role][action].includes(module)) {
    return new Response(
      JSON.stringify({
        error: "Forbidden",
        detail: `Role '${role}' cannot ${action} on ${module}`,
        required_role: PERMISSIONS.maintainer[action].includes(module)
          ? "maintainer"
          : undefined,
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  return { role };
}
