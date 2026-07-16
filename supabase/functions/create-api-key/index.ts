// create-api-key/index.ts — Generate and store new API key (maintainer only)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authorize } from "../_shared/auth.ts";
import { getClient } from "../_shared/supabase.ts";
import { badRequest, error, ok } from "../_shared/response.ts";
import { generateKey, sha256 } from "../_shared/crypto.ts";
import { validateCreateApiKey } from "../_shared/validation.ts";
serve(async (req: Request) => {
  const auth = await authorize(req, supabase, "manage", "keys");
  if (auth instanceof Response) return auth;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const validationError = validateCreateApiKey(body);
  if (validationError) return badRequest(validationError);
  const { role, label } = body as { role: string; label: string };
  // Generate raw key and hash it
  const rawKey = generateKey();
  const hash = await sha256(rawKey);
  const supabase = getClient();
  const { error: dbError } = await supabase
    .from("api_keys")
    .insert({
      key_hash: hash,
      role,
      label: label.trim(),
    });
  if (dbError) {
    // Unique constraint violation
    if (dbError.code === "23505") {
      return error("Key hash collision — retry", 500);
    }
    return error(dbError.message, 500);
  }
  // Return raw key ONCE — it will never be retrievable again
  return ok({
    success: true,
    key: rawKey,
    key_hash: hash,
    role,
    label: label.trim(),
  });
});
