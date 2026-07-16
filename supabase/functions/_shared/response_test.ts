// _shared/response_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { ok, error, notFound, forbidden, badRequest } from "./response.ts";

Deno.test("response/ok returns 200 with JSON body", async () => {
  const res = ok({ hello: "world" });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  const body = await res.json();
  assertEquals(body.hello, "world");
});

Deno.test("response/error returns custom status and message", async () => {
  const res = error("Something broke", 502, "upstream timeout");
  assertEquals(res.status, 502);
  const body = await res.json();
  assertEquals(body.error, "Something broke");
  assertEquals(body.detail, "upstream timeout");
});

Deno.test("response/notFound returns 404 with default message", async () => {
  const res = notFound();
  assertEquals(res.status, 404);
  const body = await res.json();
  assertStringIncludes(body.error, "not found");
});

Deno.test("response/notFound with custom resource name", async () => {
  const res = notFound("Event");
  assertEquals(res.status, 404);
  const body = await res.json();
  assertStringIncludes(body.error, "Event not found");
});

Deno.test("response/forbidden returns 403", async () => {
  const res = forbidden("Role 'general' cannot delete on events");
  assertEquals(res.status, 403);
  const body = await res.json();
  assertEquals(body.error, "Forbidden");
});

Deno.test("response/badRequest returns 400", async () => {
  const res = badRequest("Missing event_id");
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "Bad request");
  assertEquals(body.detail, "Missing event_id");
});

// Need this helper since we didn't import from asserts
function assertStringIncludes(actual: string, expected: string) {
  if (!actual.includes(expected)) {
    throw new Error(`Expected "${actual}" to include "${expected}"`);
  }
}
