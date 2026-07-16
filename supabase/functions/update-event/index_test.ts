// update-event/index_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handle } from "./index.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const tk = Deno.env.get("TEST_GENERAL_KEY")!;

Deno.test("update-event/401 without key", async () => {
  const c = createClient(url, key);
  const r = await handle(
    new Request("http://localhost/", { method: "PATCH" }),
    c,
  );
  assertEquals(r.status, 401);
});

Deno.test("update-event/400 bad body", async () => {
  const c = createClient(url, key);
  const r = await handle(
    new Request("http://localhost/", {
      method: "PATCH",
      headers: { "x-api-key": tk },
    }),
    c,
  );
  assertEquals(r.status, 400);
});

Deno.test("update-event/200 updates name", async () => {
  const c = createClient(url, key);
  const { data: ev } = await c.from("events").insert({
    name: "Old",
    start_date: "2026-01-01",
    end_date: "2026-01-02",
  }).select().single();

  const r = await handle(
    new Request("http://localhost/", {
      method: "PATCH",
      headers: { "x-api-key": tk, "content-type": "application/json" },
      body: JSON.stringify({ id: ev!.id, name: "Updated" }),
    }),
    c,
  );
  assertEquals(r.status, 200);
  assertEquals((await r.json()).event.name, "Updated");
  await c.from("events").delete().eq("id", ev!.id);
});
