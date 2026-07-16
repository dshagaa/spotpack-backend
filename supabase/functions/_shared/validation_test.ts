// _shared/validation_test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import {
  isValidDate,
  isValidTime,
  isValidUUID,
  normalizeCategory,
  normalizeClassification,
  validateCreateApiKey,
  validateCreateEvent,
  validateUpdateEvent,
} from "./validation.ts";
import type {
  CreateApiKeyInput,
  CreateEventInput,
  UpdateEventInput,
} from "./types.ts";

// ─── UUID ──────────────────────────────────────────────

Deno.test("validation/isValidUUID accepts valid UUID", () => {
  assertEquals(isValidUUID("550e8400-e29b-41d4-a716-446655440000"), true);
});

Deno.test("validation/isValidUUID rejects invalid strings", () => {
  assertEquals(isValidUUID("not-a-uuid"), false);
  assertEquals(isValidUUID(""), false);
});

// ─── Date ──────────────────────────────────────────────

Deno.test("validation/isValidDate accepts YYYY-MM-DD", () => {
  assertEquals(isValidDate("2026-08-15"), true);
});

Deno.test("validation/isValidDate rejects bad dates", () => {
  assertEquals(isValidDate("2026-13-01"), false);
  assertEquals(isValidDate("hello"), false);
});

// ─── Time ──────────────────────────────────────────────

Deno.test("validation/isValidTime accepts HH:MM 24h", () => {
  assertEquals(isValidTime("09:00"), true);
  assertEquals(isValidTime("23:59"), true);
  assertEquals(isValidTime("00:00"), true);
});

Deno.test("validation/isValidTime rejects bad times", () => {
  assertEquals(isValidTime("24:00"), false);
  assertEquals(isValidTime("9:00"), false);
  assertEquals(isValidTime("abc"), false);
});

// ─── Create Event ──────────────────────────────────────

Deno.test("validation/validateCreateEvent accepts valid input", () => {
  assertEquals(
    validateCreateEvent({
      name: "FurCon",
      start_date: "2026-08-15",
      end_date: "2026-08-17",
    }),
    null,
  );
});

Deno.test("validation/validateCreateEvent rejects missing fields", () => {
  const err = validateCreateEvent(
    { name: "Test" } as unknown as CreateEventInput,
  );
  assertEquals(typeof err, "string");
});

// ─── Update Event ──────────────────────────────────────

Deno.test("validation/validateUpdateEvent accepts partial update", () => {
  assertEquals(
    validateUpdateEvent({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "New Name",
    }),
    null,
  );
});

Deno.test("validation/validateUpdateEvent rejects missing id", () => {
  const err = validateUpdateEvent(
    { name: "Test" } as unknown as UpdateEventInput,
  );
  assertEquals(typeof err, "string");
});

// ─── Create API Key ────────────────────────────────────

Deno.test("validation/validateCreateApiKey accepts valid input", () => {
  assertEquals(
    validateCreateApiKey({
      role: "general",
      label: "Frontend App",
    }),
    null,
  );
});

Deno.test("validation/validateCreateApiKey rejects invalid role", () => {
  const err = validateCreateApiKey(
    { role: "admin", label: "Test" } as unknown as CreateApiKeyInput,
  );
  assertEquals(typeof err, "string");
});

// ─── Normalize category ────────────────────────────────

Deno.test("validation/normalizeCategory maps known values", () => {
  assertEquals(normalizeCategory("panel"), "panel");
  assertEquals(normalizeCategory("Dance"), "dance");
  assertEquals(normalizeCategory("fursuit games"), "fursuit_games");
  assertEquals(normalizeCategory("unknown-stuff"), "other");
});

// ─── Normalize classification ──────────────────────────

Deno.test("validation/normalizeClassification maps variants", () => {
  assertEquals(normalizeClassification("general"), "general");
  assertEquals(normalizeClassification("+18"), "+18");
  assertEquals(normalizeClassification("18+"), "+18");
  assertEquals(normalizeClassification("21"), "+21");
  assertEquals(normalizeClassification("unknown"), "general");
});
