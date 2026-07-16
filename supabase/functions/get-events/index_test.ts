// get-events/index_test.ts — Integration tests against local Supabase
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handle } from "./index.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const testApiKey = Deno.env.get("TEST_GENERAL_KEY")!;

Deno.test("get-events/401 without API key", async () => {
  const supabase = createClient(supabaseUrl, serviceKey);
  const r = await handle(new Request("http://localhost/"), supabase);
  assertEquals(r.status, 401);
});

Deno.test("get-events/200 returns events array", async () => {
  const supabase = createClient(supabaseUrl, serviceKey);
  const r = await handle(
    new Request("http://localhost/", { headers: { "x-api-key": testApiKey } }),
    supabase,
  );
  assertEquals(r.status, 200);
  const body = await r.json();
  assertEquals(Array.isArray(body.events), true);
});
