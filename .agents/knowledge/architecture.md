# Architecture — Tài Sản Đấu Giá (taisandaugia)

> Living document. Updated when architecture patterns are established or changed.
> Referenced by: `cto`, `system-architect`, `data-analyst`, `qa-qc`, `kyc-expert`, `credits-paywall-expert`.
> Current-truth doc — reflects `src/App.tsx` + `CLAUDE.md` as of this writing. When routing/providers change, update here first.

---

## Project Overview

**Tài Sản Đấu Giá** — a Vietnamese real-estate **auction marketplace + broker/owner portal**. Anonymous visitors browse auction listings and market-report teasers; authenticated buyers spend **credits** to unlock asset/company/owner info; auction companies onboard via a **3-milestone KYC** flow; asset owners (chủ tài sản) run a separate portal and post assets via a wizard.

**Real backend.** Unlike a mock prototype, this app runs on a **live Supabase Postgres** (project `bcusbpkfnydqcvxxjvew`) with RLS, a typed client, and **~80 SQL migrations** under `supabase/migrations/`. Files in `src/lib/mock*.ts` are legacy seed/demo data only — **new features connect to Supabase directly**, never mock. UI copy is inline Vietnamese; no i18n library.

---

## Tech Stack

| Layer | Detail |
|-------|--------|
| Framework | React 18 + TypeScript + Vite (`@vitejs/plugin-react-swc`) |
| UI | shadcn-ui (Radix primitives) + Tailwind CSS |
| Server state | TanStack React Query v5 (single `QueryClient` in `App.tsx`) |
| Forms | React Hook Form + Zod (`zodResolver`) |
| Database | **Supabase (PostgreSQL)** — typed client, RLS, migrations. Project ID `bcusbpkfnydqcvxxjvew` |
| Maps | Leaflet + Mapbox GL |
| Charts | Recharts (market-report dashboards — **not** Excel) |
| PWA | `vite-plugin-pwa` — scope `/broker/`, start URL `/broker/dashboard` |
| Toasts | `sonner` + shadcn `toaster` (both mounted globally) |
| i18n | **None** — inline Vietnamese strings |
| Deploy | **Vercel** |
| Dev port | `8080` (`npm run dev`) |
| Package manager | **npm** |
| Path alias | `@/` → `src/` (in `vite.config.ts` + `tsconfig.json`) |

`components/ui/` holds standard shadcn primitives — **do not edit them directly**; wrap or compose instead.

---

## Directory Structure

```
src/
├── components/
│   ├── ui/                   # shadcn-ui primitives (do not edit)
│   ├── company-onboarding/   # 3-milestone KYC (M1AccountCreation, M2KYC+M2/, M3Deposit, MilestoneProgress)
│   ├── owner-portal/         # Asset-owner portal shell (OwnerPortalLayout, owner-nav-config.ts)
│   ├── portal/               # Auction-company portal shell (PortalLayout)
│   ├── admin/                # Admin portal shell (AdminLayout)
│   ├── asset-posting/        # Đăng tài sản wizard steps (see useAssetPosting.ts, types/asset-posting.ts)
│   ├── auction/              # AuctionDetail sub-components (+ analytics)
│   ├── listings/             # ListingDetail sub-components
│   ├── paywall/              # Credit-gated dialogs
│   ├── report/               # Market-report components (bds/, opp/, outcomes/)
│   ├── profile/              # ProfilePage sections & tabs
│   ├── auth/                 # AuthDialog (global modal)
│   ├── demand/ · onboarding/ # Demand tracking, general onboarding
│   ├── ProtectedRoute.tsx    # Auth gate (session required)
│   └── AdminRoute.tsx        # Admin gate (currently pass-through Outlet)
├── pages/                    # Route page components (see Routing below)
├── hooks/                    # useCredits, useProfile, useAssetPosting, useAuth (via context), etc.
├── lib/                      # credits.ts, orgMatching.ts (+ .test.ts), report periods, mock* (legacy)
├── contexts/                 # AuthContext, AuthDialogContext, PaywallContext
├── integrations/supabase/    # client.ts (typed) + types.ts (generated — do not edit)
├── types/                    # asset-posting.ts, domain types
├── constants/                # category slugs, Vietnam locations, asset-delta-fields.ts
└── utils/                    # formatters
```

---

## Routing

All routes in `src/App.tsx` under one `<BrowserRouter>`. Critical-path pages (`Index`, `Auth`, `Listings`, `ListingDetail`, `AuctionDetail`, `NotFound`) are **eager**; everything else is `lazy()` behind a `<Suspense>` fallback. Full map:

```
# Public marketplace
/                          Index (homepage: auctions + tin tức + market report)
/listings                  Listings (search & filter grid)
/listings/:id              ListingDetail
/auctions/:id              AuctionDetail (with analytics)
/report                    MarketReport (Recharts dashboard)
/report/:slug              MarketReportCategory
/report/deep/outcomes      MarketReportOutcomes
/install                   PWAInstall
/lien-he                   Contact
/gioi-thieu                About
/chinh-sach-bao-mat        PrivacyPolicy
/dieu-khoan-su-dung        TermsOfUse
/dang-ky-to-chuc           CompanyOnboarding (auction-company KYC, 3 milestones)
/tro-thanh-chu-tai-san     AssetOwnerOnboarding (asset-owner KYC)
/tin-tuc                   TinTucPage (news/CMS)
/tin-tuc/:slug             ArticleDetail

# Credits / payment
/buy-credits               BuyCredits
/payment/vnpay             VnpayCheckout
/payment-result            PaymentResult

# Auth
/auth                      Auth

# Redirects (legacy → portal)
/ho-so-du-tuyen[...]       → /portal/ho-so-du-tuyen[...]
/saved-assets              → /profile?tab=saved

# Protected: buyer profile  (ProtectedRoute — session required)
/profile                   ProfilePage

# Protected: Asset-owner portal  (ProtectedRoute → OwnerPortalLayout sidebar)
/chu-tai-san               → /chu-tai-san/dashboard
/chu-tai-san/dashboard     OwnerDashboard
/chu-tai-san/tai-san       OwnerAssetsPage
/chu-tai-san/dang-tai-san  AssetPostingWizardPage  (5-step "Số hoá tài sản" wizard)
/chu-tai-san/chi-nhanh-amc OwnerBranchesPage
/chu-tai-san/bao-cao       OwnerReportPage

# Protected: Auction-company portal  (ProtectedRoute → PortalLayout sidebar)
/portal                       → /portal/dashboard
/portal/dashboard             DashboardPage
/portal/nang-luc/thong-tin-chung   ThongTinChungPage   ┐
/portal/nang-luc/dau-gia-vien      DauGiaVienPage      │ Hồ sơ năng lực
/portal/nang-luc/co-so-vat-chat    CoSoVatChatPage     │
/portal/nang-luc/lich-su-dau-gia   LichSuDauGiaPage    │
/portal/nang-luc/tai-chinh         TaiChinhPage        ┘
/portal/ho-so-du-tuyen             ApplicationsPage
/portal/ho-so-du-tuyen/new         ApplicationEditPage
/portal/ho-so-du-tuyen/:id         ApplicationEditPage
/portal/credits                    PortalCreditsPage

# Public company / protected owner detail
/auction-org/:id           CompanyDetail  (public)
/asset-owner/:id           AssetOwnerDetail  (ProtectedRoute)

# Admin portal  (AdminRoute → AdminLayout)
/admin                     AdminDashboard
/admin/kyc                 AdminKYCPage
/admin/kyc/:id             AdminKYCDetail
/admin/collaboration       AdminCollaborationPage
/admin/chu-tai-san         AdminAssetOwnerKYCPage
/admin/chu-tai-san/:type/:id  AdminAssetOwnerKYCDetail
/admin/contacts            AdminContactsPage
/admin/tin-tuc             AdminArticlesPage
/admin/tin-tuc/new         AdminArticleEditor
/admin/tin-tuc/danh-muc    AdminCategoriesPage
/admin/tin-tuc/:id         AdminArticleEditor
/admin/marketing/email          AdminCampaignsPage   (Email Marketing list)
/admin/marketing/email/new      AdminCampaignEditor  (create; single useForm + audience builder + review sidebar)
/admin/marketing/email/:id      AdminCampaignDetail  (?tab=stats|content|distribution)
/admin/marketing/email/:id/edit AdminCampaignEditor  (edit; drafts only)

*                          NotFound
```

> Scaffold new routes with the **`/new-page`** skill so the lazy-import + `<Route>` + nav entry stay consistent.

---

## Context Provider Order (App.tsx) — **do not reorder**

```
QueryClientProvider
└─ AuthProvider                    # single auth source (session + user)
   └─ TooltipProvider
      └─ AuthDialogProvider
         ├─ Toaster / Sonner / AuthDialog   # global singletons
         └─ BrowserRouter                    # future flags v7_startTransition, v7_relativeSplatPath
            └─ PaywallProvider               # MUST be inside Router — uses useNavigate()
               └─ Suspense → Routes
```

- `PaywallProvider` must stay **inside** `BrowserRouter` (it calls `useNavigate`). Moving it out throws at mount.
- `AuthDialog` is a single global instance driven by `AuthDialogContext` — do not render per-page copies.

---

## Auth

Auth is **real Supabase auth**, centralized so the whole app shares one subscription.

- `src/contexts/AuthContext.tsx` — `AuthProvider` owns the single `supabase.auth.onAuthStateChange` subscription and exposes **`useAuth()` → `{ session, user, loading }`**. Do **not** add new `getSession`/`onAuthStateChange` subscriptions in components — consume `useAuth()`. (This dedup replaced ~7 duplicate subscriptions.)
- `src/hooks/useProfile.ts` — `useProfile(userId)` fetches the `profiles` row (React Query). Use it instead of ad-hoc `profiles` fetches.
- `src/components/ProtectedRoute.tsx` — gate: shows a spinner while `loading`, redirects to `/auth` (preserving `location` in `state.from`) when no `session`, else renders `<Outlet/>`.
- `src/components/AdminRoute.tsx` — currently a **pass-through `<Outlet/>`** (admin gating is a known TODO; do not assume it enforces anything yet).
- `src/components/auth/AuthDialog.tsx` — multi-step global modal (identifier → email/phone → OTP/password → activation); handles both login and registration. Trigger from anywhere via `useAuthDialog().openAuthDialog(onSuccess?)`.

---

## Data Layer — Supabase (real database)

**Typed client** — `src/integrations/supabase/client.ts` (auto-generated header; `persistSession` + `autoRefreshToken`, `storage: localStorage`). Always import the single client:

```ts
import { supabase } from "@/integrations/supabase/client";
const { data, error } = await supabase.from("auction_organizations").select("*").order("name");
```

There is **no versioned client**. Types live in `src/integrations/supabase/types.ts` — **generated, never hand-edit**; regenerate after any schema change:

```bash
npx supabase gen types typescript --project-id bcusbpkfnydqcvxxjvew > src/integrations/supabase/types.ts
```

**Migrations** — `supabase/migrations/*.sql` (~80 files, timestamp-prefixed). Apply with `npx supabase db push` (`--include-all` for out-of-order). `system-architect` may and should propose new schema/migrations/RLS; scaffold with the **`/migration`** skill. **Run migrations yourself via the CLI — never ask the user to run them.**

### Key tables

| Table | Purpose |
|-------|---------|
| `profiles` | Auth-linked user rows; `invoice_info JSONB` billing |
| `auction_organizations` | Auction-company registry (name, tax_code, province, phone, logo_url, org_type) |
| `organizations` | KYC onboarding records (`kyc_status`, linked user) |
| `organization_roles` | Built-in Owner / Manager / Agent |
| `user_credits` | Per-user balance (PK = user_id) |
| `credit_transactions` | Append-only ledger of every credit change |
| `user_asset_unlocks` | **Permanent** asset unlocks |
| `user_company_unlocks` | **Time-limited** company access (tier + expires_at) |
| `user_owner_unlocks` | **Time-limited** owner access (tier + expires_at) |
| `user_report_unlocks` | Permanent deep-report unlocks (key = `{slug}:{periodId}`) |
| `listing_price_sessions` | Price-session history per listing |
| `asset_postings` | Owner asset-posting wizard submissions (migration `20260621000001`) |

### RLS convention

Every credit/unlock table has one **`"own rows"`** policy: `USING (auth.uid() = user_id)`. Never expose credit/unlock data cross-user. New per-user tables follow the same pattern.

**Admin back-office tables** are the deliberate exception: `marketing_campaigns` + `campaign_recipients` use one **`admin_all`** policy `USING (public.has_role(auth.uid(),'ADMIN'::app_role))` (not `own rows`) because the data is platform-owned, not user-owned. When an admin feature must read across other users' RLS-protected tables (e.g. `user_credits` for credit-balance targeting), do it through a **`SECURITY DEFINER` RPC that guards with `has_role(...ADMIN)` and `RAISE`s otherwise** (see `resolve_campaign_audience` / `count_campaign_audience` in `20260711000001_marketing_campaigns.sql`) — never widen the underlying tables' policies. `GRANT EXECUTE ... TO authenticated`; the internal `has_role` check is the real boundary.

### Email Marketing (admin)
`/admin/marketing/email/*` — greenfield campaign feature. `useCampaigns.ts` mirrors `useArticles.ts` (array queryKeys `["marketing_campaigns"]`/`["marketing_campaign",id]`/`["campaign_recipients",id]`, mutations invalidate + toast; uses `(supabase as any)` because `types.ts` isn't regenerated yet — **all 4 marketing migrations ARE pushed** to live project `dvdpfjprncvkhfwcvqmp`, regen just needs a personal access token). Audience = a mode-gated jsonb `audience_spec` (criteria ∪ import ∪ specific), resolved server-side by the RPCs above, **always filtered by `notifications_enabled` opt-in**. **Send is stubbed** (`useSendCampaign`: resolve → snapshot `campaign_recipients` → transition status); a future `supabase/functions/send-campaign` edge function consumes the snapshot. Lifecycle `draft→scheduled→sending→sent`, `ended` = manual archive; only `draft` is editable.

**"Danh sách cụ thể" surfaces opt-in early, client-side (mirror of the RPC filter):** don't let admins add recipients who'd be silently dropped at send. opt-out = `profiles.notifications_enabled !== true` (NOT NULL, default `false` → many users legitimately show "Không thể thêm"). Search tab (`AddRecipientsDialog`) selects `notifications_enabled` and disables opt-out rows; import tab classifies rows via pure `src/lib/marketing/importClassify.ts` (parse keeps row numbers → sai định dạng / trùng / chưa cho phép / hợp lệ), looks up opt-out by batching `profiles` `.in("email", chunk)` (200/chunk), shows one merged per-row issue list + `.xlsx` download (`audience/ImportReport.tsx`), and only commits `valid`. `AudienceSection` owns the single count header (no duplicate title) + import toast; `SelectedRecipientsTable` is title-less (search/clear-all only when >10 rows). Any NEW add path must apply the same opt-out gate.

**Audience preview count = số THỰC NHẬN, via one shared headline helper.** `useAudiencePreview` calls `count_campaign_audience(spec, respect_optin=true)` → the number shown IS the deliverable (matched ∩ opted-in), same as what send resolves. All preview surfaces MUST render through `audiencePreviewHeadline(spec, {count,isFetching,isError})` (`src/lib/marketing/audienceCriteria.ts`), never raw `count ?? 0`: it gates on `hasAnyAudience` (`empty` → "Chưa cấu hình đối tượng", not a fake "0"), distinguishes `error` ("Không tính được…") from a real 0, and phrases per kind (`list` adds "trong N đã chọn"). Consumers: `CampaignReviewPanel` (takes `spec`+`isError`) and `AudienceSummary`; the `list` header in `AudienceSection` also surfaces `isError`. Because `notifications_enabled` defaults `false`, the count is 0 until users opt in — seed sample `20260712000001_seed_optin_sample.sql` flips ~1/3 of profiles `true` (idempotent, md5-order) for realistic previews; **default stays `false`**.

---

## Credits / Paywall

- `src/lib/credits.ts` — pure credit logic (costs, tiers, package math, `expandUnlock`).
- `src/hooks/useCredits.tsx` — **single access point** for all credit operations in components. Reads via React Query key `["user-credits", userId]`; every mutation calls `invalidate()` on that key. Exposes `balance`, `transactions`, `assetUnlocked(id)`, `companyAccess(orgId)`, `ownerAccess(ownerId)`, `isReportPeriodUnlocked`, `unlockAsset`, `unlockCompany`, `unlockOwner`, `unlockDeepReportPeriod`, `addCredits`, and the cost/tier/package constants.
- `src/contexts/PaywallContext.tsx` — `PaywallProvider` / `usePaywall()` drive credit-gated dialogs; lives inside Router.

**Behavior:** `unlockAsset` is **permanent** (`user_asset_unlocks`); `unlockCompany`/`unlockOwner` are **time-limited and stack** (new purchase extends from current expiry); `unlockDeepReportPeriod` key is `"{slug}:{periodId}"` and buying a year unlocks its quarters/months via `expandUnlock()`. See `credits-paywall-expert` for tiers/costs. Scaffold new unlock types with the **`/add-unlock`** skill.

---

## Portal Navigation Configs

- **Asset-owner portal** — `src/components/owner-portal/owner-nav-config.ts` exports `OWNER_NAV_SECTIONS` (Tổng quan, Tài sản, **Số hoá tài sản**, Chi nhánh, Báo cáo) consumed by `OwnerPortalLayout`. Nav labels differ from route slugs (e.g. label "Số hoá tài sản" → `/chu-tai-san/dang-tai-san`) — keep the config as the single source when adding owner-portal pages.
- **Auction-company portal** — `PortalLayout` renders the `/portal/*` sidebar (Dashboard, Hồ sơ năng lực group, Hồ sơ dự tuyển, Credit).
- **Admin portal** — `AdminLayout` renders the `/admin/*` sidebar.

---

## Key Patterns

### React Query
- `queryKey`: `["entity"]` for lists, `["entity", id]` for single. Credit state uses `["user-credits", userId]`.
- Mutations write to Supabase, then `queryClient.invalidateQueries({ queryKey })` + a `sonner` toast (`toast.success("Thành công")`). Scaffold reads with the **`/add-query`** skill.
- `QueryClient` defaults (in `App.tsx`): `staleTime: 60_000`, `gcTime: 5min`, `retry: 1`, `refetchOnWindowFocus: false`.

### Forms
- Zod schema → `useForm({ resolver: zodResolver(schema) })`. KYC/asset-posting wizards keep step state in dedicated hooks (`useAssetPosting.ts`) or the form, not scattered local state.

### Button navigation — **pitfall**
Never use `asChild` with `<Link>` inside `<Button>` — the button vanishes from the DOM silently. Use `const navigate = useNavigate()` + `onClick={() => navigate("/path")}`.

### Design tokens
All colors are HSL CSS vars in `src/index.css` — `--primary` (navy `210 90% 30%`), `--accent` (amber), `--success`, `--warning`, `--muted-foreground`, `--radius` (`0.5rem`). Cards use `rounded-2xl`. **Never add new color values or edit tokens**; map every Tailwind class to a token (`bg-primary`, `text-muted-foreground`, …).

---

## Environment & Build

```
VITE_SUPABASE_URL=<supabase_url>
VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key>
VITE_SUPABASE_PROJECT_ID=<project_ref>
```

```bash
npm run dev      # localhost:8080
npm run build    # production build
npm run lint     # ESLint
npm run preview  # preview build
```

`npm run lint` + `npm run build` are the **Phase-4 gate** — both must pass before a change is complete.

---

## Testing

- Tests are **co-located** (`src/lib/orgMatching.ts` → `src/lib/orgMatching.test.ts`). Pure-logic modules (credits math, org matching) test the function directly with no React/Query wrappers.
- No central test dir; keep the `*.test.ts` next to its source.
