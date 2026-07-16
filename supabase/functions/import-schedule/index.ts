// import-schedule/index.ts — Image → MiMo V2.5 → DB import pipeline

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { authorize } from "../_shared/auth.ts";
import { getClient } from "../_shared/supabase.ts";
import { badRequest, error, ok } from "../_shared/response.ts";
import { isValidUUID } from "../_shared/validation.ts";
import type { ParsedScheduleRow } from "../_shared/types.ts";

// ─── Config ────────────────────────────────────────────

const OPENCODE_API_KEY = Deno.env.get("OPENCODE_API_KEY")!;
const OPENCODE_BASE_URL = Deno.env.get("OPENCODE_BASE_URL") ||
  "https://opencode.ai/zen/v1";
const VISION_MODEL = Deno.env.get("VISION_MODEL") || "mimo-v2.5-free";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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

// ─── Handlers ──────────────────────────────────────────

serve(async (req: Request) => {
  // Init supabase client
  const supabase = getClient();

  // Auth
  const auth = await authorize(req, supabase, "import", "schedules");
  if (auth instanceof Response) return auth;

  // Parse multipart
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return badRequest("Invalid multipart form data");
  }

  const image = formData.get("image") as File | null;
  const eventId = formData.get("event_id") as string | null;

  if (!image || !eventId) {
    return badRequest("Missing image or event_id");
  }
  if (!isValidUUID(eventId)) {
    return badRequest("event_id must be a valid UUID");
  }
  if (!ALLOWED_TYPES.includes(image.type)) {
    return badRequest(
      `Invalid file type: ${image.type}. Allowed: PNG, JPEG, WebP`,
    );
  }
  if (image.size > MAX_FILE_SIZE) {
    return badRequest(
      `File too large (${(image.size / 1024 / 1024).toFixed(1)}MB). Max: 10MB`,
    );
  }

  // Verify event exists
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return error("Event not found", 404);

  // Upload image to Storage
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

  if (uploadError) {
    return error("Storage upload failed", 500, uploadError.message);
  }

  // Convert to base64 for vision API
  const base64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

  // Call MiMo V2.5
  let visionData: { choices?: Array<{ message?: { content?: string } }> };
  try {
    const visionRes = await fetch(`${OPENCODE_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENCODE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
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
        max_tokens: 8000,
      }),
    });

    if (!visionRes.ok) {
      const errBody = await visionRes.text();
      return error("Vision API error", 502, errBody.slice(0, 500));
    }
    visionData = await visionRes.json();
  } catch (e) {
    return error("Vision API request failed", 502, (e as Error).message);
  }

  const rawContent = visionData?.choices?.[0]?.message?.content || "";

  // Parse JSON from response (may be wrapped in markdown code blocks)
  let parsedItems: ParsedScheduleRow[];
  try {
    const jsonMatch = rawContent.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) ||
      rawContent.match(/(\[[\s\S]*?\])/);
    const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
    parsedItems = JSON.parse(jsonStr);
    if (!Array.isArray(parsedItems)) throw new Error("Not an array");
  } catch {
    // Store failed parse attempt
    await supabase.from("processing_results").insert({
      event_id: eventId,
      storage_path: storagePath,
      raw_json: { error: "parse_failed", raw_content: rawContent },
    });
    return error(
      "Failed to parse vision response as JSON array",
      422,
      rawContent.slice(0, 500),
    );
  }

  // Store raw result in processing_results
  await supabase.from("processing_results").insert({
    event_id: eventId,
    storage_path: storagePath,
    raw_json: parsedItems as unknown as Record<string, unknown>,
  });

  // Insert items into schedule_items
  let insertedCount = 0;
  const items: Array<Record<string, unknown>> = [];

  for (const row of parsedItems) {
    const { error: insertErr, data } = await supabase
      .from("schedule_items")
      .insert({
        event_id: eventId,
        day_date: row.day_date,
        start_time: row.start_time,
        end_time: row.end_time,
        title: row.title || "Untitled",
        description: row.description || "",
        room: row.room || "",
        category: row.category || "other",
        classification: row.classification || "general",
      })
      .select()
      .single();

    if (!insertErr && data) {
      insertedCount++;
      items.push(data);
    }
  }

  return ok({ success: true, count: insertedCount, items });
});
