// create-event/index.ts — Create a new event (auth required)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authorize } from "../_shared/auth.ts";
import { getClient } from "../_shared/supabase.ts";
import { ok, error, badRequest } from "../_shared/response.ts";
import { validateCreateEvent } from "../_shared/validation.ts";

serve(async (req: Request) => {
  const auth = await authorize(req, "create", "events");
  if (auth instanceof Response) return auth;

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }

  const validationError = validateCreateEvent(body);
  if (validationError) return badRequest(validationError);

  const { name, start_date, end_date, location } = body as Record<string, string>;

  const supabase = getClient();
  const { data: event, error: dbError } = await supabase
    .from("events")
    .insert({ name: name.trim(), start_date, end_date, location: (location || "").trim() })
    .select()
    .single();

  if (dbError) return error(dbError.message, 500);

  return ok({ event });
});
