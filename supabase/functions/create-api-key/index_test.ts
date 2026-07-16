// create-api-key/index_test.ts
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handle } from "./index.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const tk = Deno.env.get("TEST_GENERAL_KEY")!;
const mk = Deno.env.get("TEST_MAINTAINER_KEY")!;

Deno.test("create-api-key/401 without key", async () => {
  const c = createClient(url, key);
  const r = await handle(
    new Request("http://localhost/", { method: "POST" }),
    c,
  );
  assertEquals(r.status, 401);
});

Deno.test("create-api-key/403 general cannot create keys", async () => {
  const c = createClient(url, key);
  const r = await handle(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "x-api-key": tk, "content-type": "application/json" },
      body: JSON.stringify({ role: "general", label: "Test" }),
    }),
    c,
  );
  assertEquals(r.status, 403);
});

Deno.test("create-api-key/200 maintainer creates key", async () => {
  const c = createClient(url, key);
  const r = await handle(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "x-api-key": mk, "content-type": "application/json" },
      body: JSON.stringify({ role: "general", label: "Test Key" }),
    }),
    c,
  );
  assertEquals(r.status, 200);
  const body = await r.json();
  assertExists(body.key);
  assertEquals(body.role, "general");
  // Cleanup
  await c.from("api_keys").delete().eq("key_hash", body.key_hash);
});
