// _shared/crypto_test.ts
import {
  assertEquals,
  assertNotEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { generateKey, sha256 } from "./crypto.ts";

Deno.test("crypto/sha256 produces consistent output", async () => {
  const a = await sha256("hello");
  const b = await sha256("hello");
  assertEquals(a, b);
  assertEquals(a.length, 64); // SHA-256 hex = 64 chars
});

Deno.test("crypto/sha256 produces different output for different input", async () => {
  const a = await sha256("hello");
  const b = await sha256("world");
  assertNotEquals(a, b);
});

Deno.test("crypto/sha256 handles empty string", async () => {
  const h = await sha256("");
  assertEquals(h.length, 64);
});

Deno.test("crypto/generateKey has sk-sp- prefix", () => {
  const key = generateKey();
  assertStringIncludes(key, "sk-sp-");
});

Deno.test("crypto/generateKey is 54 chars (6 prefix + 48 random)", () => {
  const key = generateKey();
  assertEquals(key.length, 54);
});

Deno.test("crypto/generateKey produces unique keys", () => {
  const keys = new Set(Array.from({ length: 20 }, () => generateKey()));
  assertEquals(keys.size, 20);
});
