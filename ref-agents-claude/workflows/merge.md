---
description: Supabase migration and schema workflow for Tài Sản Đấu Giá
---

# Supabase Migration Workflow

This project uses a single `public` schema — there is no dual-schema versioning system. This document covers the standard migration workflow.

---

## Applying Migrations

```bash
# Apply pending migrations to remote DB
npx supabase db push

# Apply all migrations including out-of-order ones
npx supabase db push --include-all

# Check migration status
npx supabase migration list
```

Always run migrations yourself — never ask the user to run them manually.

---

## Creating a Migration

1. Create a new SQL file in `supabase/migrations/` with timestamp prefix:
   ```
   supabase/migrations/YYYYMMDDHHMMSS_description.sql
   ```
2. Write additive SQL (new tables, new columns, new indexes)
3. Never modify existing migration files

### Migration Rules

- **Additive changes preferred** — add columns rather than rename/drop
- **RLS required** — every new table must have RLS enabled and an appropriate policy
- **Always include `IF NOT EXISTS`** — for idempotent migrations
- **Timestamps** — all tables need `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- **UUIDs** — use `gen_random_uuid()` as default PK
- **Status as text** — store status values as `TEXT`, not Postgres enums (easier to extend)
- **Index strategy** — add indexes for foreign keys and commonly filtered columns

### RLS Template

```sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

-- User can only access their own rows
CREATE POLICY "own rows" ON my_table
  FOR ALL USING (auth.uid() = user_id);

-- Public read access
CREATE POLICY "public read" ON my_table
  FOR SELECT USING (true);
```

---

## After Schema Changes

Always regenerate types after any migration:

```bash
npx supabase gen types typescript --project-id bcusbpkfnydqcvxxjvew > src/integrations/supabase/types.ts
```

Never edit `src/integrations/supabase/types.ts` manually.

---

## Verification After Migration

```bash
npx supabase migration list   # Confirm migration applied
npm run build                 # Confirm TypeScript compiles with new types
```
