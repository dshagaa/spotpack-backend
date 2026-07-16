# Milestones — SpotPack Backend

> Each change group gets an entry. Keep this file updated in every feature branch.

---

## [2026-07-16] Project Bootstrap & Documentation

**Branch:** `feat/project-setup`
**Type:** docs

### Changes
- Created repo `dshagaa/spotpack-backend`
- Defined full tech stack: Supabase Edge Functions (Deno/TS) + PostgreSQL + Storage
- Auth system: API keys in `api_keys` table (SHA-256 hashed), two roles (general, maintainer)
- AI: MiMo V2.5 Free via OpenCode Zen
- Database schema: `api_keys`, `events`, `schedule_items`, `processing_results`
- 7 Edge Functions planned: import-schedule, get-events, get-event, create-event, update-event, delete-event, create-api-key
- 29 development rules in AGENTS.md covering Supabase, coding, testing, shared lib, git workflow, and docs
- Installed AI skills: supabase, supabase-postgres-best-practices, safe-sql-execution
- All endpoints require `x-api-key` header — zero public access

### Breaking changes
- None (greenfield project)

### Migration needed
- Run `20260716000001_initial_schema.sql`
- Set `SEED_MAINTAINER_KEY` in supabase secrets
- Create `schedule-images` storage bucket (private, 7-day TTL)
