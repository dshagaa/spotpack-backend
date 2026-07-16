// delete-event/index.ts — Delete event + cascade (maintainer only)
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authorize } from "../_shared/auth.ts";
import { getClient } from "../_shared/supabase.ts";
import { badRequest, error, ok } from "../_shared/response.ts";
import { isValidUUID } from "../_shared/validation.ts";

export async function handle(
  req: Request,
  supabase: SupabaseClient,
): Promise<Response> {
  const auth = await authorize(req, supabase, "delete", "events");
  if (auth instanceof Response) return auth;

  const id = new URL(req.url).searchParams.get("id");
  if (!id || !isValidUUID(id)) {
    return badRequest("Missing or invalid id parameter");
  }

  // Delete storage objects first
  const { data: files } = await supabase.storage.from("schedule-images").list(
    id,
  );
  if (files?.length) {
    await supabase.storage.from("schedule-images").remove(
      files.map((f) => `${id}/${f.name}`),
    );
  }

  const { error: dbError } = await supabase.from("events").delete().eq(
    "id",
    id,
  );
  if (dbError) return error(dbError.message, 500);

  return ok({ success: true });
}

if (import.meta.main) serve((req) => handle(req, getClient()));
