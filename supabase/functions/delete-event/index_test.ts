// delete-event/index_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handle } from "./index.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const gk = Deno.env.get("TEST_GENERAL_KEY")!;
const mk = Deno.env.get("TEST_MAINTAINER_KEY")!;

Deno.test("delete-event/401 without key", async () => {
  const c = createClient(url, key);
  const r = await handle(
    new Request("http://localhost/?id=abc", { method: "DELETE" }),
    c,
  );
  assertEquals(r.status, 401);
});

Deno.test("delete-event/403 general cannot delete", async () => {
  const c = createClient(url, key);
  const r = await handle(
    new Request("http://localhost/?id=00000000-0000-0000-0000-000000000000", {
      method: "DELETE",
      headers: { "x-api-key": gk },
    }),
    c,
  );
  assertEquals(r.status, 403);
});

Deno.test("delete-event/200 maintainer deletes", async () => {
  const c = createClient(url, key);
  const { data: ev } = await c.from("events").insert({
    name: "DelMe",
    start_date: "2026-01-01",
    end_date: "2026-01-02",
  }).select().single();

  const r = await handle(
    new Request(`http://localhost/?id=${ev!.id}`, {
      method: "DELETE",
      headers: { "x-api-key": mk },
    }),
    c,
  );
  assertEquals(r.status, 200);
});
