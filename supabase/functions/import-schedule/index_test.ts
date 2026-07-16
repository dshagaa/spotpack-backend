// import-schedule/index_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handle } from "./index.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const tk = Deno.env.get("TEST_GENERAL_KEY")!;

Deno.test("import-schedule/401 without key", async () => {
  const c = createClient(url, key);
  const r = await handle(
    new Request("http://localhost/", { method: "POST" }),
    c,
  );
  assertEquals(r.status, 401);
});

Deno.test("import-schedule/400 missing params", async () => {
  const c = createClient(url, key);
  const r = await handle(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "x-api-key": tk },
    }),
    c,
  );
  assertEquals(r.status, 400);
});

Deno.test("import-schedule/400 bad event_id", async () => {
  const c = createClient(url, key);
  const fd = new FormData();
  fd.append("event_id", "bad-uuid");
  fd.append("image", new File(["fake"], "test.png", { type: "image/png" }));
  const r = await handle(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "x-api-key": tk },
      body: fd,
    }),
    c,
  );
  assertEquals(r.status, 400);
});

Deno.test("import-schedule/404 event not found", async () => {
  const c = createClient(url, key);
  const fd = new FormData();
  fd.append("event_id", "00000000-0000-0000-0000-000000000000");
  fd.append("image", new File(["fake"], "test.png", { type: "image/png" }));
  const r = await handle(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "x-api-key": tk },
      body: fd,
    }),
    c,
  );
  assertEquals(r.status, 404);
});
