// get-event/index.ts — Get single event with items (auth required)
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authorize } from "../_shared/auth.ts";
import { getClient } from "../_shared/supabase.ts";
import { badRequest, notFound, ok } from "../_shared/response.ts";
import { isValidUUID } from "../_shared/validation.ts";

export async function handle(
  req: Request,
  supabase: SupabaseClient,
): Promise<Response> {
  const auth = await authorize(req, supabase, "read", "items");
  if (auth instanceof Response) return auth;

  const id = new URL(req.url).searchParams.get("id");
  if (!id || !isValidUUID(id)) {
    return badRequest("Missing or invalid id parameter");
  }

  const { data: event } = await supabase.from("events").select("*").eq("id", id)
    .maybeSingle();
  if (!event) return notFound("Event");

  const { data: items } = await supabase
    .from("schedule_items")
    .select("*")
    .eq("event_id", id)
    .order("day_date")
    .order("start_time");

  return ok({ event, items: items || [] });
}

if (import.meta.main) serve((req) => handle(req, getClient()));
