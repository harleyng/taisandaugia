---
description: How to merge Dev (New) version into Stable (Current) version in the Admin Portal
---

# Merge Dev → Stable Workflow

Promotes `.new.tsx` (Dev/experimental) changes to `.current.tsx` (Stable/production) in the Admin Portal (`vsf-lms/`).

> **Scope:** This only applies to `vsf-lms/`. The Learner Portal (`vsf-learner/`) has no version system.

---

## Overview

The Admin Portal has two layers of versioning:

| Layer | Dev (New) | Stable (Current) |
|-------|-----------|-------------------|
| **UI files** | `*.new.tsx` | `*.current.tsx` |
| **DB schema** | `v2` | `public` |
| **Header badge** | "Dev" | "Stable" |

Each versioned page has an `index.tsx` router that reads `useVersion()` from `versionStore` and conditionally renders either `.current.tsx` or `.new.tsx`.

---

## Steps

### 1. Identify files to merge

List all `.new.tsx` files that have changes to promote:

```bash
# Show all versioned file pairs
find vsf-lms/src -name "*.new.tsx" | sort
```

The user will specify which pages/components to merge, or say "merge all."

### 2. Copy `.new.tsx` content → `.current.tsx`

For each file the user wants to merge, **replace the entire content** of `.current.tsx` with the content of `.new.tsx`.

**Important:** Only change the file content — do NOT rename files or change imports. The `index.tsx` router expects both files to exist.

Example file pairs:
```
src/pages/training/classes/TrainingClassDetail/TrainingClassDetail.new.tsx
→ src/pages/training/classes/TrainingClassDetail/TrainingClassDetail.current.tsx

src/components/training/class-detail/ClassLearnersTab.new.tsx
→ src/components/training/class-detail/ClassLearnersTab.current.tsx
```

### 3. Fix imports in merged `.current.tsx`

After copying, check if the `.new.tsx` file imports other `.new.tsx` sub-components. If so, update those imports to point to `.current.tsx` equivalents:

```typescript
// In .current.tsx after merge, fix imports like:
// ❌ import { AddLearnerDialog } from "./AddLearnerDialog.new";
// ✅ import { AddLearnerDialog } from "./AddLearnerDialog.current";
```

Alternatively, if the sub-component was also merged, both `.new.tsx` and `.current.tsx` now have the same content and either import works. But **always verify import consistency**.

### 4. Database schema merge (DDL changes)

If the `v2` schema has **structural changes** (new columns, new tables, altered constraints, new indexes, modified triggers/functions) that don't exist in `public`, you must create a migration to apply those DDL changes to `public`.

**How to check:**
```bash
# Compare schemas to see structural differences
npx supabase db diff
```

**How to apply:**
1. Identify the DDL differences (new columns, altered types, new tables, etc.)
2. Write a new migration in `vsf-lms/supabase/migrations/` that applies those changes to the `public` schema
3. Push the migration:
```bash
npx supabase db push
```

> ⚠️ Be careful with destructive DDL (dropping columns, changing types). Always review the diff first.

### 5. Database data merge (row-level sync)

After the schema is aligned, merge the **data** from `v2` → `public`:

```bash
# From vsf-lms/ directory — updates rows where v2 is newer, inserts new rows
psql $DATABASE_URL -f scripts/merge-new-to-current.sql
```

The script:
- Creates a backup in `backup_before_merge` schema
- Updates existing records where v2 has a newer `updated_at`
- Inserts new records from v2 that don't exist in public
- Does NOT delete records (conservative merge)
- Syncs sequences to prevent ID collisions

> ⚠️ The script covers specific tables (categories, programs, subjects, courses, class_sections, modules, lessons, junction tables). If new tables were added in v2, you may need to **update the merge script** to include them.

### 6. Regenerate types (if DB was merged)

```bash
# From vsf-lms/ directory
./scripts/generate-types.sh
```

This updates:
- `src/integrations/supabase/types.ts` (public schema)
- `src/integrations/supabase/types-v2.ts` (v2 schema)

### 7. Verify

// turbo-all
```bash
cd vsf-lms && npm run test
cd vsf-lms && npm run lint
cd vsf-lms && npm run build
```

All three must pass.

### 8. Smoke test both versions

1. Switch to **Stable** in the header → verify merged pages work correctly
2. Switch to **Dev** in the header → verify Dev pages still work

---

## Key Files

| File | Purpose |
|------|---------|
| `src/stores/versionStore.ts` | Zustand store: `useVersion()` hook |
| `src/integrations/supabase/versionedClient.ts` | Schema-aware Supabase wrapper |
| `src/lib/versionedQueryKeys.ts` | Version-prefixed cache keys |
| `src/components/VersionSwitcher.tsx` | Header toggle UI |
| `scripts/merge-new-to-current.sql` | DB merge script (v2 → public) |
| `scripts/sync-current-to-new.sql` | DB sync script (public → v2, destructive) |

---

## Common Patterns

**Pages with version routers** (`index.tsx` files):
- `src/pages/training/classes/TrainingClassDetail/index.tsx`
- `src/pages/training/classes/TrainingClasses/index.tsx`
- `src/pages/training/classes/CreateClass/index.tsx`
- `src/pages/training/classes/EditClass/index.tsx`
- `src/pages/training/classes/ActivitySubmissions/index.tsx`
- `src/pages/training/classes/ClassLearnerDetail/index.tsx`
- `src/pages/training/classes/SubmissionGrading/index.tsx`

**Components without index routers** (74+ `.current.tsx` / `.new.tsx` pairs):
These are imported directly by their parent page's `.current.tsx` or `.new.tsx` — merge them together with their parent page.
