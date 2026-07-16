// _shared/auth_test.ts
import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { authorize } from "./auth.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Mock Supabase client — returns canned role or null (not found)
function mock(role: string | null): SupabaseClient {
  const data = role ? { role, id: "mock-id" } : null;
  const db = {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_f: string, _v: unknown) => ({
          eq: (_f2: string, _v2: unknown) => ({
            maybeSingle: () => Promise.resolve({ data, error: null }),
          }),
        }),
      }),
      update: (_data: Record<string, unknown>) => ({
        eq: (_f: string, _v: unknown) => ({
          then: (fn: (r: { error: Error | null }) => void) =>
            fn({ error: null }),
        }),
      }),
    }),
  };
  return db as unknown as SupabaseClient;
}

function req(key?: string): Request {
  const h = new Headers();
  if (key !== undefined) h.set("x-api-key", key);
  return new Request("http://localhost/test", { headers: h });
}

// ═══ 401: no key / empty key / unknown key ════════════

Deno.test("auth/no key header returns 401", async () => {
  const r = await authorize(req(), mock(null), "read", "events");
  assertEquals((r as Response).status, 401);
});

Deno.test("auth/empty key returns 401", async () => {
  const r = await authorize(req(""), mock(null), "read", "events");
  assertEquals((r as Response).status, 401);
});

Deno.test("auth/unknown key returns 401", async () => {
  const r = await authorize(req("bad-key"), mock(null), "read", "events");
  assertEquals((r as Response).status, 401);
});

// ═══ 200: general role permissions ════════════════════

Deno.test("auth/general reads events", async () => {
  const r = await authorize(req("k"), mock("general"), "read", "events");
  assertEquals((r as { role: string }).role, "general");
});

Deno.test("auth/general creates events", async () => {
  const r = await authorize(req("k"), mock("general"), "create", "events");
  assertEquals((r as { role: string }).role, "general");
});

Deno.test("auth/general imports schedules", async () => {
  const r = await authorize(req("k"), mock("general"), "import", "schedules");
  assertEquals((r as { role: string }).role, "general");
});

Deno.test("auth/general updates events", async () => {
  const r = await authorize(req("k"), mock("general"), "update", "events");
  assertEquals((r as { role: string }).role, "general");
});

// ═══ 403: general cannot do maintainer-only actions ═══

Deno.test("auth/general cannot delete (403)", async () => {
  const r = await authorize(req("k"), mock("general"), "delete", "events");
  assertEquals((r as Response).status, 403);
});

Deno.test("auth/general cannot manage keys (403)", async () => {
  const r = await authorize(req("k"), mock("general"), "manage", "keys");
  assertEquals((r as Response).status, 403);
});

Deno.test("auth/general cannot read processing (403)", async () => {
  const r = await authorize(req("k"), mock("general"), "read", "processing");
  assertEquals((r as Response).status, 403);
});

// ═══ 200: maintainer full access ══════════════════════

Deno.test("auth/maintainer reads events", async () => {
  const r = await authorize(req("k"), mock("maintainer"), "read", "events");
  assertEquals((r as { role: string }).role, "maintainer");
});

Deno.test("auth/maintainer deletes events", async () => {
  const r = await authorize(req("k"), mock("maintainer"), "delete", "events");
  assertEquals((r as { role: string }).role, "maintainer");
});

Deno.test("auth/maintainer manages keys", async () => {
  const r = await authorize(req("k"), mock("maintainer"), "manage", "keys");
  assertEquals((r as { role: string }).role, "maintainer");
});

Deno.test("auth/maintainer reads processing", async () => {
  const r = await authorize(req("k"), mock("maintainer"), "read", "processing");
  assertEquals((r as { role: string }).role, "maintainer");
});

// ═══ 403 response body ═══════════════════════════════

Deno.test("auth/403 body includes error detail", async () => {
  const r = await authorize(req("k"), mock("general"), "delete", "events");
  const body = await (r as Response).json();
  assertStringIncludes(body.error, "Forbidden");
  assertEquals(body.required_role, "maintainer");
});
