# Common Pitfalls — EduLMS

> Living document. Things that have gone wrong or are easy to get wrong.

---

## UI / Component Pitfalls

### Alert Component — Only `"default"` | `"destructive"` Variants
The shadcn Alert only supports two variants. For warning-style alerts, use className overrides:
```tsx
className="border-support-warning/50 text-support-warning [&>svg]:text-support-warning"
```

### Alert Component — Vertical Centering
Alert's default CSS uses absolute-positioned icon (`[&>svg]:absolute [&>svg]:top-4`) and content offset (`[&>svg+div]:translate-y-[-3px]`). For inline flex layout, override ALL of these:
```tsx
className="flex items-center [&>svg]:static [&>svg]:shrink-0 [&>svg~*]:pl-2 [&>svg~*]:flex-1 [&>svg+div]:translate-y-0"
```

### Button + Link — Silent Disappearance
`<Button asChild><Link>` causes buttons to silently disappear from DOM. Always use `useNavigate()` instead. See decisions-log.md.

### Button Styling — Design System vs Legacy
The codebase has two Button APIs:
- **DS API:** `dsVariant="brand" buttonType="solid"` (preferred)
- **Legacy API:** `variant="outline" size="sm"` (still in most code)

Don't mix them. When creating new code, follow the surrounding file's convention.

### Exam Event Config Actions Must Stay In Detail Context
On `ExamEventDetail`, the exam-paper/config action should open an inline configuration sheet from the detail page, mirroring the Exam Template settings flow. Routing that action to `/exams/events/:id/edit` breaks the expected task flow because edit pages only cover event metadata/schedule, not exam-paper settings. Keep the trigger visible in all statuses and let the sheet enforce read-only mode outside `draft`, or users lose the expected entry point and assume the feature is missing. The event sheet must also stay aligned with the subset of template settings that `exam_events` actually supports, including attempts, scoring, result display, and submission review controls; trimming it down creates a misleading mismatch between `Bộ đề` and `Đề thi`.

### Tree Search Must Render a Filtered Hierarchy
On hierarchical pages like Organization Structure, wiring a `SearchInput` to state is not enough. The page must render a derived filtered tree, keep matching ancestors visible, and avoid leaving the raw tree on screen or the search box will appear broken.

### Category Tree Indentation Must Not Cap Depth
The Category list tree is used for real enterprise taxonomies that can go beyond 5 levels. Do not clamp indentation or connector offsets with logic like `Math.min(level, 4)`, or level 6+ rows will collapse onto the same visual column and the tree will look broken.

### Category Code Entry — Keep Create and Add-Child Flows Aligned
The category create page supports `Tự động tạo mã`, and the add-subcategory dialog should mirror that behavior. If one flow requires manual code entry while the other auto-generates `CAT-XXXXX`, admins end up with inconsistent validation and higher data-entry friction.

### Category Add-Child Dialog Width Must Fit the Code Controls
The add-subcategory dialog now carries an inline code field plus the `Tự động tạo mã` toggle. Keep its modal width at a comfortable desktop size (`sm:max-w-[640px]` or equivalent), or the code controls become cramped and the form feels visually broken.

### Admin Tree Rows With Row-Click Toggle Need Propagation Guards
For admin hierarchies like Category and Organization Structure, row-click expand/collapse is acceptable, but every embedded interactive control must stop event propagation. If the chevron, linked-count button, add-child button, or overflow trigger bubbles up, admins will collapse branches while trying to perform another action.

### Don't Wrap Tab Content in Accordion — Double Disclosure
Panes inside a `<Tabs>` must not themselves be wrapped in `<Accordion>` / `<Collapsible>`. The user already disclosed the content by clicking the tab — the second layer is pure friction and hides information behind an extra click. Also produces visible inconsistency when sibling tabs use the canonical flat `bg-card rounded-lg border p-5` wrapper and one tab is a card-inside-accordion. Use the canonical wrapper (see `design-system.md` → Tab Content Section Wrapper).

Examples: `ApprovalHistoryTimeline` replaced the old `ApprovalHistoryCard` (Accordion inside a Card) for exactly this reason.

### Tab Content Must Not Return `null` for Empty States
If the user clicks a tab, they committed to seeing something. Returning `null` on empty data leaves a blank white area that looks broken. Always render a full empty state inside the canonical section wrapper — icon + title + helper text, plus a suggested next action if there is one.

### Timelines Need `from → to` Status Transition, Not Just `to`
Audit-log timelines (approval history, role history) must render `<StatusBadge from /> → <StatusBadge to />` when both are present. Showing only the new status loses the causality that makes the timeline readable ("went from draft to pending_approval" vs "pending_approval"). Reuse the existing `StatusBadge` with the right `entity` — never hand-roll status colors in the timeline.

---

## Data / Supabase Pitfalls

### Raw Supabase Client = Schema Bugs
Using `import { supabase } from "@/integrations/supabase/client"` always queries `public` schema. When user is viewing `v2` version, this causes 406 errors or stale data.

**Fix:** Always use `useVersionedSupabase()`.

### Supabase Types — Never Edit Manually
`src/integrations/supabase/types.ts` and `types-v2.ts` are generated. Manual edits will be overwritten. After schema changes:
```bash
npx supabase gen types typescript --project-id neszdqqqnouawsysbxrn > src/integrations/supabase/types.ts
```

### Heavy Migrations via SQL Editor Can Crash the Project (RAM/Burst Compute Exhaustion)

Running large/heavy migration scripts directly through the Supabase **SQL editor** can spike RAM and burn through the daily burst-compute budget (~30 min/day), triggering a restart/crash cycle that takes the entire project down for hours. This happened on 2026-05-08 (04:00–07:00 UTC) — see `decisions-log.md`.

**Rules:**
- **Batch row-touching DML.** For backfills, `UPDATE`/`INSERT … SELECT`, or column rewrites on tables with >10k rows, chunk by `id`/`created_at` ranges or use `LIMIT` + loop. Avoid one-shot statements that scan or rewrite an entire large table.
- **Prefer the migration pipeline over the SQL editor for heavy work.** Migrations applied via `npx supabase db push` are still subject to the same compute limits, but they're reviewable, replayable, and easier to split. Ad-hoc SQL-editor runs hide the blast radius.
- **Inspect `EXPLAIN` and estimated row counts before running.** If a statement will touch more than a few thousand rows, plan to chunk it.
- **Don't combine heavy DDL + DML in one transaction.** A single migration that adds a column *and* backfills it across the whole table is a known crash pattern. Split into two migrations (DDL first, then a chunked backfill).
- **Watch for resource saturation.** If the project status flips to "unhealthy" or queries start timing out during a migration, **stop and investigate** rather than retrying — retries feed the crash loop.

The current compute tier is **micro** (free upgrade from nano post-incident, 2026-05-08). This raises the ceiling but does not remove it.

---

## i18n Pitfalls

### Duplicate Keys in JSON
The exams.json translation files already have duplicate keys (pre-existing). The JSON linter warns about them but they're not blocking issues currently.

### HTML in Translations
Some translations use `<strong>` tags and are rendered via `dangerouslySetInnerHTML`. When adding new translations with HTML, use `<span dangerouslySetInnerHTML={{ __html: t("key") }} />`.

---

## Testing Pitfalls

### Test Location Convention Differs by Portal
- **Admin (`vsf-lms`):** Centralized in `src/tests/`
- **Learner (`vsf-learner`):** Co-located next to source

Putting tests in the wrong location will cause coverage gaps or confusion.

### Hook Tests Need Versioned Client Mocks
Every hook test in admin portal must mock the versioned client:
```typescript
vi.mock('@/integrations/supabase/versionedClient', () => ({
  useVersionedSupabase: () => ({ from: mockFrom, rpc: vi.fn() }),
}));
```

---

## Status / Business Logic Pitfalls

### Session Status — Client-Side Fallback vs DB Status Mismatch
`computeSessionStatus()` returns `"in_progress"` for sessions whose DB status is `"scheduled"` but whose start time has passed (compensating for cron lag). This creates two categories of issues:

1. **Mutations**: Any mutation that validates transitions must use the **effective** status from `computeSessionStatus()`, not the raw DB status. The hooks `useCompleteSession` and `useUpdateClassSessionStatus` handle this by auto-transitioning `scheduled → in_progress` when the effective status diverges.

2. **List filtering**: Uses a hybrid DB + client-side strategy in `useSessionsHub`. Terminal statuses (`completed`, `cancelled`) are filtered purely at the DB level (safe — no mismatch). For `scheduled` and `in_progress`, the DB pre-filters to reduce payload (e.g., `in_progress` sends `statusIn: ["scheduled", "in_progress"]`), then `filteredSessions` post-filters client-side against the computed status. Pure DB-side filtering would show "Đã lên lịch" sessions that are actually "Đang diễn ra", and "Đang diễn ra" filter would return empty results. See `getDbStatusParams()` and `TERMINAL_STATUSES` in `useSessionsHub.ts`.

### `"published"` vs `"active"` — Context Matters
- Content (programs, subjects, courses): use `"published"`
- Operational (classes, categories, skills): use `"active"`
- Mixing these up breaks status-dependent UI (publish/unpublish actions, visibility filters)

### Exam Events — Participants Are Required
Initially proposed as "recommended" (nice-to-have) for activation. **Business requirement: admin must add at least 1 participant before activating.** This was corrected during the exam event activation rules implementation.

### Exam Password Gate — Per-Tab By Design
`isExamPasswordVerified()` reads from sessionStorage, not localStorage. This is deliberate: opening the exam in a new tab must force re-verification (in-person proctor model). Do not "fix" this by switching to localStorage or persisting across tabs. The client-side flag is also only a UX guard — the real gate is the RPC `verify_exam_password`, which re-validates password + participant + time window on every call.

### Exam Password Gate Applies To Standalone Exams Only
`passwordEnabled` lives on `exam_events`. Class-based exams delivered through `assessment_templates` (`ExamBriefing`, `ExamActivityContent`) have no equivalent column and are not gated. Do not import `ExamPasswordDialog` / `useVerifyExamPassword` into the class-based exam flow — it will not compile against the wrong data shape.

---

## Component Design Pitfalls

### Pages Over 300 Lines
Page components should orchestrate smaller components, not contain all UI logic. Extract form sections, tab content, modals, and list items into separate files. Keeps code reviewable and testable.

### Cross-Portal Feature Impact
When changing DB schema or shared tables (courses, enrollments, etc.), remember both portals read the same database. Check if changes affect the Learner Portal's hooks and views too.

---

## OJT Pitfalls

### OJT Requirement Chips ≠ Status
On `OjtAssignmentDetail`, do not render `require_supervisor_approval` / `require_learner_confirmation` as pill chips next to the `StatusBadge` in the header. They look like status values but are **policy/configuration flags**. Users misread them as states. Surface that information in the General tab (`OjtApprovalProgress` stepper + state banners) — the header right side is for the actual `StatusBadge` only.

### OJT Tier-1 Template Fields Are Immutable Post-Issuance
Once any non-terminal assignment exists from an OJT template, the Tier-1 fields (checklist items, areas, completion rule, `skill_id`, `skill_level_id`, `worker_group`) are blocked from edit on the template. Admin must **clone-to-edit** via the `clone_ojt_template` RPC. The UI guard is the application layer — present a "Nhân bản để chỉnh sửa" CTA, not a raw constraint error. See `decisions-log.md → 2026-05-06 — OJT Two-Tier Template Lock Model`.

### OJT Assignments Are Single Calendar Events
Use `event_date` + `start_time` + `end_time`. Do **not** reintroduce `start_date` / `due_date` range columns or restore `useExtendOjtAssignment`. Both portals expect the single-event shape — a date-range fallback will produce broken queue/calendar UX in the workforce app.

### OJT Tier-2 Flag Edits Need Propagation
Editing `require_supervisor_approval` or `require_learner_confirmation` on a template prompts admin to propagate to in-flight no-eval assignments via `propagate_ojt_template_policy` RPC. Don't silently ignore — each propagated assignment writes one `ojt_assignment_reviews` row with action `rules_updated_from_template` for audit. The lock fires on first real evaluation (any `ojt_item_evaluations` row with result ≠ `not_evaluated`).

### OJT `code` vs `claim_code` — Two Distinct Fields
`ojt_assignments` carries TWO codes with very different roles. Don't conflate them.

- **`code`** (`OJT-NNNNNN`) — sequential, per-tenant unique, **stable per-session identifier**. Admin-visible (list column, detail chip, search). Set on insert, never cleared. Still **NOT** a primary key / URL identifier — UUID `id` remains canonical for routes, joins, FKs.
- **`claim_code`** (random 6 digits) — **one-time mentor-claim token**. Populated only while `status = 'pending_mentor'`; cleared to NULL by `claim_ojt_as_mentor` on successful claim. Surfaced only on the Learner Portal (`OjtClaimQrPanel`, `OjtStatusAlert`, `/mentor/ojt/claim/:code`). **Never display in Admin Portal UI.**

The two were the same column from 2026-05-12 to 2026-05-14 (the `code` column was repurposed and then split). See `decisions-log.md → 2026-05-14 (evening) — OJT code vs claim_code Split`.

### OJT Indicator Title Carries Author Line Breaks
`ojt_template_items.title` is plain text but **trainers author multi-line, multi-step instructions** in it (e.g. `Bước 1: …\nBước 2: …`). The schema cap is 5000 chars to fit those steps. Read surfaces must render with `whitespace-pre-line` (screen) or `white-space: pre-line` (print CSS) — otherwise newlines collapse to spaces and the steps run together. Dense list rows that intentionally fit on one line can keep `.truncate` (it collapses newlines via `white-space: nowrap`, which is the right behavior there). Apply this to any new OJT report, PDF export, or printable evaluation form when added.

### Changing `create_ojt_assignment` Signature Breaks the Enrollment Trigger
The `program_assignments` INSERT/UPDATE-of-status trigger (`create_ojt_assignments_for_program_assignment()`, originally `20260424110300`, refixed by `20261104100000`) calls `create_ojt_assignment` by **named arguments**. If a later migration renames or removes a parameter on the RPC, the trigger's `PERFORM` raises `function does not exist` at runtime. The original 2026-04-24 version wrapped the call in `EXCEPTION WHEN OTHERS THEN NULL`, which silently swallowed this for ~weeks — enrollment succeeded but no OJT assignments were ever created. **Whenever you touch the `create_ojt_assignment` signature, also update the trigger function body in the same migration.** The refixed trigger now catches only `unique_violation`, so real misconfigurations surface loudly — keep it that way.

---

## Mobile Pitfalls

### Don't Make Existing Screens Responsive — Use Sibling Files
Mobile screens in `vsf-learner` are **separate files** (`Foo.mobile.tsx` next to `Foo.desktop.tsx` with a small dispatcher). Don't shoehorn mobile breakpoints into the existing desktop component to "make it responsive" — the project-wide pattern is sibling files for safe-area, 44px touch targets, and mobile font scale. See `decisions-log.md → 2026-04-24 — Mobile Design System v1`.

### No Mobile Patterns in `vsf-lms`
`vsf-lms` is desktop-only — back-office personas use desktops. Do not introduce mobile design tokens, sibling `.mobile.tsx` files, or responsive mobile breakpoints into the admin portal.

---

## Skills Pitfalls

### No Global Skill Catalog or KN Scale
As of 2026-05-04, skills + the level scale are per-tenant. Don't seed a global skill catalog, don't hardcode KN1–KN5 labels, and don't reintroduce the `skill_target_level SMALLINT` integer encoding. Forms must read `skill_levels` rows for the active tenant and write `skill_level_id` FK. The KN3 cap on OJT targets is removed.
