---
name: migration
description: Change the taisandaugia data model against the REAL Supabase backend (project bcusbpkfnydqcvxxjvew) — write a timestamped SQL migration in supabase/migrations/, add RLS "own rows" for user-owned tables, `npx supabase db push`, then regenerate the typed client. Use PROACTIVELY for "add a column/field", "new table", "change the schema", "write a migration", "add an index/policy/bucket".
---

# /migration — change the data model (real Supabase)

taisandaugia runs a **real Postgres with RLS and versioned migrations** — there is NO mock-data path. Every schema change is a SQL file, pushed, then reflected into the generated types. This is System-Architect-tier work (self-analysis → System Architect → QA). **Always run the migration yourself with the Supabase CLI — never ask the user to run it** (CLAUDE.md). Close with **`/log-decision`**.

## 1. Write the migration — `supabase/migrations/<timestamp>_<slug>.sql`
Name it monotonically: `YYYYMMDDNNNNNN_<slug>.sql` (e.g. `20260625000001_watchlist.sql`) — strictly newer than the last file in `supabase/migrations/`. Keep **schema** and **seed data** in separate files (seeds get their own later-timestamped `…_seed_*.sql`).

Make it **idempotent + safe to re-run**:
- `CREATE TABLE public.<name> ( … )` with `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at`/`updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- User-owned rows → `user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`.
- Reuse the shared trigger fn (already idempotent): `CREATE OR REPLACE FUNCTION public.set_updated_at()` then `CREATE TRIGGER <t>_updated_at BEFORE UPDATE … EXECUTE FUNCTION public.set_updated_at();`.
- Constrain status/enum-ish text with `CHECK (col IN (…))` — never a free string.
- Index every FK / hot filter: `CREATE INDEX idx_<t>_user_id ON public.<t> (user_id);`.
- Seeds: `INSERT … ON CONFLICT DO NOTHING` (or `upsert … ignoreDuplicates`).

## 2. RLS — REQUIRED for any user-owned table
The project convention is a single **"own rows"** policy (CLAUDE.md, `20260621000001_asset_postings.sql`):
```sql
ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "<t>_own_rows" ON public.<t> FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```
Admin visibility → add a **separate** SELECT policy: `USING (public.has_role(auth.uid(), 'ADMIN'::app_role))`. Never expose credit/unlock data cross-user. Storage buckets follow the `(storage.foldername(name))[1] = auth.uid()::text` owner-folder pattern (see the asset-media/asset-docs policies in `20260621000001`).

## 3. Push + regenerate types (run these)
```bash
npx supabase db push                    # or --include-all if out-of-order
npx supabase migration list             # confirm it applied remotely
npx supabase gen types typescript --project-id bcusbpkfnydqcvxxjvew > src/integrations/supabase/types.ts
```
`types.ts` is **generated — never hand-edit** (regen instead). If no Supabase creds are available in the session, say so and stop before `db push` — do not fake it.

## 4. Fix every reader
Renaming/removing a column? `grep -rn "<column>" src/` and update the typed selects in the affected `src/hooks/*` and `src/lib/credits.ts` — a stale `.select("old_col")` is a silent runtime break.

## 5. Verify + log
Phase 4: `npm run lint && npm run build` green. Then **`/log-decision`** — terse entry + update `architecture.md` (or `business-rules.md` if a lifecycle/status rule changed).
