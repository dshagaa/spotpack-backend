// _shared/validation.ts — Input validation helpers

import type {
  Category,
  Classification,
  CreateApiKeyInput,
  CreateEventInput,
  UpdateEventInput,
} from "./types.ts";
import { CATEGORIES, CLASSIFICATIONS } from "./types.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidUUID(value: string): boolean {
  return UUID_RE.test(value);
}

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !isNaN(d.getTime());
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** Validate create-event input. Returns error string or null. */
export function validateCreateEvent(input: CreateEventInput): string | null {
  if (!input || typeof input !== "object") {
    return "Request body must be a JSON object";
  }
  const { name, start_date, end_date } = input as unknown as Record<string, unknown>;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return "name is required and must be a non-empty string";
  }
  if (
    !start_date || typeof start_date !== "string" || !isValidDate(start_date)
  ) {
    return "start_date is required and must be YYYY-MM-DD";
  }
  if (!end_date || typeof end_date !== "string" || !isValidDate(end_date)) {
    return "end_date is required and must be YYYY-MM-DD";
  }
  return null;
}

/** Validate update-event input. Returns error string or null. */
export function validateUpdateEvent(input: UpdateEventInput): string | null {
  if (!input || typeof input !== "object") {
    return "Request body must be a JSON object";
  }
  const { id, name, start_date, end_date } = input as unknown as Record<string, unknown>;

  if (!id || typeof id !== "string" || !isValidUUID(id)) {
    return "id is required and must be a valid UUID";
  }
  if (
    start_date !== undefined &&
    (typeof start_date !== "string" || !isValidDate(start_date))
  ) {
    return "start_date must be YYYY-MM-DD";
  }
  if (
    end_date !== undefined &&
    (typeof end_date !== "string" || !isValidDate(end_date))
  ) {
    return "end_date must be YYYY-MM-DD";
  }
  if (
    name !== undefined && (typeof name !== "string" || name.trim().length === 0)
  ) {
    return "name must be a non-empty string";
  }
  return null;
}

/** Validate create-api-key input. Returns error string or null. */
export function validateCreateApiKey(input: CreateApiKeyInput): string | null {
  if (!input || typeof input !== "object") {
    return "Request body must be a JSON object";
  }
  const { role, label } = input as unknown as Record<string, unknown>;

  if (!role || (role !== "general" && role !== "maintainer")) {
    return 'role must be "general" or "maintainer"';
  }
  if (!label || typeof label !== "string" || label.trim().length === 0) {
    return "label is required and must be a non-empty string";
  }
  return null;
}

/** Normalize category string to valid value, defaulting to "other" */
export function normalizeCategory(value: string): Category {
  const lower = (value || "").toLowerCase().trim();
  if (CATEGORIES.includes(lower as Category)) return lower as Category;
  // Fuzzy match common variants
  const aliases: Record<string, Category> = {
    "fursuit games": "fursuit_games",
    "fursuit game": "fursuit_games",
    "game": "fursuit_games",
    "dancing": "dance",
    "ceremony": "ceremony",
    "opening": "ceremony",
    "closing": "ceremony",
    "meet": "meetup",
    "reunión": "meetup",
    "taller": "workshop",
    "panel": "panel",
  };
  return aliases[lower] || "other";
}

/** Normalize classification string to valid value, defaulting to "general" */
export function normalizeClassification(value: string): Classification {
  const cleaned = (value || "").replace(/\s/g, "").toLowerCase();
  if (cleaned === "+16" || cleaned === "16+" || cleaned === "16") return "+16";
  if (cleaned === "+18" || cleaned === "18+" || cleaned === "18") return "+18";
  if (cleaned === "+21" || cleaned === "21+" || cleaned === "21") return "+21";
  if (CLASSIFICATIONS.includes(cleaned as Classification)) {
    return cleaned as Classification;
  }
  return "general";
}
