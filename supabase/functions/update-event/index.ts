// update-event/index.ts — Partial update event fields (auth required)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authorize } from "../_shared/auth.ts";
import { getClient } from "../_shared/supabase.ts";
import { badRequest, error, notFound, ok } from "../_shared/response.ts";
import { validateUpdateEvent } from "../_shared/validation.ts";
serve(async (req: Request) => {
  const auth = await authorize(req, supabase, "update", "events");
  if (auth instanceof Response) return auth;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const validationError = validateUpdateEvent(body);
  if (validationError) return badRequest(validationError);
  const { id, ...fields } = body as Record<string, string>;
  // Trim string fields
  const updates: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    updates[k] = typeof v === "string" ? v.trim() : v;
  }
  const supabase = getClient();
  // Verify event exists
  const { data: existing } = await supabase
    .from("events").select("id").eq("id", id).maybeSingle();
  if (!existing) return notFound("Event");
  const { data: event, error: dbError } = await supabase
    .from("events")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (dbError) return error(dbError.message, 500);
  return ok({ event });
});
