// get-events/index.ts — List all events (auth required)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authorize } from "../_shared/auth.ts";
import { getClient } from "../_shared/supabase.ts";
import { error, ok } from "../_shared/response.ts";

serve(async (req: Request) => {
  const auth = await authorize(req, "read", "events");
  if (auth instanceof Response) return auth;

  const supabase = getClient();
  const { data: events, error: dbError } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });

  if (dbError) return error(dbError.message, 500);

  // Attach item counts
  const withCounts = await Promise.all(
    (events || []).map(async (event) => {
      const { count } = await supabase
        .from("schedule_items")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event.id);
      return { ...event, item_count: count || 0 };
    }),
  );

  return ok({ events: withCounts });
});
