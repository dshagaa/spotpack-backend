// import-schedule/index.ts — Image upload → MiMo V2.5 → schedule items
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authorize } from "../_shared/auth.ts";
import { getClient } from "../_shared/supabase.ts";
import { badRequest, error, ok } from "../_shared/response.ts";
import {
  isValidUUID,
  normalizeCategory,
  normalizeClassification,
} from "../_shared/validation.ts";

const VISION_MODEL = "mimo-v2.5-free";
const OPENCODE_URL = "https://opencode.ai/zen/v1/chat/completions";
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const SYSTEM_PROMPT =
  `You are a schedule extraction assistant. Analyze the convention schedule image and return a JSON array of events.

For each row in the schedule, extract these fields:
- day_date: "YYYY-MM-DD" format
- start_time: "HH:MM" in 24h format
- end_time: "HH:MM" in 24h format
- title: event title
- description: any additional text about the event
- room: room/location name
- category: one of [panel, meetup, workshop, fursuit_games, dance, ceremony, other]
- classification: one of [general, +16, +18, +21]

Rules:
- Detect merged cells — if a cell spans multiple rows, it's a multi-hour event
- If times are in 12h format (AM/PM), convert to 24h
- If no classification is indicated, default to "general"
- If no category is clear, default to "other"
- Return ONLY valid JSON array, no other text
- Support both Spanish and English text in the image

Return format:
[
  {"day_date": "...", "start_time": "...", "end_time": "...", "title": "...", "description": "...", "room": "...", "category": "...", "classification": "..."}
]`;

export async function handle(
  req: Request,
  supabase: SupabaseClient,
): Promise<Response> {
  if (req.method === "OPTIONS") return corsPreflight();

  try {
    const auth = await authorize(req, supabase, "import", "schedules");
    if (auth instanceof Response) return auth;

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return badRequest("Invalid multipart form data");
    }

    const image = formData.get("image") as File | null;
    const eventId = formData.get("event_id") as string | null;
    if (!image || !eventId) return badRequest("Missing image or event_id");
    if (!isValidUUID(eventId)) {
      return badRequest("event_id must be a valid UUID");
    }
    if (!ALLOWED_TYPES.includes(image.type)) {
      return badRequest(`Invalid file type: ${image.type}`);
    }
    if (image.size > MAX_FILE_SIZE) {
      return badRequest("File too large (max 10MB)");
    }

    // Verify event exists
    const { data: event } = await supabase.from("events").select("id").eq(
      "id",
      eventId,
    ).maybeSingle();
    if (!event) return error("Event not found", 404);

    // Upload to storage
    const ext = image.name.split(".").pop() || "png";
    const storagePath = `${eventId}/${Date.now()}_${
      crypto.randomUUID().slice(0, 8)
    }.${ext}`;
    const imageBuffer = await image.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("schedule-images")
      .upload(storagePath, imageBuffer, {
        contentType: image.type,
        upsert: false,
      });
    if (uploadError) return error("Storage upload failed", 500);

    // Call MiMo V2.5
    const apiKey = Deno.env.get("OPENCODE_API_KEY") || "";
    const base64 = btoa(
      Array.from(new Uint8Array(imageBuffer), (b) => String.fromCharCode(b))
        .join(""),
    );
    const visionRes = await fetch(OPENCODE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("VISION_MODEL") || VISION_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [{
              type: "image_url",
              image_url: { url: `data:${image.type};base64,${base64}` },
            }],
          },
        ],
        temperature: 0.1,
        max_tokens: 16000,
      }),
    });

    if (!visionRes.ok) {
      const errText = await visionRes.text();
      return error(
        `Vision API error: ${visionRes.status}`,
        502,
        errText.slice(0, 200),
      );
    }

    const visionData = await visionRes.json();
    const rawContent = visionData.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let parsedItems: Record<string, unknown>[];
    try {
      const jsonMatch =
        rawContent.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/) ||
        rawContent.match(/(\[[\s\S]*\])/);
      const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
      parsedItems = JSON.parse(jsonStr);
      if (!Array.isArray(parsedItems)) throw new Error("Not an array");
    } catch {
      await supabase.from("processing_results").insert({
        event_id: eventId,
        storage_path: storagePath,
        raw_json: { error: "parse_failed", raw_content: rawContent },
      });
      return error(
        "Failed to parse vision response",
        422,
        rawContent.slice(0, 500),
      );
    }

    // Store raw result
    await supabase.from("processing_results").insert({
      event_id: eventId,
      storage_path: storagePath,
      raw_json: parsedItems,
    });

    // Insert schedule items
    let count = 0;
    const items: Record<string, unknown>[] = [];
    for (const item of parsedItems) {
      const { error: insertErr, data } = await supabase.from("schedule_items")
        .insert({
          event_id: eventId,
          day_date: item.day_date,
          start_time: item.start_time,
          end_time: item.end_time,
          title: item.title,
          description: (item.description as string) || "",
          room: (item.room as string) || "",
          category: normalizeCategory(item.category as string || ""),
          classification: normalizeClassification(
            item.classification as string || "",
          ),
        }).select().single();
      if (!insertErr && data) {
        count++;
        items.push(data);
      }
    }

    return ok({ success: true, count, items });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return error(`Internal error: ${msg}`, 500);
  }
}

if (import.meta.main) serve((req) => handle(req, getClient()));
