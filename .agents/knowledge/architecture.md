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
/chu-tai-san/dang-tai-san  AssetPostingWizardPage  (5-step "Số hoá tài sản" wizard: Loại→Thông tin→Pháp lý→Nhu cầu→Xem lại; bước cuối 2 hành động: chỉ số hoá / số hoá & gửi tổ chức. Chọn tổ chức tách ra ChooseOrgAndRequest)
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
/portal/nang-luc/dau-gia-vien/:id  DauGiaVienDetailPage  (hồ sơ số hoá một người)
/portal/nang-luc/tu-tai-lieu       TuTaiLieuPage         (có route, KHÔNG có mục nav)
/portal/nhan-su                    HoSoNhanSuPage        (mục cấp cao; gate module 'nhan-su')
/portal/boi-duong                  BoiDuongPage          (mục cấp cao; gate module 'boi-duong')
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
/admin/marketing/quang-cao          AdminAdsPage         (Quảng cáo / banner list)
/admin/marketing/quang-cao/vi-tri   AdminAdPositionsPage (master data: trang + vị trí)
/admin/marketing/quang-cao/new      AdminAdEditor        (create; ?from=:id = copy)
/admin/marketing/quang-cao/:id      AdminAdDetail        (?tab=stats|content)
/admin/marketing/quang-cao/:id/edit AdminAdEditor        (edit; draft + scheduled)
/admin/nguoi-dung               AdminUsersPage       (Quản lý người dùng: list + stats + filters)
/admin/nguoi-dung/:id           AdminUserDetail      (hồ sơ + số dư + giao dịch + tặng/khóa/reset)
/admin/khach-hang               AdminCustomersPage   (khách hàng dùng chung; chi tiết KH có card "Đơn hàng / Dịch vụ đã mua")
/admin/khach-hang/:id           AdminCustomerDetail  (info + banner liên kết + đơn hàng)
/admin/dich-vu                  AdminServicesPage    (Dịch vụ: danh mục kind credit|direct; RBAC module dich-vu)
/admin/don-hang                 AdminOrdersPage      (Đơn hàng dịch vụ direct; RBAC module don-hang)
/admin/bao-cao                  → redirect /admin/bao-cao/giao-dich
/admin/bao-cao/doanh-thu        RevenueReportPage    ("Doanh thu": credit nạp + đơn direct; by-audience + top-variant + growth; RBAC doanh-thu)
/admin/bao-cao/giao-dich        TransactionReportPage (Giao dịch credit: doanh thu credit + tiêu dùng)
/admin/bao-cao/boi-duong        CpdReportPage        ("Bồi dưỡng chuyên môn": tuân thủ toàn sàn; RBAC boi-duong)
/admin/quan-tri/boi-duong       CpdCatalogPage       ("Bồi dưỡng ĐGV": DANH MỤC cách tính; RBAC dm-boi-duong)

*                          NotFound
```

> **Hai mục "bồi dưỡng" là hai việc khác nhau, đừng gộp:** `bao-cao/boi-duong` là BÁO CÁO tuân thủ (module `boi-duong`), `quan-tri/boi-duong` là DANH MỤC định nghĩa cách tính (module `dm-boi-duong`). Mã module cố ý khác nhau.

> **Danh mục bồi dưỡng = master data, đọc mở / ghi ADMIN** (`20260806000040`). `cpd_activity_types` · `cpd_activity_roles` · `cpd_exemption_reasons`, RLS `SELECT USING (true)` + `admin_all`. Đọc **KHÔNG lọc `is_active`** — cố ý khác pattern `services` (`USING (is_active = true)`): ở đây danh mục còn là TỪ ĐIỂN NHÃN cho dữ liệu lịch sử, lọc dòng đã tắt sẽ làm bản ghi cũ mất tên hình thức trên hồ sơ đã in. Lọc ở ĐIỂM CHỌN (`selectableTypes/Roles/Reasons` trong `lib/personnel/cpd-catalog.ts`). FK từ `org_auctioneer_events` là **ON DELETE RESTRICT** — muốn gỡ khỏi ô chọn thì tắt `is_active`, không xoá; hook dịch lỗi `23503` sang câu tiếng Việt chỉ đúng lối đi đó. Query key duy nhất `qk.cpdCatalog`, đọc qua `useCpdCatalog()`, ghi qua `useCpdCatalogAdmin()`.

> `AdminLayout` NAV = mảng `NavSection[]` (khối có `title` in hoa + `items: NavItem[]` link phẳng), KHÔNG còn submenu collapsible. Section marketing đổi tên hiển thị **"Sale & Marketing"** (category CODE vẫn `marketing`) — gồm Email, Quảng cáo, **Dịch vụ, Đơn hàng**, Khách hàng. Báo cáo gồm **Doanh thu tổng, Giao dịch credit**, Phân tích truy cập. RBAC module code mới `dich-vu`/`don-hang`/`doanh-thu` khai báo trong `MODULE_DEFINITIONS` (`adminPermissions.ts`) — code-only, không migration.

> **Edge functions** (`supabase/functions/`): scraping proxies (`crawl-auctioneers`, `fetch-announcement`) + **`admin-user-actions`** — privileged GoTrue admin ops (create user via `inviteUserByEmail`, lock/unlock via `ban_duration`) that need `service_role` and can't run client-side or as a DB function. It builds a service-role client from `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` (auto-injected), **verifies the caller is ADMIN** (Bearer JWT → `user_roles`), then dispatches on `body.action`. Call from the client with `supabase.functions.invoke(...)`; deploy with `npx supabase functions deploy <name> --project-ref dvdpfjprncvkhfwcvqmp`. Email invite/reset needs SMTP configured in Supabase Auth. This is the pattern for any future privileged-auth admin action.

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
| `org_roles` / `org_role_permissions` | Per-org RBAC. Replaced the dropped global `organization_roles` |
| `organization_memberships` | User ↔ org + `role_id` (the row IS the role assignment) + `PENDING_INVITE` |
| `user_credits` | Per-user balance (PK = user_id) |
| `credit_transactions` | Append-only ledger of every credit change |
| `user_asset_unlocks` | **Permanent** asset unlocks |
| `user_company_unlocks` | **Time-limited** company access (tier + expires_at) |
| `user_owner_unlocks` | **Time-limited** owner access (tier + expires_at) |
| `user_report_unlocks` | Permanent deep-report unlocks (key = `{slug}:{periodId}`) |
| `listing_price_sessions` | Price-session history per listing |
| `asset_postings` | Owner asset-posting wizard submissions (migration `20260621000001`). Status: `draft`→`active` ("đã số hoá") — số hoá KHÔNG cần tổ chức; +`active` via `20260726000005`. Chọn/gửi tổ chức = luồng RIÊNG qua `asset_service_requests` (hook `useSendServiceRequest`), không đổi status. Digitize via `useCreatePosting({status})`. |
| `ad_pages` / `ad_positions` | Master data quảng cáo 2 cấp: trang → vị trí (`placement_type` slide/unique, `price NUMERIC`) |
| `advertisements` | Banner (admin-only); `code` "B0000009" qua trigger; lifecycle draft/scheduled/active/paused/ended |
| `ad_daily_stats` | Số liệu view/click theo (ngày, device) — hiện là seed demo |
| `customers` | Khách hàng dùng chung nhiều dịch vụ (`code` "KH…"); banner FK `customer_id` |
| `services` | NHÓM dịch vụ (`code` "DV…"); `kind` credit\|direct + `audience` buyer\|owner\|company\|all + `category`; **public-read (is_active) + admin-all** RLS |
| `service_variants` | BIẾN THỂ (con của services, `code` "BV…"); `variant_key` UNIQUE + `price`(gói)/`credit_cost`(tier-feature) + `base_credits`/`credits` + popular/best. **NGUỒN GIÁ runtime** (đọc qua `useServiceCatalog`/`serviceCatalog.getVariantCost`); public-read + admin-all RLS |
| `orders` | Đơn hàng dịch vụ direct (admin-only; `code` "DH…"); FK `customer_id`/`service_id` (RESTRICT) + `advertisement_id` (SET NULL); `fulfillment_status` pending\|fulfilled\|cancelled; tự fulfilled qua trigger khi banner active |

### RLS convention

Every credit/unlock table has one **`"own rows"`** policy: `USING (auth.uid() = user_id)`. Never expose credit/unlock data cross-user. New per-user tables follow the same pattern.

**Admin back-office tables** are the deliberate exception: `marketing_campaigns` + `campaign_recipients` use one **`admin_all`** policy `USING (public.has_role(auth.uid(),'ADMIN'::app_role))` (not `own rows`) because the data is platform-owned, not user-owned. When an admin feature must read across other users' RLS-protected tables (e.g. `user_credits` for credit-balance targeting), do it through a **`SECURITY DEFINER` RPC that guards with `has_role(...ADMIN)` and `RAISE`s otherwise** (see `resolve_campaign_audience` / `count_campaign_audience` in `20260711000001_marketing_campaigns.sql`) — never widen the underlying tables' policies. `GRANT EXECUTE ... TO authenticated`; the internal `has_role` check is the real boundary.

### Admin RBAC — "Quản trị" module (`/admin/quan-tri/*`)
Granular per-module admin permissions layered ON TOP of the binary `user_roles.ADMIN` gate (which still gates `/admin`). Do NOT confuse with `organization_roles` (auction-company RBAC) — these are prefixed `admin_`. Tables (`20260713000010_admin_rbac.sql`): `admin_roles` (name/`code` unique/`is_system`), `admin_role_permissions(role_id,module,action)`, `admin_role_assignments(user_id,role_id)`. **Permission catalog lives in code** — `src/lib/adminPermissions.ts` (modules grouped by nav category × actions `view/create/update/delete/approve/export`); DB stores only granted `(module,action)` rows. Effective perms = union across assigned roles, OR all-allowed if assigned the seeded `SUPER_ADMIN` `is_system` role (short-circuit by `code`). **New SECURITY-DEFINER helpers mirroring `has_role`**: `admin_has_permission(_module,_action)` + `admin_is_super_admin(_uid)` — use these in RLS/RPC for anything gated by a specific admin permission. RLS on the 3 tables: SELECT open to any ADMIN; writes gated `admin_has_permission('vai-tro',*)` (roles/perms) or `('tai-khoan','update')` (assignments); matrix replaced atomically via RPC `admin_set_role_permissions(role_id,jsonb)`; trigger `admin_roles_protect_system` blocks deleting/renaming `is_system` roles. **Frontend**: `useAdminPermissions()` (→ `{isSuperAdmin,matrix,ready}`), `useHasAdminPermission(module,action)`, and route guard `AdminPermissionRoute` (`src/components/admin/`); `AdminLayout` NAV items carry a `module` and are filtered by `view` perm. **Scope caveat:** enforcement is currently **UI + new-tables-RLS only** — the EXISTING admin modules still use the coarse ADMIN gate at the DB level; per-module DB enforcement is a follow-up. "Xóa" an admin = revoke (`useRevokeAdmin`: delete assignments + `user_roles` ADMIN), keeping the login.

### Org RBAC — portal tổ chức (`/portal/to-chuc/*`)
Per-organization RBAC, mirroring admin RBAC but with one deliberate divergence: **there is no assignment table**. `organization_memberships` already carries `role_id NOT NULL` + `UNIQUE(user_id, organization_id)`, so the membership row *is* the assignment; a third table would be a second, conflicting source of truth. Tables (`20260805000020_org_rbac.sql`): `org_roles(organization_id, name, code, is_system, UNIQUE(organization_id, code))` and `org_role_permissions(role_id, module, action)`. The legacy global `organization_roles` + `has_org_role()` were dropped in `20260805000022`.
**Helpers** (SECURITY DEFINER, mirroring `admin_has_permission`): `org_has_permission(_org_id,_module,_action)` and `org_is_owner(_org_id)` — use these in every RLS policy / RPC, never a role-name string match. Both read memberships without RLS so they don't recurse when used in those tables' own policies (same trick as `is_org_member`).
**Catalog in code**: `src/lib/orgPermissions.ts`. Module `tin-dang` has **no nav entry** — it exists solely to back the rewritten `listings` UPDATE/DELETE policies (`hiddenFromNav: true`).
**Invite RPCs** (`20260805000021`, token fixed in `...23`): `org_check_invite_email` (returns 5 booleans only — not an email-enumeration oracle), `create_org_invite`, `get_org_invite_preview` (granted to **anon** — the accept page renders before login), `accept_org_invite`, `revoke_org_invite`, `rotate_org_invite`. Tokens come from `org_new_invite_token()` which uses `gen_random_uuid()` — **not `gen_random_bytes()`**, see common-pitfalls.
**Frontend**: `useMyOrganizations()` (query hook, usable anywhere — `["my-orgs", userId]`) is split from `OrgContext` (selection state). `OrgProvider` mounts inside **`PortalLayout`, not `App.tsx`**, so the documented provider order stays untouched. `useOrgPermissions(orgId)` → `{isOwner, matrix, ready}` (fail-closed); guard `PortalPermissionRoute`; `PortalNoOrgGate` requires ≥1 ACTIVE membership to enter `/portal`. Nav items in `nav-config.ts` carry `module` and are filtered by `view` — a section whose children are all filtered out is itself removed (admin doesn't need this rule).
`PermissionMatrixEditor` was generalized to `src/components/permissions/` and takes its catalog via props; the admin and org versions are thin adapters.
**Scope caveat:** `nl-*` and `ho-so-du-tuyen` permissions are **UI-only** — that data still lives in localStorage, so there is nothing to enforce against. Only `thanh-vien`, `vai-tro`, `tin-dang` are RLS-backed.

### Email Marketing (admin)
`/admin/marketing/email/*` — greenfield campaign feature. `useCampaigns.ts` mirrors `useArticles.ts` (array queryKeys `["marketing_campaigns"]`/`["marketing_campaign",id]`/`["campaign_recipients",id]`, mutations invalidate + toast; uses `(supabase as any)` because `types.ts` isn't regenerated yet — **all 4 marketing migrations ARE pushed** to live project `dvdpfjprncvkhfwcvqmp`, regen just needs a personal access token). Audience = a mode-gated jsonb `audience_spec` (criteria ∪ import ∪ specific), resolved server-side by the RPCs above; account rows are **filtered by `notifications_enabled` opt-in**, but import emails that match **no** profile are emitted as **external recipients (`user_id=NULL`) and ALWAYS sent** (opt-in can't apply — no account), so `count_campaign_audience` and the send snapshot include them (`20260712000007_campaign_audience_external_emails.sql`). **Send is stubbed** (`useSendCampaign`: resolve → snapshot `campaign_recipients` → transition status); a future `supabase/functions/send-campaign` edge function consumes the snapshot. Lifecycle `draft→scheduled→sending→sent`, `ended` = manual archive; only `draft` is editable.

**"Danh sách cụ thể" surfaces opt-in early, client-side (mirror of the RPC filter):** don't let admins add recipients who'd be silently dropped at send. opt-out = `profiles.notifications_enabled !== true` (NOT NULL, default `false` → many users legitimately show "Không thể thêm"). Search tab (`AddRecipientsDialog`) selects `notifications_enabled` and disables opt-out rows; import tab classifies rows via pure `src/lib/marketing/importClassify.ts` (parse keeps row numbers → sai định dạng / trùng / chưa cho phép / hợp lệ), looks up opt-out by batching `profiles` `.in("email", chunk)` (200/chunk), shows one merged per-row issue list + `.xlsx` download (`audience/ImportReport.tsx`), and only commits `valid`. `AudienceSection` owns the single count header (no duplicate title) + import toast; `SelectedRecipientsTable` is title-less (search/clear-all only when >10 rows). Any NEW add path must apply the same opt-out gate. **External emails (no account) are allowed & deliverable** — `useEmailAccountStatus(spec.emails)` (mirror of `useUserLabels`; batched `profiles.in("email",chunk)`, lowercase) tags which imported emails lack a profile, and `SelectedRecipientsTable` shows a **"Chưa có tài khoản"** badge (`RecipientItem.noAccount`) on those rows; badge only renders once the lookup resolves (undefined = still checking).

**Audience preview count = số THỰC NHẬN, via one shared headline helper.** `useAudiencePreview` calls `count_campaign_audience(spec, respect_optin=true)` → the number shown IS the deliverable (matched ∩ opted-in), same as what send resolves. All preview surfaces MUST render through `audiencePreviewHeadline(spec, {count,isFetching,isError})` (`src/lib/marketing/audienceCriteria.ts`), never raw `count ?? 0`: it gates on `hasAnyAudience` (`empty` → "Chưa cấu hình đối tượng", not a fake "0"), distinguishes `error` ("Không tính được…") from a real 0, and phrases per kind (`list` adds "trong N đã chọn"). Consumers: `CampaignReviewPanel` (takes `spec`+`isError`) and `AudienceSummary`; the `list` header in `AudienceSection` also surfaces `isError`. Because `notifications_enabled` defaults `false`, the count is 0 until users opt in — seed sample `20260712000001_seed_optin_sample.sql` flips ~1/3 of profiles `true` (idempotent, md5-order) for realistic previews; **default stays `false`**.

### Quảng cáo / Advertising (admin)
`/admin/marketing/quang-cao/*` — banner CRUD tham khảo Email Marketing (list/editor/detail 2 tab Thống kê+Nội dung), **KHÔNG có phần audience/đối tượng**. Migrations `20260712000002_advertising.sql` (5 bảng, admin-only RLS) + `_003_ad_banners_bucket.sql` (bucket `ad-banners`, public read / admin write, 10MB) + `_004_seed_advertising.sql` (demo). Hooks: `useAdvertisements.ts` (queryKeys `["advertisements"]`/`["advertisement",id]`/`["ad_daily_stats",id,days,device]`), `useAdMasterData.ts` (`ad_pages`/`ad_positions`), `useCustomers.ts`; đều dùng `(supabase as any)` theo convention. Types tay ở `src/types/advertising.ts`; status/section lib ở `src/lib/advertising/adStatus.ts` (chỉ `draft`+`scheduled` sửa được — khác Email chỉ `draft`). Form dùng controlled `AdFormState` (`src/lib/advertising/adForm.ts`), không RHF. Stats tab = Recharts `ComposedChart` (bar views + line clicks + line CTR), đọc `ad_daily_stats` gộp theo ngày.

**INVARIANT — vị trí `unique` chỉ 1 banner/khoảng thời gian.** Trigger `enforce_unique_ad_position` (BEFORE INSERT/UPDATE trên `advertisements`) chặn khi `NEW.status IN ('scheduled','active')` + vị trí unique + `tstzrange(start,end) &&` với banner khác scheduled/active cùng vị trí → `RAISE EXCEPTION 'Vị trí duy nhất…'`. UI bắt lỗi qua `isUniquePositionError` (khớp message) và cũng cảnh báo trước khi lưu. Vị trí `slide` KHÔNG bị chặn (cho nhiều banner, sắp theo `sort_order`). `code` banner sinh tự động (`ad_code_seq`), đừng set thủ công.

**Vị trí = "phiên trả giá":** `ad_positions` có `auction_ends_at` (đếm ngược "Kết thúc sau") + `bidder_count` (số người đang trả giá); `price` = "Mức giá hiện tại". Component `AdvertisementBlock` (prop-driven `endsAt`/`bidderCount`/`price`, dùng `formatVnd`) render card "Vị trí quảng cáo" + nút "Liên hệ để trả giá" (→ /lien-he). Hiện dùng làm **preview trong `AdPositionFormDialog`**; đặt card ra trang công khai + mở RLS public-read cho `ad_positions` = việc SAU.

### Khách hàng (admin, NGOÀI Marketing)
`/admin/khach-hang/*` — module khách hàng **generic dùng chung nhiều dịch vụ** (không riêng quảng cáo). Bảng `customers`; banner tham chiếu optional qua `advertisements.customer_id` (ON DELETE SET NULL). Route gác `<AdminPermissionRoute module="khach-hang">`; module khai đủ `view/create/update/delete/export`.

**Dựng ngang tầm module lead** (`20260806000010`): danh sách có pill trạng thái + lọc Phân khúc/Loại hình/Nguồn lead + cột Loại hình & Tài sản; chi tiết chia tab điều khiển bằng `?tab=` — `thong-tin` / `don-hang` / `chien-dich` / `co-hoi` / `cong-viec` / `tickets` / `lich-su` / `chi-nhanh`. Types ở `src/types/customers.ts` (dọn khỏi `types/advertising.ts`, file cũ re-export ngược); nhãn trạng thái ở `src/lib/customers/customerStatus.ts`.

**Ba con trỏ trên `customers`, ba mục đích khác nhau — đừng lẫn:**
| Cột | Trỏ tới | Mở ra cái gì |
|---|---|---|
| `source_lead_id` | `leads.id` | **Mã lead** nguồn (badge `← TN…` + card "Chuyển đổi từ KHTN"). Select phải hint `leads!customers_source_lead_id_fkey` — có 2 FK giữa 2 bảng |
| `prospect_kind`/`prospect_id` | pháp nhân trên sàn | tab **Lịch sử đấu giá** + **Chi nhánh/AMC** (không phụ thuộc lead còn tồn tại) |
| `user_id` | `auth.users.id` (UNIQUE partial) | tab **Chiến dịch**/email marketing (`campaign_recipients.user_id`) + đơn **nạp credit** (`orders.user_id`) |

`user_id` là **cầu nối DUY NHẤT** tới email marketing — `marketing_campaigns` không có `customer_id`, đối tượng nhận là người dùng sàn theo tiêu chí. Gắn hai đường: `admin_convert_lead` tự khớp email (rồi 9 số cuối SĐT qua `auth.users.phone`) và `UserPickerField` gắn/gỡ tay trong `CustomerFormDialog`. Cả hai đều bỏ qua tài khoản đã gắn khách khác; RPC bọc `EXCEPTION WHEN unique_violation` để tranh chấp đồng thời không làm hỏng chuyển đổi.

**Tab Đơn hàng gộp hai nguồn:** `useCustomerAllOrders(customerId, userId)` dùng `.or(customer_id.eq,user_id.eq)` — `orders_party_check` cho phép một trong hai, đơn nạp credit chỉ có `user_id`, bỏ vế đó là mất hẳn doanh thu B2C. Nhãn dòng suy từ `!o.customer_id` → "Nạp credit".

**Hai tab prospect dùng chung lead ↔ khách hàng:** `ProspectAuctionHistoryTab` / `ProspectBranchesTab` ở `src/components/admin/crm/prospect/` (component con ở `parts/`), chỉ nhận `{ kind, prospectId }`. Đừng nhân bản sang module khác.

### Công cụ đấu giá (Nội dung admin + MKP công khai)
`/admin/cong-cu-dau-gia` (module quyền `cong-cu-dau-gia`, category `noi-dung`) + MKP `/cong-cu-dau-gia` (list 4 công cụ) & `/cong-cu-dau-gia/:slug` (chi tiết provider). Bảng (`20260726000001-4`): `auction_tools` (4 công cụ cố định seed: `so-hoa/dinh-gia/vay-von/phap-ly`, `public_read` theo `is_active`), `auction_tool_providers` (gắn `supplier_id`+`service_id`+`service_variant_id` để quy doanh thu — đối tác ngoài dùng service `kind='commission'`, công cụ nhà SSCorp `is_own=true` dùng `direct`; `public_read` theo `status='active'`), `auction_tool_showcases`. Hooks: admin `useAuctionTools.ts`, MKP `usePublicAuctionTools.ts`; types `src/types/auctionTools.ts`; truy cập DB qua `(supabase as any)` như module CRM.

**Showcase bí mật qua RPC (KHÔNG public_read):** `url` (showcase password) + `access_password` nhạy cảm mà RLS lọc theo DÒNG không giấu được CỘT → bảng chỉ `admin_all`; MKP đọc qua SECURITY DEFINER `list_tool_showcases(_provider_id)` (chỉ trả `url` khi `visibility='public'`, còn lại `url=NULL, is_locked=true`, KHÔNG bao giờ trả `access_password`) + `unlock_tool_showcase(_id,_password)` (đổi mật khẩu chia sẻ lấy `url`). Cùng tinh thần "commission ẩn khỏi catalog".

**RPC public cho END-USER (mẫu MỚI):** `request_tool_service(_provider_id,_note)` — CTA "Sử dụng dịch vụ" (bắt buộc đăng nhập), grant `authenticated` nhưng **KHÔNG** gác `admin_has_permission` (khác các RPC chuyển đổi CRM); tạo lead (`source='tool_marketplace'`) + opportunity `stage='selling'` gắn service của provider, dedup theo (`created_by`, `tool_provider_id`, stage mở). Provider chưa gắn `service_id` ⇒ UI đổi CTA sang "Liên hệ tư vấn". Admin chốt thắng qua `admin_win_opportunity` như thường → khách hàng + đơn + hoa hồng. Truy vết: `leads.source='tool_marketplace'` + cột `tool_provider_id` trên `leads` & `opportunities`.

---

## Credits / Paywall

- `src/lib/credits.ts` — pure credit logic (costs, tiers, package math, `expandUnlock`).
- `src/hooks/useCredits.tsx` — **single access point** for all credit operations in components. Reads via React Query key `["user-credits", userId]`; every mutation calls `invalidate()` on that key. Exposes `balance`, `transactions`, `assetUnlocked(id)`, `companyAccess(orgId)`, `ownerAccess(ownerId)`, `isReportPeriodUnlocked`, `unlockAsset`, `unlockCompany`, `unlockOwner`, `unlockDeepReportPeriod`, `addCredits`, and the cost/tier/package constants.
- `src/contexts/PaywallContext.tsx` — `PaywallProvider` / `usePaywall()` drive credit-gated dialogs; lives inside Router.

**Behavior:** `unlockAsset` is **permanent** (`user_asset_unlocks`); `unlockCompany`/`unlockOwner` are **time-limited and stack** (new purchase extends from current expiry); `unlockDeepReportPeriod` key is `"{slug}:{periodId}"` and buying a year unlocks its quarters/months via `expandUnlock()`. See `credits-paywall-expert` for tiers/costs. Scaffold new unlock types with the **`/add-unlock`** skill.

---

## Reporting / analytics (admin) — derive revenue from the ledger

**Credit** revenue is never persisted as VND — it is **derived** from `credit_transactions`. Direct-service revenue DOES persist as `orders.amount` (the `orders` table). Neither has a real payment gateway yet (both are still inferred/manual).
- **Credit revenue rows** = `type='purchase' AND credit_delta>0 AND description LIKE 'Mua gói %'`; map each to a price via `CREDIT_PACKAGES` (`src/lib/credits.ts`) by **package name in the description** (never fallback on `credit_delta` — collides with reward/debug top-ups). Prices stay in code — **do not duplicate them into SQL/RPC**.
- Positive `purchase` with no package match = **"Nạp khác"** (VND 0, shown separately, excluded from avg). Negative `purchase` = a mislabeled spend ("Xuất hồ sơ") → count as consumption.
- **Consumption rows** = `credit_delta<0`, grouped by `type`; Vietnamese labels in `FEATURE_LABELS` (`src/lib/reports/transactionReport.ts`, the one catalog).
- Pattern (`Giao dịch credit`, `/admin/bao-cao/giao-dich`): pure aggregation in `src/lib/reports/transactionReport.ts` (unit-tested) + `useTransactionReport` hook (React Query keyed on **range only**; granularity re-buckets via `useMemo` with no refetch; paginated fetch 1000/page, 50k cap). RLS SELECT on `credit_transactions` is open to authenticated users (admin gate is UI-only) — future hardening = SECURITY DEFINER admin RPC.
- **Tin đấu giá** (`/admin/bao-cao/tin-dau-gia`, `listingsReport.ts` + `useListingsReport`) — báo cáo **tồn kho tài sản**, không phải tiền. Nguồn DUY NHẤT là `listings` (gồm cả `DRAFT/PENDING_APPROVAL/INACTIVE` — admin RLS thấy hết); khoảng ngày lọc theo `created_at`. Server tổng hợp ⇒ **granularity NẰM TRONG queryKey** (giống `useAccessAnalytics`, khác `useTransactionReport`).
  - **Bộ lọc là CẤP TRANG** (`ListingsFilterBar`: thời gian + tìm kiếm + trạng thái/nhóm/tỉnh/tổ chức ĐG/chủ tài sản) và chi phối **cả biểu đồ lẫn bảng**. `public.admin_listings_scope()` là **định nghĩa bộ lọc DUY NHẤT**; `admin_listings_report()` và `admin_listings_rows()` đều JOIN vào đó — đừng bao giờ lọc lại ở client, biểu đồ sẽ lệch bảng. Quy ước: tham số `NULL` = không lọc, client chuẩn hoá `"all"` → `null`.
  - Hai RPC tách nhau vì bảng đổi trang liên tục, không nên kéo theo 10 section tổng hợp. `useAdminListingsTable` gọi `admin_listings_rows` (phân trang + đếm phía server, các trường suy diễn tính sẵn trong SQL nên client không map lại).
  - `kpis.total` cố tình **không** lọc gì cả (tồn kho ≠ lưu lượng) — chỉ là mốc tham chiếu; UI chỉ hiện dòng "Đang xem N/M tin toàn sàn" **khi bộ lọc thực sự thu hẹp**, nếu không nó lặp y hệt thẻ KPI.
  - Combobox tổ chức/chủ tài sản tìm **phía server** (`useEntityOptions`, limit 50, chỉ query khi mở dropdown) — `asset_owners` phình theo số claim, không kéo hết về client.
- **Doanh thu tổng** (`/admin/bao-cao/doanh-thu`, `revenueReport.ts` + `useRevenueReport`) = credit-purchase VND (reuse `isPurchase`/`resolvePurchase`) + direct `orders.amount` (excl. `cancelled`). **Rule: credit counts at TOP-UP only, never at spend** — see `business-rules.md`. Reuses exported `enumerateBuckets`/`bucketKeyOf` from `transactionReport.ts`; `customers` (orders) and `profiles` (credit) are distinct populations, so NO by-customer view — reconcile only at VND + source level.

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
