// _shared/types.ts — Shared TypeScript interfaces for SpotPack Backend

/** API key row from the database */
export interface ApiKey {
  id: string;
  key_hash: string;
  role: "general" | "maintainer";
  label: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

/** Convention event */
export interface Event {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  created_at: string;
  item_count?: number;
}

/** A single schedule item (panel, workshop, etc.) */
export interface ScheduleItem {
  id: string;
  event_id: string;
  day_date: string;
  start_time: string; // "HH:MM" 24h
  end_time: string; // "HH:MM" 24h
  title: string;
  description: string;
  room: string;
  category: Category;
  classification: Classification;
  created_at: string;
}

/** Raw MiMo V2.5 processing result (audit trail) */
export interface ProcessingResult {
  id: string;
  event_id: string;
  storage_path: string;
  raw_json: Record<string, unknown>;
  created_at: string;
}

/** Standard API response wrapper */
export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  detail?: string;
  count?: number;
  [key: string]: unknown;
}

// ─── Enums ────────────────────────────────────────────

export const CATEGORIES = [
  "panel",
  "meetup",
  "workshop",
  "fursuit_games",
  "dance",
  "ceremony",
  "other",
] as const;
export type Category = typeof CATEGORIES[number];

export const CLASSIFICATIONS = ["general", "+16", "+18", "+21"] as const;
export type Classification = typeof CLASSIFICATIONS[number];

export type Role = "general" | "maintainer";
export type Action =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "import"
  | "manage";
export type Module =
  | "events"
  | "items"
  | "schedules"
  | "processing"
  | "storage"
  | "keys";

// ─── Request types ─────────────────────────────────────

export interface CreateEventInput {
  name: string;
  start_date: string;
  end_date: string;
  location?: string;
}

export interface UpdateEventInput {
  id: string;
  name?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
}

export interface CreateApiKeyInput {
  role: Role;
  label: string;
}

export interface ParsedScheduleRow {
  day_date: string;
  start_time: string;
  end_time: string;
  title: string;
  description: string;
  room: string;
  category: string;
  classification: string;
}

// ─── Auth result ───────────────────────────────────────

export interface AuthResult {
  role: Role;
}
