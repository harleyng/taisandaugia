---
name: migration
description: Change the taisandaugia data model against the REAL Supabase backend (live project dvdpfjprncvkhfwcvqmp) — write a timestamped SQL migration in supabase/migrations/, add RLS "own rows" for user-owned tables, apply it (`npx supabase db push`, or directly via psql over the pooler when the CLI is unauthenticated), then regenerate the typed client. Use PROACTIVELY for "add a column/field", "new table", "change the schema", "write a migration", "add an index/policy/bucket".
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

**Admin back-office tables** (not user-owned — e.g. `marketing_campaigns`, `campaign_recipients`) are the exception: one **`<t>_admin_all` `FOR ALL`** policy `USING (public.has_role(auth.uid(),'ADMIN'::app_role)) WITH CHECK (…)` instead of own-rows. To let an admin segment across other users' RLS-protected tables (e.g. `user_credits`), use a **`SECURITY DEFINER` RPC guarded with `IF NOT public.has_role(auth.uid(),'ADMIN'::app_role) THEN RAISE EXCEPTION`** (see `resolve_campaign_audience` in `20260711000001`) — never widen the underlying tables' policies. `GRANT EXECUTE … TO authenticated`; the internal check is the boundary.

## 3. Apply the migration YOURSELF (never ask the user)

### 3a. Preferred — Supabase CLI (needs `SUPABASE_ACCESS_TOKEN` or `supabase login`)
```bash
npx supabase db push                    # or --include-all if out-of-order
npx supabase migration list             # confirm it applied remotely
```
If `supabase projects list` returns `Access token not provided`, the CLI is unauthenticated → use **3b** instead (do NOT stop and hand it back to the user).

### 3b. Fallback — apply directly via `psql` using `SUPABASE_DB_URI` from `.env.local`
`psql` is installed. `.env.local` holds a full-access `SUPABASE_DB_URI`. **These quirks cost real time — bake them in:**
- The URI host `db.<ref>.supabase.co` is **IPv6-only** and unreachable from the sandbox (`No route to host`) → **do not use it**.
- Route via the **IPv4 SESSION pooler**: `host=aws-1-ap-southeast-1.pooler.supabase.com port=5432 user=postgres.<ref>` (this project = `ap-southeast-1`, prefix `aws-1`). Different project? sweep regions & `aws-0`/`aws-1` until the error changes from `tenant/user … not found` (wrong region) to a password prompt (right host). Port **5432 = session mode** (supports DDL/transactions); 6543 = transaction mode, avoid for migrations.
- The password in the URI is **URL-encoded** → decode with `urllib.parse.unquote` before use.
- **Never echo the password** — parse it in-shell into `PGPASSWORD` (below), don't print the connstring.

```bash
REF=dvdpfjprncvkhfwcvqmp
DBURI="$(grep -E '^SUPABASE_DB_URI=' .env.local | cut -d= -f2- | tr -d '\r' | sed -E 's/^["'"'"']//; s/["'"'"']$//')"
eval "$(DBURI="$DBURI" python3 -c "import os,urllib.parse,shlex;u=urllib.parse.urlparse(os.environ['DBURI']);print('export PGPASSWORD=%s'%shlex.quote(urllib.parse.unquote(u.password or '')))")"
CONN="host=aws-1-ap-southeast-1.pooler.supabase.com port=5432 user=postgres.$REF dbname=postgres sslmode=require connect_timeout=15"
psql "$CONN" -tAc "select 'AUTH_OK'"                                                   # verify connection first
psql "$CONN" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/<schema>.sql
psql "$CONN" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/<seed>.sql   # if a seed file exists
# Record so a future `supabase db push` skips them (schema_migrations cols: version NOT NULL, statements/name nullable):
psql "$CONN" -c "insert into supabase_migrations.schema_migrations(version) values ('<ts1>'),('<ts2>') on conflict (version) do nothing;"
```
**Smoke-test a `SECURITY DEFINER` / RLS-guarded RPC** (it refuses non-admin callers) by faking an admin JWT in the SAME `--single-transaction` file, then calling it:
```sql
select set_config('request.jwt.claims', json_build_object('sub',(select user_id from public.user_roles where role='ADMIN' limit 1))::text, true);
select public.<fn>(…);
```
Security: after using `SUPABASE_DB_URI`, tell the user to **reset the DB password** (it's full DB access). `.env.local` is git-ignored — keep it that way.

### 3c. Regenerate types
```bash
npx supabase gen types typescript --project-id dvdpfjprncvkhfwcvqmp > src/integrations/supabase/types.ts
```
`types.ts` is **generated — never hand-edit**. `gen types --db-url` over the **pooler fails** (CLI limitation) and the direct host is IPv6-blocked, so with only `SUPABASE_DB_URI` you **cannot regen** — that's fine: access the new tables with `(supabase as any).from(…)` + `.rpc(…)` casts (the `useArticles.ts` / `useCampaigns.ts` pattern) and note that regen needs a personal access token later. Do not fake or hand-edit `types.ts`.

## 4. Fix every reader
Renaming/removing a column? `grep -rn "<column>" src/` and update the typed selects in the affected `src/hooks/*` and `src/lib/credits.ts` — a stale `.select("old_col")` is a silent runtime break.

## 5. Verify + log
Phase 4: `npm run lint && npm run build` green. Then **`/log-decision`** — terse entry + update `architecture.md` (or `business-rules.md` if a lifecycle/status rule changed).
