// delete-event/index.ts — Delete event + cascade (maintainer only)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authorize } from "../_shared/auth.ts";
import { getClient } from "../_shared/supabase.ts";
import { badRequest, error, notFound, ok } from "../_shared/response.ts";

serve(async (req: Request) => {
  const auth = await authorize(req, "delete", "events");
  if (auth instanceof Response) return auth;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return badRequest("Missing id parameter");

  const supabase = getClient();

  // Verify event exists
  const { data: event } = await supabase
    .from("events").select("id").eq("id", id).maybeSingle();
  if (!event) return notFound("Event");

  // Delete storage files
  const { data: files } = await supabase.storage
    .from("schedule-images")
    .list(id);

  if (files && files.length > 0) {
    await supabase.storage
      .from("schedule-images")
      .remove(files.map((f) => `${id}/${f.name}`));
  }

  // Delete event (ON DELETE CASCADE handles items + processing_results)
  const { error: dbError } = await supabase
    .from("events")
    .delete()
    .eq("id", id);

  if (dbError) return error(dbError.message, 500);

  return ok({ success: true });
});
