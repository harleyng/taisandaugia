# Design System — Tài Sản Đấu Giá (taisandaugia)

> Living document / current-truth. Referenced by: `ui-ux-designer`, `new-page` skill.
> Tokens are live in `src/index.css` (CSS vars, HSL) and mapped in `tailwind.config.ts` (Tailwind utilities).
> **Never add new color values or change existing tokens** (per CLAUDE.md). Every Tailwind class must map to a token below.

---

## Color System

Colors are CSS vars in `H S% L%` form (no `hsl()` wrapper) so Tailwind opacity modifiers (`/50`, `/20`, `/90`) work. A `.dark` class block in `src/index.css` overrides every token (dark mode is `class`-based — `darkMode: ["class"]`).

### Brand & surface (CSS vars → Tailwind)

| Token | Tailwind | CSS var (light) | Usage |
|---|---|---|---|
| Primary (Green) | `bg-primary` / `text-primary` | `--primary: 152 60% 26%` | CTAs, stepper, focus rings, active nav, links in prose |
| Primary hover | `bg-primary-hover` | `--primary-hover: 152 60% 20%` | Hover state of primary CTAs |
| Primary foreground | `text-primary-foreground` | `--primary-foreground: 0 0% 100%` | Text on primary |
| Accent (Amber) | `bg-accent` / `text-accent` | `--accent: 43 96% 56%` | Highlights, credit/price emphasis, badges |
| Accent foreground | `text-accent-foreground` | `--accent-foreground: 0 0% 100%` | Text on amber |
| Background | `bg-background` | `--background: 0 0% 100%` | Page background |
| Foreground | `text-foreground` | `--foreground: 222 47% 11%` | Primary text |
| Card | `bg-card` | `--card: 0 0% 100%` | Card surface |
| Popover | `bg-popover` | `--popover: 0 0% 100%` | Menus, dropdowns |
| Secondary | `bg-secondary` | `--secondary: 220 14% 96%` | Subtle fills, chips |
| Muted | `bg-muted` | `--muted: 220 14% 96%` | Muted surfaces, skeletons |
| Muted foreground | `text-muted-foreground` | `--muted-foreground: 215 16% 47%` | Secondary/label text, metadata |
| Border / Input | `border-border` / `border-input` | `--border` / `--input: 220 13% 91%` | Hairlines, input borders |
| Ring | `ring-ring` | `--ring: 222 47% 11%` | Focus ring |

### Semantic / status (CSS vars)

| State | Tailwind | CSS var (light) | Usage |
|---|---|---|---|
| Success | `text-success` / `bg-success` | `--success: 142 76% 36%` | Completed KYC milestone, APPROVED, unlocked, deposit confirmed |
| Warning | `text-warning` / `bg-warning` | `--warning: 38 92% 50%` | "Company already linked", pending review, expiring access |
| Destructive | `bg-destructive` / `text-destructive` | `--destructive: 0 84% 60%` | REJECTED, delete/unlink, errors |

> `success` and `warning` are exposed as flat Tailwind colors (`bg-success`, `text-warning`) in `tailwind.config.ts` — there is no `-foreground` pair for them; use `text-white` on solid fills.
>
> `--primary` and `--success` are **both green**. In charts, never put a success-green series next to a primary series — pick a distinct hue for the second series (see the chart note in `CLAUDE.md`). `text-warning` on a light tint is low-contrast for small text: for small warning badges use `bg-warning/15 text-foreground` and keep `text-warning` for icons.

### Extras (defined but rarely touched)

- Hero gradient: `--hero-gradient-start: 152 60% 26%` → `--hero-gradient-end: 152 50% 36%` (green sweep on the homepage hero). Applied via inline `linear-gradient(...)` using these vars, not a Tailwind utility.
- Shadows: `shadow-sm|md|lg|xl` map to `--shadow-*` vars (soft neutral shadows). Prefer these over ad-hoc `shadow-[...]`.
- Transitions: `--transition-base` (0.2s) / `--transition-smooth` (0.3s), cubic-bezier `(0.4,0,0.2,1)`.
- Sidebar tokens (`--sidebar-*`, dark green) drive the admin / company-portal / owner-portal nav shells only (e.g. `components/owner-portal/OwnerPortalSidebar.tsx`).

### The rule

**Do not introduce new hex/rgb/hsl literals in components.** If a shade is missing, use an existing token with an opacity modifier (e.g. `bg-primary/10`, `border-warning/50`, `text-muted-foreground/70`). New tokens require editing `src/index.css` **and** its `.dark` counterpart — a deliberate, reviewed change, not an inline value.

---

## Typography

- **Font:** no custom webfont is loaded (`index.html` has no font link, `tailwind.config.ts` sets no `fontFamily`). The app uses Tailwind's default `font-sans` system-UI stack. Do not add a font CDN link (CSP / offline PWA); if a brand font is ever needed, self-host and register it in `tailwind.config.ts`.
- **Scale:** Tailwind utilities — `text-xs` (labels, metadata, credit chips), `text-sm` (dense body, table cells, nav), `text-base` (body), `text-lg`/`text-xl` (section titles), `text-2xl`+ (hero/page titles). Weights 400/500/600/700.
- **Prose:** rendered article/report HTML uses the `.article-body` and `.tiptap.ProseMirror` styles in `src/index.css` (do not restyle headings inline in those contexts). `@tailwindcss/typography` plugin is available.

---

## Radius & Spacing

- `--radius: 0.5rem` (8px) → `rounded-lg` (default), `rounded-md` = `radius − 2px`, `rounded-sm` = `radius − 4px`.
- **Cards use `rounded-2xl`** (16px) — the house style for listing cards, paywall dialogs, KYC section cards, wizard panels. Match it; don't downgrade cards to `rounded-lg`.
- Badges/chips are `rounded-full` (shadcn `Badge`, `CreditBalanceChip`). Inputs/buttons use `rounded-md`.
- Spacing on the standard 4px scale (`gap-*`, `p-*`, `space-y-*`). Mobile tap targets are enforced ≥ 44px via a global `@media (max-width:768px)` rule in `src/index.css` — don't fight it with fixed tiny heights.

---

## Button Component (`components/ui/button.tsx`)

Single shadcn API (no dual DS API in this project).

```tsx
<Button>Primary CTA</Button>                       // variant="default" → bg-primary (green)
<Button variant="outline" size="sm">Phụ</Button>
<Button variant="secondary">Trung tính</Button>
<Button variant="ghost" size="icon"><Icon /></Button>
<Button variant="destructive">Xóa</Button>
<Button variant="link">Xem thêm</Button>
```

- `variant`: `default` | `destructive` | `outline` | `secondary` | `ghost` | `link` (hierarchy: default > outline > secondary > ghost > link).
- `size`: `default` (h-10) | `sm` (h-9) | `lg` (h-11) | `icon` (h-10 w-10).
- Icons: pass an SVG child — the base class auto-sizes it to `size-4`.

### ⚠️ CRITICAL — never `asChild` `<Button>` around `<Link>`

```tsx
// ❌ BAD — Button silently disappears from the DOM, no console error
<Button asChild><Link to="/listings">Xem tài sản</Link></Button>

// ✅ GOOD — navigate imperatively
const navigate = useNavigate();
<Button onClick={() => navigate("/listings")}>Xem tài sản</Button>
```

This is a repo-wide footgun (also in CLAUDE.md). `asChild`/`Slot` is fine for shadcn's own composition elsewhere; the specific trap is `Button` + `Link`.

---

## Status, Badges & Alerts (real conventions)

- **No generic `StatusBadge` component.** Render status with the shadcn `Badge` (`components/ui/badge.tsx`) — usually `variant="outline"` or `variant="secondary"` — plus a Vietnamese label. Common states:
  - KYC: `PENDING_KYC` → warning tone; `APPROVED` → success; `REJECTED` → destructive.
  - Unlock/access: unlocked → `text-success`; time-limited access nearing expiry → `text-warning`; locked → muted + `LockedBlur`.
- **Badge** variants: `default` (primary green), `secondary`, `destructive`, `outline`. Amber emphasis (credits/price) → add `className="bg-accent text-accent-foreground border-transparent"`.
- **Alert** (`components/ui/alert.tsx`) supports only `default` | `destructive`. For **warning/info** tones, override className with tokens (never hardcode hex):
  ```tsx
  // warning (e.g. "công ty đã được liên kết")
  <Alert className="border-warning/50 text-warning [&>svg]:text-warning">…</Alert>
  // info (primary green)
  <Alert className="border-primary/50 text-primary [&>svg]:text-primary">…</Alert>
  ```
- **Toasts:** `sonner` (`toast.success` / `toast.error`) for async mutation feedback; Vietnamese messages ("Đã mở khóa", "Thanh toán thành công").

---

## Paywall & Credit surfaces (domain-specific)

Reusable, token-driven components in `components/paywall/` — reuse, don't re-invent:

| Component | Role |
|---|---|
| `LockedBlur.tsx` | Blur + lock overlay over gated content (asset contact, owner info) |
| `CreditBalanceChip.tsx` | `rounded-full` chip showing credit balance (amber accent) |
| `AssetPaywallDialog` / `CompanyPaywallDialog` / `OwnerPaywallDialog` / `DeepReportPaywallDialog` | Credit-gated confirm dialogs; each its own component, driven by `PaywallContext` + `useCredits` |

Dialogs are `rounded-2xl`, show cost in credits with the amber accent, and the balance-after preview. Costs/tiers live in code (`lib/credits.ts` / `hooks/useCredits.tsx`) — never hardcode credit numbers in UI, read them from `useCredits` (`ASSET_COST`, `COMPANY_TIERS`, `OWNER_TIERS`, `CREDIT_PACKAGES`).

---

## Page Composition Patterns

### List pages (`/listings`, owner-portal lists)
1. **Page header** — title + subtitle + primary action (`<Button>` default/primary).
2. **Filters** — search + `Select`/popover filters (shadcn); keep filter state local or in URL.
3. **Grid/list** — listing cards (`rounded-2xl`, `shadow-md`).
4. **Empty state** — icon + title + description + suggested action; never a blank area or bare `null`.

### Detail pages (`/listings/:id`, `/auction-org/:id`, `/asset-owner/:id`)
1. **Hero / header** — title, badges, metadata, primary action.
2. **Tabs** (shadcn `Tabs`) for content sections — in the owner portal, styled via `OwnerTabsList`/`OwnerTabsTrigger` (see below).
3. **Gated blocks** wrapped in `LockedBlur` until unlocked; unlock CTA opens the matching paywall dialog.

### Wizard / multi-step flows (KYC `M2KYC`, asset-posting wizard)
- Left: step content in `rounded-2xl` section cards; right: sticky review/progress panel (`WizardProgress`, KYC `ReviewPanel`).
- Progress computed from a status helper (`sectionStatus.ts` for KYC); step state via RHF.
- Scrollable content area uses the `.wizard-content-area` class (thin overlay scrollbar) from `src/index.css`.

### Form pages
- RHF + Zod; split into `rounded-2xl` card sections (per CLAUDE.md forms pattern).
- `useNavigate()` for cancel/success — **not** `<Button asChild><Link>`.

---

## Owner portal — "Trạm Điều Hành" (`/chu-tai-san/*`)

The asset-owner portal follows its own design language: calm, few colours, numbers first, one answer per screen. The full spec is **§A8 of [`docs/owner-control-tower-plan.md`](../../docs/owner-control-tower-plan.md)**: L1→L4 hierarchy, type scale, colour meaning, lucide icons at stroke 1.5, layout, copy. The short version:

**Reuse the building blocks** in `src/components/asset-owner-portal/ui/`. Don't make one-off cards.

| Block | Use |
|---|---|
| `OwnerPageHeader` | Page title (`text-2xl font-semibold`) + one-line subtitle + at most one primary button |
| `SectionCard` | The only card: `rounded-2xl bg-card shadow-card`, **no border** (hairline back in print), icon tile + title + count + "Xem tất cả" |
| `HeroFigure` | L1 answer figure (`text-4xl tabular-nums`) + optional progress bar |
| `StatTile` | KPI tile (`text-2xl tabular-nums`, muted unit, one context line, corner badge slot) — grid of 4, 2×2 on mobile |
| `ActionCard` | To-do row with 1–3 inline buttons; the card itself is not clickable |
| `EmptyState` | Icon tile + positive short copy + one optional action; `compact` for inside cards |
| `IconTile` | Shared tinted icon square (`bg-<tone>/10 text-<tone>`, tones: primary/success/warning/destructive/muted) |
| `OwnerTabs` | THE tab style: underline + count chip (`attention` = amber count). `OwnerTabBar` for filter tabs; `OwnerTabsList` + `OwnerTabsTrigger` inside shadcn `Tabs` when there are panels |
| `OwnerSearchInput` | THE search box (search icon, h-9, `bg-card`; default `sm:w-64`, pass `className` for width) |
| `OwnerFilterSelect` | THE filter dropdown: muted label + bold value ("Kỳ", "Đơn vị", "Chi nhánh"), h-9 |
| `OwnerFilterBar` | Toolbar row: tabs left (full row below `xl`), search/filters right |

- **One style for tabs / search / filters (2026-09-27, user rule):** every `/chu-tai-san/*` screen uses the four components above — never shadcn `TabsList` styling, pill chips, `ToggleGroup` filters or a hand-rolled search. Tab counts ignore the search box. The hairline under the tabs is an inset `box-shadow`, not a border (`overflow-x-auto` clips a `-mb-px` underline); a list inside a card with its own full-bleed line passes `shadow-none`. Exceptions: view-mode switches (`AssetViewToggle`) and inputs inside dialogs/forms.
- **Surfaces:** the page is grey (`<main className="owner-canvas … bg-muted">` in `OwnerPortalLayout`); anything sitting directly on it is a white card with **no border + `shadow-card`** (`--shadow-card` in `index.css`). Blocks nested inside a card keep their `border` hairline. Shared components (asset-posting, consignment, sale-contracts…) are flattened by the scoped `.owner-canvas` rule in `index.css` — top-level `.bg-card.border` loses its border and gets the shadow, except semantic borders (`border-primary/success/warning/destructive`, dashed); page-level skeletons turn white. An `ActionCard` or other `bg-background`/`bg-muted` block placed directly on the page needs `border-0 bg-card shadow-card` itself (the rule only matches `bg-card`).
- **Form labels (2026-09-27, user rule):** every REQUIRED field — incl. preselected radios/selects, and the shared dialogs the portal opens (sale-contracts, consignment, service orders, `CreditsTab`) — gets `<span className="text-destructive">*</span>` after the label (wizard atoms: `req`). Required = the form blocks submit when empty (zod / `canSubmit` / server RPC); a conditional rule gets a conditional `*` (`{cond && <span className="text-destructive"> *</span>}`). Optional fields get **no hint — never "(tuỳ chọn)"**. "Tuỳ chọn" meaning something else stays (optional fee line in a quote / contract PDF, "Custom" date range). Tests query these labels by anchored regex (`/^Giá trúng \(₫\)/`) — the `*` is part of the label text.
- **Gói dịch vụ tier colours (2026-09-28, user-approved exception):** the "Goi Dich Vu" design's three plan tiers (light green / dark green / black-gold) use `--tier-*` tokens in `index.css`, consumed ONLY by the `.sub-*` classes at the end of `index.css` (`sub-tier-*`, `sub-card-*`, `sub-art`, `sub-btn-*`, `sub-cust`). Don't reuse them elsewhere. The term switch (3 / 6 / 12 tháng pill) is a picker, not a filter — like `AssetViewToggle`, it's exempt from `OwnerTabs`.
- **Status colour goes on the icon or a small badge**, never on the whole card. No `amber-*`/`orange-*`/`red-*` palette classes.
- **Money:** always `src/utils/money.ts`. `moneyShortParts` / `formatMoneyShort` for tiles and lists ("12.4 tỷ", "850 tr"), `formatMoneyFull` for tables and exports ("12,400,000,000 ₫"). Thousands are grouped with a comma and decimals use a dot, as in `formatVnd`. Never format money inline.
- **Nav:** `OWNER_NAV_GROUPS` in `components/owner-portal/owner-nav-config.ts`, grouped "Điều hành" / "Tác nghiệp" / "Phân tích" / "Thiết lập". Add a new item only once its route exists.
- **Charts (Phase 15a, `cash-flow/`):** Recharts with token colours only — totals `primary`, a rise `accent`, a fall `muted-foreground / 0.55`, overdue `warning`, estimates as a hatched `primary` pattern labelled "Ước tính". Never `accent` and `warning` in one chart (same hue family), never `success` beside `primary`. The brand amber/grey fail the dataviz lightness/chroma bands, so every bar carries a direct value label and the chart has an sr-only table (inside a `relative` box).

---

## Component Design Rules

1. **Tailwind tokens only** — `bg-primary`, `text-muted-foreground`, `bg-accent`, `text-success`, `border-warning`. Never hardcode hex/rgb; never add color values (CLAUDE.md hard rule).
2. **HSL vars** — colors defined as `H S% L%` (no `hsl()`) so opacity modifiers work.
3. **Cards `rounded-2xl`.** Inputs/buttons `rounded-md`. Chips/badges `rounded-full`.
4. **Do not edit `components/ui/`** shadcn primitives — wrap/compose in feature folders (`components/paywall/`, `components/owner-portal/`, `components/asset-posting/`, `components/company-onboarding/`).
5. **Reusable first** — extract shared patterns into the feature folder; pages stay < ~300 lines (orchestrate, don't inline all UI).
6. **Single responsibility** per component; each modal is its own component.
7. **Vietnamese UI strings** throughout — match existing tone (no i18n library).
8. **Dark mode** — every token has a `.dark` override; don't hardcode light-only colors that break in dark.
