// update-event/index.ts — Update event fields (general+)
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authorize } from "../_shared/auth.ts";
import { getClient } from "../_shared/supabase.ts";
import { badRequest, error, ok } from "../_shared/response.ts";
import { validateUpdateEvent } from "../_shared/validation.ts";
import type { UpdateEventInput } from "../_shared/types.ts";

export async function handle(
  req: Request,
  supabase: SupabaseClient,
): Promise<Response> {
  const auth = await authorize(req, supabase, "update", "events");
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const validationError = validateUpdateEvent(body as UpdateEventInput);
  if (validationError) return badRequest(validationError);

  const { id, ...fields } = body as Record<string, unknown>;
  const { data: event, error: dbError } = await supabase
    .from("events")
    .update(fields)
    .eq("id", id)
    .select()
    .single();

  if (dbError) return error(dbError.message, 500);
  return ok({ event });
}

if (import.meta.main) serve((req) => handle(req, getClient()));
