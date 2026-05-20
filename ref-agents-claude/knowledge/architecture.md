# Architecture — EduLMS

> Living document. Updated when architecture patterns are established or changed.

---

## Project Structure

```
lovable/
├── vsf-lms/          # Admin Portal (React 18, port 8080)
├── vsf-learner/      # Learner Portal (React 19, port 5173)
└── CLAUDE.md          # Root-level guidelines
```

Both portals share a single Supabase PostgreSQL database.

---

## Tech Stack

| Layer | Admin Portal (`vsf-lms`) | Learner Portal (`vsf-learner`) |
|-------|--------------------------|-------------------------------|
| Framework | React 18 + TypeScript + Vite | React 19 + TypeScript + Vite |
| UI | shadcn-ui + Tailwind CSS + Radix | shadcn-ui + Tailwind CSS + Radix |
| State | TanStack Query v5 + Zustand | TanStack Query v5 |
| Forms | React Hook Form + Zod | React Hook Form + Zod |
| i18n | i18next (Vietnamese default) | i18next (Vietnamese default) |
| Editor | Tiptap (rich text) | None |
| DnD | @dnd-kit | None |

---

## Version Management System (Admin Portal Only)

Dual-schema architecture for parallel development:
- **public** schema = Current/Stable version
- **v2** schema = New/Dev version

### ⚠️ CRITICAL: Versioned Client Pattern

```typescript
// ✅ ALWAYS use in hooks
import { useVersionedSupabase } from "@/integrations/supabase/versionedClient";
import { useVersionedQueryKey } from "@/lib/versionedQueryKeys";

const versionedSupabase = useVersionedSupabase();
const queryKey = useVersionedQueryKey(["entity"]);

// ❌ NEVER use raw client
import { supabase } from "@/integrations/supabase/client";
```

### File Editing Rule
- Default: edit `.new.tsx` files
- `.current.tsx` only if user explicitly requests

---

## Key Patterns

### React Query
- Query keys: `["entity"]` for lists, `["entity", id]` for single items
- Always version-prefix: `useVersionedQueryKey(["entity"])`
- Mutations invalidate queries on success + show toast

### Supabase Integration
```typescript
// Query with relations
const { data } = await versionedSupabase
  .from("programs")
  .select(`*, category:categories(id, name)`)
  .order("updated_at", { ascending: false });
```

### Forms
- Zod schema → `useForm({ resolver: zodResolver(schema) })`
- Pattern: define schema separately, validate client-side

### Rich Text
- Tiptap editor (admin portal only) with DOMPurify sanitization via `sanitizeHtml()` from `@/lib/sanitize`

### i18n
- `useTranslation(["namespace"])` in components
- Files: `src/i18n/locales/{vi,en}/` with namespaced JSON
- Vietnamese is default AND fallback
- Language stored in localStorage key `ui_lang`

---

## Supabase CLI Commands

Run from `vsf-lms/`:

```bash
npx supabase db push                    # Apply pending migrations
npx supabase db push --include-all      # Apply all including out-of-order
npx supabase migration list             # Check migration status
npx supabase db diff                    # Show schema differences
npx supabase gen types typescript --project-id neszdqqqnouawsysbxrn > src/integrations/supabase/types.ts
```

---

## Key Modules (Admin Portal)

| Module | Description |
|--------|-----------|
| Content Management | Subjects, programs, asset library, exam library, categories |
| Training | Courses, classes, sessions with QR attendance |
| Exams | Question banks, exam papers, events, grading workspace |
| Training Plans | Plan creation, goal/KPI management |
| Users | CRUD, groups (static/dynamic criteria), SAP sync |
| Certificates | Template management, issuance |

## Zustand Stores

| Store | Purpose |
|-------|---------|
| `versionStore` | Version state (current/new) |
| `dialogStore` | Shared confirm dialog state (`useConfirmDialog`) |
| `breadcrumbStore` | Dynamic breadcrumb titles |
| `filtersStore` | List page filter state |
| `uiStore` | General UI state |
| `sessionsViewStore` | Sessions hub view preferences |
| `appChangelogStore` | App changelog display |
| `schemaChangelogStore` | Schema changelog tracking |

---

## Services

| Service | Purpose |
|---------|---------|
| `deliveryModeService.ts` | `supportsSelfPaced()`, delivery mode logic |
| `courseCloneService.ts` | Course clone/version operations |
| `lib/training/programFinalResult.ts` | Client-side program final-result compute (2026-04-14 — avoids server RPC for UI-only aggregation) |

---

## Testing

| Aspect | Admin Portal | Learner Portal |
|--------|-------------|----------------|
| Location | Centralized: `src/tests/` | Co-located: next to source |
| Runner | Vitest + v8 coverage | Vitest + v8 coverage |
| Coverage target | 100% lines | 100% lines |
| Hook testing | `renderHook` + mock `useVersionedSupabase` | `renderHook` |

### Test Structure (Admin)
```
src/tests/
├── unit/       # lib/, services/, stores/
├── hooks/      # Custom hooks
├── components/ # Component render tests
├── mocks/      # Shared mock modules
├── fixtures/   # Test data factories
└── utils/      # testWrapper.tsx, etc.
```

### Hook Test Mocks
```typescript
vi.mock('@/integrations/supabase/versionedClient', () => ({
  useVersionedSupabase: () => ({ from: mockFrom, rpc: vi.fn() }),
}));
vi.mock('@/stores/versionStore', () => ({ ... }));
vi.mock('@/lib/versionedQueryKeys', () => ({ ... }));
```

---

## Routing

80+ routes in `App.tsx` under:
`/content/*`, `/training/*`, `/training-plans/*`, `/exams/*`, `/surveys/*`, `/users/*`, `/organization/*`, `/settings/*`, `/certificates/*`, `/reports/*`

### Learner Portal Routing
`/` (dashboard), `/my-classes`, `/my-classes/:id`, `/my-classes/:classId/lesson/:lessonId`, `/exams`, `/surveys`, `/certificates`, `/reports`, `/profile`

---

## Learner Portal Specifics

- **No version system** — single schema (`public`), no `.current.tsx`/`.new.tsx`, no versioned client
- **Lesson types:** video, audio, text, document, link, SCORM, assignment (quiz/essay/upload subtypes)
- **Layout:** `<MainLayout>` for most pages; `LessonPlayer` uses custom full-screen layout
- **Tests co-located** next to source files (not centralized like admin)
- **Primary color:** teal (`hsl(168, 76%, 32%)`)
- **React 19** (admin is React 18)

---

## Database

- Supabase PostgreSQL with auto-generated types
- Types: `src/integrations/supabase/types.ts` (public), `types-v2.ts` (v2)
- **Never edit types.ts directly** — regenerate with `npx supabase gen types typescript`
- Migrations: `vsf-lms/supabase/migrations/` (225+)
- Key tables: `categories`, `programs`, `subjects`, `courses`, `class_sections`, `enrollments`, `departments`, `users`, `certificates`, `certificate_templates`, and junction tables
- **PK convention:** UUID for new tables. Exception: Learning Paths tables use BIGINT PK (decided 2026-04-11) — do not change to UUID.

---

## Workforce App Reframing (2026-04-24)

`vsf-learner` is no longer "the learner portal" — it is the **workforce app**:

- Hosts every non-back-office field persona (Learner today, Mentor for OJT today, future Teacher/Instructor and Observer).
- Navigation is **role-gated** — Mentor sees the OJT work queue, Learner sees courses; both run from the same app shell.
- `vsf-lms` stays back-office desktop-only (Admin, Manager, Content Creator, Reporting).

When adding a new field persona, ship it under `vsf-learner` with a role nav guard, not a new repo. See `decisions-log.md → 2026-04-24 — vsf-learner Reframed as the Workforce App`.

---

## Mobile Design System (Learner Portal Only)

Mobile support in `vsf-learner` uses **sibling files**, not responsive variants:

```
src/pages/foo/
├── Foo.tsx           # tiny dispatcher: viewport → mobile or desktop
├── Foo.desktop.tsx
└── Foo.mobile.tsx
```

- Mobile design tokens cover safe-area insets, 44px minimum touch targets, mobile font scale.
- Lives only in `vsf-learner`. `vsf-lms` is desktop-only — do not introduce mobile patterns there.
- See `vsf-learner/docs/mobile-design-system.md` for the token list and `decisions-log.md → 2026-04-24 — Mobile Design System v1` for rationale.

---

## OJT Module

OJT is a **first-class `program_item`** (alongside `course`), not a `course_activity`. Driven by NĐ 44/2016 audit-record requirements.

Key tables (both `public` and `v2`): `ojt_templates`, `ojt_template_areas`, `ojt_template_items`, `ojt_assignments`, `ojt_assignment_areas`, `ojt_assignment_items`, `ojt_item_evaluations`, `ojt_assignment_reviews`.

- Assignments are **eager-created** at enrollment time (trigger on `learner_classes` insert).
- Mentor work-queue lives in `vsf-learner` (workforce app); admin views in `vsf-lms` are read-only.
- See `business-rules.md → OJT (On-the-Job Training)` for lifecycle, lock model, and UI rules.
