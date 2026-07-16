// create-api-key/index.ts — Generate new API key (maintainer only)
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authorize } from "../_shared/auth.ts";
import { getClient } from "../_shared/supabase.ts";
import { badRequest, error, ok } from "../_shared/response.ts";
import { validateCreateApiKey } from "../_shared/validation.ts";
import { generateKey, sha256 } from "../_shared/crypto.ts";
import type { CreateApiKeyInput } from "../_shared/types.ts";

export async function handle(
  req: Request,
  supabase: SupabaseClient,
): Promise<Response> {
  const auth = await authorize(req, supabase, "manage", "keys");
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const validationError = validateCreateApiKey(body as CreateApiKeyInput);
  if (validationError) return badRequest(validationError);

  const { role, label } = body as Record<string, unknown>;
  const rawKey = generateKey();
  const hash = await sha256(rawKey);

  const { error: dbError } = await supabase
    .from("api_keys")
    .insert({ key_hash: hash, role, label });

  if (dbError) return error(dbError.message, 500);

  // Return raw key ONCE — it won't be retrievable later
  return ok({ key: rawKey, key_hash: hash, role, label });
}

if (import.meta.main) serve((req) => handle(req, getClient()));
