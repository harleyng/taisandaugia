# Design System — EduLMS (V-Mini)

> Living document. Updated when design patterns are established or changed.
>
> See also: [component-registry-admin.md](component-registry-admin.md) and [component-registry-learner.md](component-registry-learner.md) for the full component inventory with props and usage context.

---

## Color System

### Brand Colors
- `text-brand` / `bg-brand` — Primary brand red (#EA0029)
- `text-brand-subtle` / `bg-brand-subtle` — Light backgrounds
- `text-brand-strong` / `bg-brand-strong` — Dark emphasis
- `text-brand-disabled` / `bg-brand-disabled` — Disabled state

### Support Colors (Status Semantics)
- **Positive (success):** `text-support-positive`, `bg-support-positive-subtle`
- **Warning:** `text-support-warning`, `bg-support-warning-subtle`
- **Negative (error):** `text-support-negative`, `bg-support-negative-subtle`
- **Info:** `text-support-info`, `bg-support-info-subtle`

### Link Colors
- `text-link` / `text-link-hover` — Standard links
- `text-link-inverse` — Links on dark backgrounds

---

## Typography

- **Font:** Be Vietnam Pro (admin), Lexend (design system spec)
- **HSL variables** — stored without `hsl()` wrapper for Tailwind opacity modifiers
- Combined utility classes: `font-{size}-{weight}` (e.g., `font-base-medium`, `font-x-small-regular`)

---

## Button Component

### Preferred API (Design System)
```tsx
<Button dsVariant="brand" buttonType="solid">Primary CTA</Button>
<Button dsVariant="neutral" buttonType="outline">Secondary</Button>
```

### Legacy API (still in codebase)
```tsx
<Button variant="outline" size="sm">Legacy</Button>
```

### Hierarchy: solid > outline > solid-subtle > ghost
### Variants: brand | neutral | neutral-inverse

### ⚠️ CRITICAL: Button + Link Pattern
**NEVER** use `asChild` with `<Link>` inside `<Button>` — causes silent rendering failures.
```tsx
// ❌ BAD — Button disappears from DOM
<Button asChild><Link to="/path">Click</Link></Button>

// ✅ GOOD — Use useNavigate()
const navigate = useNavigate();
<Button onClick={() => navigate("/path")}>Click</Button>
```

---

## Page Composition Patterns

### Detail Pages
1. **`DetailHeroCard`** — Title, badges, metadata, stats, action buttons
2. **Setup Checklist** — For entities with activation (classes, exam events): show `ClassSetupChecklist` / `ExamEventSetupChecklist` when status is `draft`
3. **`Tabs`** — Content organized by tab (Overview, Participants, etc.)
4. **`ConfirmDialog`** — Status-change confirmations

### Tab Content Section Wrapper (Detail Pages)
Sibling tab panes on the same detail page must use the **same flat section wrapper** — do NOT mix shadcn `<Card>` (which adds `rounded-xl` + shadow) with plain `bg-card` divs across tabs on the same page, or the tabs look inconsistent.

Canonical wrapper used by `PlanSettingsCard`, `ApprovalHistoryTimeline`, etc.:
```tsx
<section aria-labelledby="section-heading" className="bg-card rounded-lg border p-5">
  <h2 id="section-heading" className="text-lg font-semibold mb-4">Section title</h2>
  {/* content */}
</section>
```

**Do not** wrap tab content in `<Accordion>` or `<Collapsible>` — the user already committed to viewing this pane by clicking the tab; a second disclosure is redundant friction.

### Timeline Pattern (Audit / History Lists)
Used by `ApprovalHistoryTimeline`, `RoleHistoryTimelineV2`. Shared structure:
- Vertical rail: 2px `bg-border` line between nodes, `aria-hidden="true"`
- Node: 40×40 `rounded-full` with `semanticToneClassMap[tone].bgSubtle` + `text`
- Last item has no rail below it (bounded audit logs — don't fade)
- Latest/newest item gets a `ring-2 ring-offset-2 ring-offset-card` + a tone-colored "Hiện tại" pill
- Use `<StatusBadge status={...} entity="..." />` pairs for `from → to` transitions — never hand-roll status colors
- Absolute timestamp (`formatDateTime`) + `·` separator dot + relative (`formatRelativeTime`)

When extracting to a shared primitive (not done yet — wait for 3rd use case), target `src/components/ui/timeline.tsx` with pure presentational `Timeline` + `TimelineNode` components. Keep collapsible/filter concerns in the domain wrapper, not the primitive.

### List Pages
1. **`PageHeader`** — Title, subtitle, primary action button
2. **Metrics row** — Summary cards (total, active, etc.)
3. **`FilterChip`** + search — Filtering controls
4. **`DataList`/`Table`** — Main data display
5. **`EmptyState`** — When no data

### Form Pages
- React Hook Form + Zod validation
- Split into card sections: Basic Info, Configuration, etc.
- `useNavigate()` for cancel/success navigation

### Assessment Result Pages
1. **Sticky context bar** — Back navigation plus lightweight page context
2. **Outcome hero** — Score/status, attempt metadata, passing threshold, and only the minimum supporting context needed to understand the result
3. **Next steps card** — Primary CTA changes by result state (review detail, retry, certificate, back to list)
4. **Submission detail disclosure** — Keep answer-by-answer review collapsed by default and open it via dialog/accordion only when the learner explicitly asks for it
5. **Review state messaging** — If review is delayed, disabled, or still loading, explain that inside the disclosure entry point and detail surface instead of expanding empty content on page load

---

## UI Component Patterns

### StatusBadge
```tsx
<StatusBadge status="published" entity="content" />
<StatusBadge status="active" entity="examEvent" />
```
Always use semantic entity mapping, not raw styling.

### Alert Component Customization
The `Alert` component only supports `"default"` and `"destructive"` variants.
For warning-style alerts, override via className:
```tsx
<Alert className={cn(
  "flex items-center [&>svg]:static [&>svg]:shrink-0 [&>svg~*]:pl-2 [&>svg~*]:flex-1 [&>svg+div]:translate-y-0",
  !isReady && "border-support-warning/50 text-support-warning [&>svg]:text-support-warning"
)}>
```

### Setup Checklist Pattern
Used for: Training Classes (`useClassSetupCompletion` + `ClassSetupChecklist`), Exam Events (`useExamEventSetupCompletion` + `ExamEventSetupChecklist`)

Structure:
- Pure computation hook returns `{ items, missingRequired, isReadyToActivate, percentage }`
- Checklist component shows progress bar, alert, item list with action links
- Ready-state alert includes inline action button (text style, not solid button)
- Activate button in header is disabled when `!isReadyToActivate` with tooltip showing missing items

### Hierarchical Tree Controls
Used for admin hierarchies like Category and Organization Structure.

Structure:
- Keep an explicit chevron disclosure button visible for branch expand/collapse.
- Branch rows may also toggle on row click for faster scanning, but embedded actions must be isolated from that behavior.
- Add `stopPropagation()` guards to the chevron, links, counts, add-child buttons, and overflow triggers so those controls do not accidentally collapse the branch.
- Use a shared paired control for global tree actions (`Expand all` / `Collapse all`) instead of icon-only standalone buttons.
- Drive global expand/collapse from the currently visible filtered tree IDs, not the full hidden dataset.
- Disable `Expand all` when the visible tree is already fully expanded, and disable `Collapse all` when it is already fully collapsed.
- Keep leaf rows aligned by reserving the disclosure slot with a non-interactive spacer instead of an invisible focusable button.

---

## Component Design Rules

1. **Think reusable first** — Extract common patterns into standalone components
2. **Pages under 300 lines** — Break into tab components, form sections, modals
3. **Single responsibility** — Each component = one clear purpose
4. **File conventions:** `.new.tsx` = default edit target, `.current.tsx` = production/stable

---

## Mobile (vsf-learner only)

vsf-lms is desktop-only per the 2026-04-24 portal-split decision. **Mobile lives only in vsf-learner**, the workforce app.

**Pattern:** separate `.mobile.tsx` / `.desktop.tsx` files behind a `MobileAwareProxy` (NOT responsive Tailwind). This applies where the layouts diverge (top-app-bar vs sidebar, sticky bottom CTA vs inline button, full-screen sheet vs side dialog). For pure read-only pages with column-count differences, plain responsive Tailwind is still the right tool.

**Source of truth:** [`vsf-learner/docs/mobile-design-system.md`](../../vsf-learner/docs/mobile-design-system.md). It owns the full token table, folder convention, component patterns, Vietnamese-specific rules, accessibility checklist, and the audit punch-list. **Do not duplicate that content here** — read it before building any new mobile screen.

**Token quick-reference:**

| Token family | Tailwind | Why |
|---|---|---|
| Safe-area | `pt-safe-top`, `pb-safe-bottom`, `pl-safe-left`, `pr-safe-right` | Notch / home indicator / gesture nav |
| Touch targets | `min-h-touch` (44px), `min-h-touch-lg` (56px) | WCAG 2.5.5 |
| Mobile font scale | `text-mobile-base` (16px) for inputs to prevent iOS auto-zoom; `text-mobile-sm`, `text-mobile-lg` | Vietnamese diacritic line-heights pre-tuned |
| Mobile chrome | CSS vars `--mobile-header-h` (56px), `--mobile-tabbar-h` (56px) | Sticky header / tab bar offsets |

**When in doubt, read the mobile design system doc first** before introducing a new pattern.
