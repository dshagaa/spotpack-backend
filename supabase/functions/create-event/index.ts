// create-event/index.ts — Create a new event (general+)
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authorize } from "../_shared/auth.ts";
import { getClient } from "../_shared/supabase.ts";
import { badRequest, error, ok } from "../_shared/response.ts";
import { validateCreateEvent } from "../_shared/validation.ts";
import type { CreateEventInput } from "../_shared/types.ts";

export async function handle(
  req: Request,
  supabase: SupabaseClient,
): Promise<Response> {
  const auth = await authorize(req, supabase, "create", "events");
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const validationError = validateCreateEvent(body as CreateEventInput);
  if (validationError) return badRequest(validationError);

  const { name, start_date, end_date, location } = body as Record<
    string,
    unknown
  >;
  const { data: event, error: dbError } = await supabase
    .from("events")
    .insert({ name, start_date, end_date, location: location || "" })
    .select()
    .single();

  if (dbError) return error(dbError.message, 500);
  return ok({ event });
}

if (import.meta.main) serve((req) => handle(req, getClient()));
