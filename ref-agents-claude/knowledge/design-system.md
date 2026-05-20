# Design System — Tài Sản Đấu Giá

> Living document. Updated when design patterns are established or changed.

---

## Color Tokens

All colors are HSL CSS variables defined in `src/index.css`. **Never add new color values or change existing tokens.**

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `210 90% 30%` | Navy — CTAs, stepper active states, focus rings |
| `--primary-foreground` | `0 0% 100%` | Text on primary bg |
| `--accent` | `43 96% 56%` | Amber — highlights, badges, selection indicators |
| `--accent-foreground` | `24 9.8% 10%` | Text on accent bg |
| `--success` | `142 76% 36%` | Completed states, verified badges |
| `--warning` | `38 92% 50%` | Warnings (e.g., company already linked, KYC pending) |
| `--muted` | `215 27.9% 96.9%` | Subtle backgrounds |
| `--muted-foreground` | `215 16% 47%` | Secondary / helper text |
| `--background` | `0 0% 100%` | Page background |
| `--foreground` | `222.2 84% 4.9%` | Primary text |
| `--border` | `214.3 31.8% 91.4%` | Default borders |
| `--radius` | `0.5rem` | Input / button border-radius |

Use Tailwind utility classes that reference these tokens: `bg-primary`, `text-muted-foreground`, `border-border`, etc. Never use raw hex/HSL values in component files.

Cards use `rounded-2xl`.

---

## Typography

- **Font:** Default system sans-serif (no custom font loaded)
- **Heading hierarchy:** h1 (`text-2xl font-bold`) → h2 (`text-xl font-semibold`) → h3 (`text-lg font-medium`)
- **Body:** `text-base` (16px), `text-sm` (14px) for metadata
- **Muted text:** `text-muted-foreground text-sm`

---

## Button Pattern

### ⚠️ CRITICAL: Never use `asChild` with Link

```tsx
// ❌ BAD — Button disappears from DOM silently
<Button variant="outline" asChild>
  <Link to="/path">Label</Link>
</Button>

// ✅ GOOD — always
const navigate = useNavigate();
<Button variant="outline" onClick={() => navigate("/path")}>Label</Button>
```

### Standard Variants (shadcn defaults)

```tsx
<Button>Primary</Button>                     // default — navy fill
<Button variant="outline">Secondary</Button>  // outline
<Button variant="ghost">Tertiary</Button>     // ghost
<Button variant="destructive">Delete</Button> // red
```

Hierarchy: `default` (solid primary) > `outline` > `ghost`.

---

## Page Layout Patterns

### Marketplace Listing Page

```
<PageHeader />               ← title + search bar + filter chips
<ListingGrid />              ← responsive card grid (3 cols desktop, 1 col mobile)
<Pagination />
```

### Detail Pages (Auction / Listing / Company)

```
<HeroSection />              ← title, status badges, key metadata, main CTA
<InfoTabs />                 ← tabs: Overview / Price History / Analytics / ...
```

### Profile Page

```
<ProfileHeader />            ← avatar, name, credit balance
<Tabs>
  <CreditsTab />             ← balance, transaction history, buy credits CTA
  <SavedAssetsTab />         ← saved listing cards
  <InvoiceTab />             ← billing info form
</Tabs>
```

### KYC Onboarding Page (2-column)

```
<MilestoneProgress />        ← top stepper (M1 → M2 → M3)
<main class="grid grid-cols-[1fr_360px]">
  <FormSections />           ← 4 section cards (A/B/C/D)
  <ReviewPanel />            ← sticky sidebar showing completion status
</main>
```

---

## Component Conventions

### Cards

```tsx
<Card className="rounded-2xl">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Subtitle</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>...</CardFooter>
</Card>
```

### Status / State Badges

Use Tailwind directly with semantic colors — no shared StatusBadge component exists:

```tsx
// Active / verified
<span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">Đã xác minh</span>

// Pending
<span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full">Đang chờ</span>

// Archived / inactive
<span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Đã lưu trữ</span>
```

### Paywall Blur Pattern

When content requires a credit unlock, render it blurred with an overlay CTA:

```tsx
<div className="relative">
  <div className="blur-sm select-none pointer-events-none">
    {sensitiveContent}
  </div>
  <div className="absolute inset-0 flex items-center justify-center bg-white/60">
    <Button onClick={handleUnlock}>Mở khóa — {cost} tín dụng</Button>
  </div>
</div>
```

### Empty States

Always render an empty state — never return `null` for empty data:

```tsx
<div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
  <SomeIcon className="h-10 w-10 opacity-40" />
  <p className="text-sm">Chưa có dữ liệu</p>
  <Button variant="outline" onClick={...}>Thêm mới</Button>
</div>
```

### Loading States

Use skeletons for content that loads asynchronously:

```tsx
{isLoading ? (
  <div className="space-y-3">
    <Skeleton className="h-24 w-full rounded-2xl" />
    <Skeleton className="h-24 w-full rounded-2xl" />
  </div>
) : (
  <ListingGrid data={data} />
)}
```

---

## Responsive Breakpoints

- **Mobile:** < 768px — single column layouts, stacked navigation
- **Tablet:** 768px–1024px — 2-column grids
- **Desktop:** > 1024px — 3-column grids, sidebar layouts

The KYC 2-column layout collapses to single column on mobile.

---

## Icon Usage

All icons from `lucide-react`. Standard sizes:

- Inline text icon: `h-4 w-4`
- Button icon: `h-4 w-4`
- Hero/feature icon: `h-8 w-8` or `h-10 w-10`
- Empty state illustration icon: `h-10 w-10 opacity-40`
