# SpotPack Backend — AI Agent Context

> **Repo:** `dshagaa/spotpack-backend`  
> **Stack:** Supabase (Edge Functions + PostgreSQL + Storage)  
> **AI:** MiMo V2.5 Free via OpenCode Zen  
> **Built from scratch** — zero legacy code. No FastAPI, no Python.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│  Supabase Edge Functions (Deno + TypeScript) │
│                                              │
│  import-schedule ──→ MiMo V2.5 Vision API    │
│  create-event      ──→ PostgreSQL            │
│  update-event      ──→ PostgreSQL            │
│  get-events        ←── PostgreSQL (auth)     │
│  get-event         ←── PostgreSQL (auth)     │
│  delete-event      ──→ PostgreSQL + Storage  │
│  create-api-key    ──→ PostgreSQL            │
│                                              │
│  Storage: schedule-images (7-day TTL)        │
└──────────────────────────────────────────────┘
```

### Flow: Image → Schedule Items

```
1. POST /import-schedule  (multipart: image + event_id)
2. Validate x-api-key header
3. Upload image → Storage (7-day TTL)
4. Read image → base64
5. POST https://opencode.ai/zen/v1/chat/completions
   → model: mimo-v2.5-free
   → System prompt: schedule extraction rules
   → User: base64 image
6. Parse JSON response
7. INSERT raw JSON → processing_results
8. INSERT items → schedule_items
9. Return { success, count, items }
```

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Runtime | Supabase Edge Functions | Deno, TypeScript |
| Database | PostgreSQL (via Supabase) | 3 tables, RLS |
| Storage | Supabase Storage | 7-day TTL |
| AI | MiMo V2.5 Free | OpenCode Zen, OpenAI-compatible |
| Auth | API keys (2 roles) | `x-api-key` header |
| Local dev | Supabase CLI + Docker | `supabase start` |
| Deploy | `supabase functions deploy` | Per-function |

---

## Auth System

### API Keys stored in the database

API keys are NOT stored in environment variables. They live in the `api_keys` table (hashed with SHA-256). The only env secret is `SEED_MAINTAINER_KEY` — the bootstrap key used to create the first row.

```
x-api-key header → SHA-256 hash → query api_keys table → get role → check permissions
```

### API Keys table

```sql
api_keys (
  id           UUID PRIMARY KEY,
  key_hash     TEXT NOT NULL UNIQUE,    -- SHA-256 of the raw key
  role         TEXT NOT NULL,           -- 'general' | 'maintainer'
  label        TEXT NOT NULL,           -- human name: "Frontend App", "Admin"
  created_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,            -- updated on each auth
  is_active    BOOLEAN DEFAULT true    -- soft-delete / revoke
)
```

### Bootstrap flow

1. User sets `SEED_MAINTAINER_KEY` in Supabase secrets (a long random string)
2. User computes its SHA-256 hash and inserts into `api_keys` manually (or via a seed script)
3. That key becomes the initial maintainer key — can create more keys via `create-api-key` endpoint
4. Additional general keys are created via the maintainer-authenticated endpoint

### Roles

| Role | How created | Who uses it |
|------|------------|-------------|
| `general` | Via `create-api-key` endpoint (maintainer only) | Frontend app — read, create, update, import |
| `maintainer` | Seed key + via endpoint | Admin — delete events, manage keys, view processing |

### Permission Matrix

| Action | Module | general | maintainer |
|--------|--------|:---:|:---:|
| `read` | `events` | ✅ | ✅ |
| `read` | `items` | ✅ | ✅ |
| `create` | `events` | ✅ | ✅ |
| `create` | `items` | ✅ | ✅ |
| `update` | `events` | ✅ | ✅ |
| `update` | `items` | ✅ | ✅ |
| `import` | `schedules` | ✅ | ✅ |
| `delete` | `events` | ❌ | ✅ |
| `delete` | `items` | ❌ | ✅ |
| `read` | `processing` | ❌ | ✅ |
| `manage` | `storage` | ❌ | ✅ |
| `manage` | `keys` | ❌ | ✅ |

### How auth works in code

Every Edge Function imports `_shared/auth.ts`. The `authorize` function is **async** — it hashes the key and queries the DB:

```typescript
import { authorize } from "../_shared/auth.ts";
import { getClient } from "../_shared/supabase.ts";

serve(async (req: Request) => {
  const supabase = getClient("service");
  const auth = await authorize(req, supabase, "import", "schedules");
  if (auth instanceof Response) return auth;  // 401 or 403
  // auth.role = "general" | "maintainer"
});
```

**Key flow inside `authorize()`:**
1. Extract `x-api-key` from header
2. `SHA-256(key)` → hash
3. `SELECT role FROM api_keys WHERE key_hash = hash AND is_active = true`
4. No match → 401
5. Match → update `last_used_at`, check permission matrix
6. Permission denied → 403 with `required_role`
7. Permission granted → return `{ role }`

### Rules for auth

- **Never expose raw keys.** Only SHA-256 hashes in the database. Raw keys are transmitted once and hashed.
- **`SEED_MAINTAINER_KEY`** creates the first maintainer row — then it's disposable.
- **General keys are created via endpoint** (not manually inserted) — ensures consistent hashing and labeling.
- **Revoke = set `is_active = false`** — never delete a key row (preserves audit history).
- **`last_used_at` is updated on every auth** — enables key rotation and unused-key cleanup.

---

## Database Schema

### API Keys
```sql
api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash     TEXT NOT NULL UNIQUE,       -- SHA-256 of the raw key
  role         TEXT NOT NULL DEFAULT 'general',  -- general | maintainer
  label        TEXT NOT NULL,              -- human-friendly name
  created_at   TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,               -- updated on every auth
  is_active    BOOLEAN DEFAULT true        -- false = revoked
)
```
**RLS:** Only `service_role` can SELECT/INSERT/UPDATE. `anon` and `authenticated` have zero access.

### Events
```sql
events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  location    TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now()
)
```

### Schedule Items
```sql
schedule_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  day_date        DATE NOT NULL,
  start_time      TEXT NOT NULL,         -- "HH:MM" 24h
  end_time        TEXT NOT NULL,         -- "HH:MM" 24h
  title           TEXT NOT NULL,
  description     TEXT DEFAULT '',
  room            TEXT DEFAULT '',
  category        TEXT DEFAULT 'other',   -- panel, meetup, workshop, fursuit_games, dance, ceremony, other
  classification  TEXT DEFAULT 'general', -- general, +16, +18, +21
  created_at      TIMESTAMPTZ DEFAULT now()
)
```

**Enums (validated at application level, not DB constraints):**
- `category`: `panel`, `meetup`, `workshop`, `fursuit_games`, `dance`, `ceremony`, `other`
- `classification`: `general`, `+16`, `+18`, `+21`

### Processing Results (audit trail)
```sql
processing_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,            -- path in schedule-images bucket
  raw_json      JSONB NOT NULL,           -- raw MiMo response
  created_at    TIMESTAMPTZ DEFAULT now()
)
```

### RLS Policies

All tables have RLS enabled. Rules:
- **No public access.** `anon` role has zero access to all tables.
- **`service_role`:** Full access — all Edge Functions use this internally.
- **No `authenticated` access** — we don't use Supabase Auth.

### Storage Bucket
- **Name:** `schedule-images`
- **Public:** false (private)
- **TTL:** 7 days (auto-delete)
- **Access:** `service_role` only

---

## API Endpoints

Base URL: `https://{project_ref}.supabase.co/functions/v1`

| Function | Method | Auth | Params | Returns |
|----------|--------|------|--------|---------|
| `get-events` | GET | general+ | — | `{ events: [...] }` with item counts |
| `get-event` | GET | general+ | `?id={uuid}` | `{ event, items: [...] }` |
| `create-event` | POST | general+ | `{ name, start_date, end_date, location? }` | `{ event }` |
| `update-event` | PATCH | general+ | `{ id, ...fields }` | `{ event }` |
| `import-schedule` | POST | general+ | `multipart: image + event_id` | `{ success, count, items }` |
| `delete-event` | DELETE | maintainer | `?id={uuid}` | `{ success }` |
| `create-api-key` | POST | maintainer | `{ role, label }` | `{ key, key_hash, role, label }` |

### Error codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (missing params, invalid file) |
| 401 | Missing/invalid API key |
| 403 | Valid key but insufficient role |
| 404 | Event not found |
| 422 | MiMo returned unparseable JSON |
| 500 | Internal/server error |
| 502 | MiMo API error (upstream) |

---

## MiMo V2.5 Integration

### API Details
```
POST https://opencode.ai/zen/v1/chat/completions
Authorization: Bearer {OPENCODE_API_KEY}
Content-Type: application/json

{
  "model": "mimo-v2.5-free",
  "messages": [
    { "role": "system", "content": "[prompt]" },
    {
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": { "url": "data:image/png;base64,{base64}" }
        }
      ]
    }
  ],
  "temperature": 0.1,
  "max_tokens": 8000
}
```

### Vision prompt (schedule extraction)

```
You are a schedule extraction assistant. Analyze the convention schedule image and return a JSON array of events.

For each row in the schedule, extract these fields:
- day_date: "YYYY-MM-DD" format
- start_time: "HH:MM" in 24h format
- end_time: "HH:MM" in 24h format
- title: event title
- description: any additional text about the event
- room: room/location name
- category: one of [panel, meetup, workshop, fursuit_games, dance, ceremony, other]
- classification: one of [general, +16, +18, +21]

Rules:
- Detect merged cells — if a cell spans multiple rows, it's a multi-hour event
- If times are in 12h format (AM/PM), convert to 24h
- If no classification is indicated, default to "general"
- If no category is clear, default to "other"
- Return ONLY valid JSON array, no other text
- Support both Spanish and English text in the image

Return format:
[
  {"day_date": "...", "start_time": "...", "end_time": "...", "title": "...", "description": "...", "room": "...", "category": "...", "classification": "..."}
]
```

### Important: Response parsing

MiMo may wrap JSON in markdown code blocks. Edge Function must handle:
```typescript
// Try extracting from ```json ... ``` first, then bare [...]
const jsonMatch = rawContent.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/)
                || rawContent.match(/(\[[\s\S]*?\])/);
const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
```

---

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `SEED_MAINTAINER_KEY` | supabase secrets | First maintainer key (used once to bootstrap) |
| `OPENCODE_API_KEY` | supabase secrets | OpenCode Zen API |
| `OPENCODE_BASE_URL` | supabase secrets | `https://opencode.ai/zen/v1` |
| `VISION_MODEL` | supabase secrets | `mimo-v2.5-free` |
| `SUPABASE_URL` | auto | Provided by Supabase runtime |
| `SUPABASE_ANON_KEY` | auto | Public key (for read endpoints) |
| `SUPABASE_SERVICE_ROLE_KEY` | auto | Admin key (for write endpoints, DB access) |

The first 4 are set via `supabase secrets set`. The last 3 are automatically available.

**Note:** API keys for authentication are NOT in env vars — they're in the `api_keys` database table.

---

## Project Structure

```
backend/
├── .agents/skills/              # AI skills (from skills.sh)
│   ├── supabase/
│   ├── supabase-postgres-best-practices/
│   └── safe-sql-execution/
├── supabase/
│   ├── config.toml              # Supabase project config
│   ├── migrations/
│   │   └── 20260716000001_initial_schema.sql
│   └── functions/
│       ├── _shared/             # Shared library (common code)
│       │   ├── auth.ts          # Authorization (async, queries api_keys table)
│       │   ├── supabase.ts      # Supabase client factory (anon / service_role)
│       │   ├── response.ts      # JSON response helpers (ok, error, notFound, forbidden)
│       │   ├── types.ts         # Shared TypeScript types (Event, ScheduleItem, ApiKey, etc.)
│       │   ├── crypto.ts        # SHA-256 hashing + key generation
│       │   └── validation.ts    # Input validation helpers (validateEvent, validateUUID)
│       ├── import-schedule/
│       │   ├── index.ts
│       │   └── index_test.ts    # Unit tests (Deno.test)
│       ├── get-events/
│       │   ├── index.ts
│       │   └── index_test.ts
│       ├── get-event/
│       │   ├── index.ts
│       │   └── index_test.ts
│       ├── create-event/
│       │   ├── index.ts
│       │   └── index_test.ts
│       ├── update-event/
│       │   ├── index.ts
│       │   └── index_test.ts
│       ├── delete-event/
│       │   ├── index.ts
│       │   └── index_test.ts
│       └── create-api-key/
│           ├── index.ts
│           └── index_test.ts
├── .env.example
├── .gitignore
├── AGENTS.md
└── README.md
```

### Shared Library (`_shared/`)

All reusable code lives in `_shared/`. Edge Functions import from here — never duplicate logic.

| Module | Exports | Purpose |
|--------|---------|---------|
| `auth.ts` | `authorize(req, supabase, action, module) → Promise<AuthResult \| Response>` | Role-based auth (async, queries DB) |
| `supabase.ts` | `getClient() → SupabaseClient` | Client factory — always service_role (all endpoints require auth) |
| `response.ts` | `ok(data)`, `error(msg, status)`, `notFound()`, `forbidden(detail)` | JSON response helpers |
| `types.ts` | `Event`, `ScheduleItem`, `ProcessingResult`, `ApiKey`, `ApiResponse<T>` | Shared types |
| `crypto.ts` | `sha256(input: string) → string`, `generateKey() → string` | Hashing + key generation |

**Rules for `_shared/`:**
- No side-effects on import — only pure exports
- No `Deno.env.get()` in shared modules (that's the caller's job)
- All types in `types.ts` — never redefine interfaces per-function
- Test `_shared/` modules independently before using them in endpoints

---

## Development Rules

### Supabase rules (from official skills)

1. **Check changelog first.** Supabase changes frequently — verify against `https://supabase.com/changelog.md` before implementing. Do NOT rely on training data.

2. **Verify your work.** After any change, run a test to confirm it works. A fix without verification is incomplete.

3. **Recover from errors — don't loop.** If an approach fails after 2-3 attempts, stop and reconsider. Try a different method.

4. **RLS on every table.** Always enable RLS on tables in exposed schemas. Create explicit policies.

5. **Never expose service_role key.** Only `SUPABASE_ANON_KEY` goes to public clients. Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` internally.

6. **Use `TO` clause** (not `auth.role()`) in RLS policies. `auth.role() = 'authenticated'` breaks with anonymous sign-ins.

7. **UPDATE requires SELECT policy.** In Postgres RLS, UPDATE first SELECTs the row. Without a SELECT policy, updates silently fail.

8. **Views bypass RLS by default.** Use `security_invoker = true` in Postgres 15+.

### Coding rules

9. **TypeScript strict types.** Declare types for all variables, parameters, and return values. No `any` without explicit reason.

10. **Edge Functions are single-purpose.** One function = one endpoint = one concern.

11. **Environment variables never hardcoded.** All secrets via `Deno.env.get()`. All config in `supabase secrets`.

12. **Error messages in English.** API responses in English. Prompt can be bilingual (ES/EN).

13. **Commit after each working change.** Small, atomic commits.

### Testing rules

14. **Every endpoint has unit tests.** File `index_test.ts` alongside `index.ts` in every function directory. Use Deno's built-in test runner (`Deno.test`).

15. **Test the handler, not the network.** Unit tests import the handler function directly — no HTTP server, no `supabase functions serve`. Mock `fetch` for external API calls (MiMo).

16. **Test both success and error paths.** Each endpoint must have tests for:
    - Valid request → 200 + correct response shape
    - Invalid auth → 401
    - Insufficient role → 403
    - Missing params → 400
    - Not found → 404

17. **Shared modules tested independently.** `_shared/` modules are tested before any endpoint uses them. `auth_test.ts`, `response_test.ts`, etc.

18. **Run tests before deploy.** `deno test supabase/functions/` — all tests must pass before `supabase functions deploy`.

19. **Test naming convention:** `{module}/{function}_{scenario}` — e.g., `auth/authorize returns 401 for bad key`.

### Shared library rules

20. **Never duplicate code.** If two functions need the same logic, it goes in `_shared/`. This includes: auth, client creation, response formatting, type definitions, validation helpers.

21. **`_shared/` modules are pure exports.** No `serve()`, no `Deno.env.get()`, no side-effects on import. Callers pass in config/environment.

22. **Types live in `types.ts`.** Interfaces `Event`, `ScheduleItem`, `ProcessingResult`, `ApiResponse<T>` are defined once and imported everywhere.

### Git workflow

23. **Never push to main directly.** All work happens on feature branches. `main` is protected — merged via PR only.

24. **Conventional branch names.** Branches follow the pattern:
    - `feat/<description>` — new feature (e.g., `feat/import-schedule-endpoint`)
    - `fix/<description>` — bug fix (e.g., `fix/auth-401-on-expired-key`)
    - `docs/<description>` — documentation only
    - `refactor/<description>` — code restructuring, no behavior change
    - `test/<description>` — adding missing tests

25. **Conventional commits.** Every commit message follows [Conventional Commits](https://www.conventionalcommits.org/):
    ```
    <type>(<scope>): <description>
    ```
    Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`
    Scopes: `auth`, `db`, `import`, `events`, `keys`, `shared`, `docs`
    Examples: `feat(import): add MiMo vision integration`, `fix(auth): handle expired api keys`, `docs(db): document api_keys table schema`

26. **Small commits grouped by feature.** One commit = one logical change. Never mix two features in the same commit. If a commit touches 5 files across 3 features, split it.

27. **Commit before moving to next task.** After completing a task from the plan, commit immediately. Don't carry uncommitted changes into the next task.

### Documentation rules

28. **Keep AGENTS.md updated.** After any architectural change (new endpoint, schema change, auth update, new shared module), update AGENTS.md in the same branch. The docs must always reflect the current state of the code.

29. **MILESTONE.md for every change.** Each feature branch includes or updates `MILESTONE.md` — a changelog entry documenting what was done, why, and any breaking changes. Format:
    ```markdown
    ## [YYYY-MM-DD] <Feature Name>
    
    **Branch:** `feat/example`
    **Type:** feat | fix | refactor | docs
    
    ### Changes
    - What was added/changed/removed
    
    ### Breaking changes
    - List if any, or "None"
    
    ### Migration needed
    - SQL migrations, env vars, manual steps — or "None"
    ```

---

## Key Constraints

- **Edge Function timeout:** 60s (free tier). Image processing + MiMo API must fit within this.
- **Edge Function memory:** 256 MB. Keep base64 images reasonable (max 10 MB upload).
- **MiMo V2.5 Free:** Rate limits not publicly documented. Free tier — data may be used for training during free period.
- **Storage:** 7-day TTL auto-deletes images. Raw JSON preserved in `processing_results` indefinitely.
- **No built-in auth:** We use API keys, not Supabase Auth. No user management, no JWT, no sessions.
