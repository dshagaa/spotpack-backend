// create-event/index_test.ts — Integration tests
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handle } from "./index.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const testKey = Deno.env.get("TEST_GENERAL_KEY")!;

Deno.test("create-event/401 without key", async () => {
  const c = createClient(supabaseUrl, serviceKey);
  const r = await handle(
    new Request("http://localhost/", { method: "POST" }),
    c,
  );
  assertEquals(r.status, 401);
});

Deno.test("create-event/400 missing body", async () => {
  const c = createClient(supabaseUrl, serviceKey);
  const r = await handle(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "x-api-key": testKey },
    }),
    c,
  );
  assertEquals(r.status, 400);
});

Deno.test("create-event/201 creates and returns event", async () => {
  const c = createClient(supabaseUrl, serviceKey);
  const r = await handle(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "x-api-key": testKey, "content-type": "application/json" },
      body: JSON.stringify({
        name: "TestCon",
        start_date: "2026-01-01",
        end_date: "2026-01-02",
      }),
    }),
    c,
  );
  assertEquals(r.status, 200);
  const body = await r.json();
  assertExists(body.event);
  assertEquals(body.event.name, "TestCon");
  // Cleanup
  await c.from("events").delete().eq("id", body.event.id);
});
