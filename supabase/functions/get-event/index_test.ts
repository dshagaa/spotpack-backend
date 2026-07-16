// get-event/index_test.ts — Integration tests
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handle } from "./index.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const testKey = Deno.env.get("TEST_GENERAL_KEY")!;

Deno.test("get-event/401 without key", async () => {
  const c = createClient(supabaseUrl, serviceKey);
  const r = await handle(new Request("http://localhost/?id=abc"), c);
  assertEquals(r.status, 401);
});

Deno.test("get-event/400 bad id", async () => {
  const c = createClient(supabaseUrl, serviceKey);
  const r = await handle(
    new Request("http://localhost/?id=bad", {
      headers: { "x-api-key": testKey },
    }),
    c,
  );
  assertEquals(r.status, 400);
});

Deno.test("get-event/404 not found", async () => {
  const c = createClient(supabaseUrl, serviceKey);
  const r = await handle(
    new Request(
      "http://localhost/?id=00000000-0000-0000-0000-000000000000",
      { headers: { "x-api-key": testKey } },
    ),
    c,
  );
  assertEquals(r.status, 404);
});
