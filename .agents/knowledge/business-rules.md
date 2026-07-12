# Business Rules — Tài Sản Đấu Giá (taisandaugia)

> Living document. Updated after every task that changes business logic.
> Referenced by: `cpo`, `credits-paywall-expert`, `kyc-expert`, `data-analyst`, `system-architect`, `qa-qc`.
> **Status values & credit costs are fixed sets — never invent labels or numbers.** Gate access through `useCredits` / RLS, never hardcode balances or unlock state.
> Source of truth: `CLAUDE.md` + `src/hooks/useCredits.tsx` + `src/lib/credits.ts`. When code and this doc disagree, code wins — then fix this doc.

---

## User Roles & Entry Points

| Role | Vietnamese | Entry point | Key actions |
|------|-----------|-------------|-------------|
| Anonymous visitor | Khách vãng lai | `/`, `/listings` | Browse listings, view market-report teasers (paywalled deep data) |
| Authenticated buyer | Khách mua | `/profile`, `/listings/:id` | Save assets, buy credits, unlock asset/company/owner info + deep reports |
| Auction company rep | Đại diện tổ chức đấu giá | `/dang-ky-to-chuc` | Complete KYC onboarding (3 milestones) |
| Asset owner | Chủ tài sản | owner-portal routes (`owner-nav-config.ts`), asset-posting wizard | Post assets for auction, manage listings |

- Auth is global via `AuthDialogContext` — `openAuthDialog(cb?)` opens the multi-step modal (identifier → email/phone → OTP/password → activation) from any component. The same modal serves both login and registration.
- Never use `<Button asChild><Link/></Button>` — buttons vanish silently. Use `navigate()` (see CLAUDE.md Button Navigation Pattern).

---

## Credits — the paywall economy

Single access point: **`useCredits()`** (`src/hooks/useCredits.tsx`). Underlying logic in `src/lib/credits.ts`. Never read/write credit state directly — always through the hook. All mutations invalidate the `["user-credits", userId]` query key.

### Pricing source of truth = DB catalog `service_variants` (code = fallback only)

**As of 2026-07-15, all prices live in the DB** (`services` group → `service_variants`, public-read RLS). Runtime reads them via `useServiceCatalog()` (UI) or `serviceCatalog.getVariantCost(variantKey)` / `getVariantPackage` (the async `credits.ts` unlock/addCredits fns). The old code constants (`ASSET_COST`, `COMPANY_TIERS`, `OWNER_TIERS`, `DEEP_REPORT_PERIOD_PRICES`, `OWNER_REPORT_COST`, `CREDIT_PACKAGES`) are now **FALLBACK ONLY** (used if the DB read fails) — change a price by editing the variant in the DB / admin **Dịch vụ** page, not the constant. Keep the fallback in `serviceCatalog.ts` roughly in sync. Deduction is still client-trusted (RLS own-rows); a SECURITY DEFINER RPC is a separate future initiative.

| Action | `variant_key` | Cost (credits) |
|--------|-----------------|:--:|
| Unlock asset contact | `asset_unlock` | **59** |
| Track company — 7d/30d/1y | `track_company_{7d,30d,1y}` | 99 / 299 / 1,990 |
| Track owner — 7d/30d/1y | `track_owner_{7d,30d,1y}` | 49 / 149 / 995 |
| Deep report — month/quarter/year | `deep_report_{month,quarter,year}` | 990 / 2,490 / 8,900 |
| **Báo cáo cơ hội** (buyer, per view) | `report_opp_buyer` | **1** (was cosmetic; now a real `chargeOppReport` spend) |
| **Báo cáo danh mục** (owner, per view) | `report_portfolio_owner` | **4** (repriced from 49; `chargeOwnerReport`) |
| **Xuất hồ sơ dự tuyển** (company) | `export_profile_company` | **30** (repriced from 50; `chargeExportProfile`) |

New ledger `type`s: `unlock_opp_report`, `export_profile`. Every consumption row now also stamps `variant_key` + `service_variant_id`.

### Credit packages — 3 AUDIENCE-SPECIFIC sets (DB, `category='package'`)

There is **no longer one flat package list**. Packages differ by `services.audience` (buyer / owner / company), 15 total. Each purchase interface shows only its audience's set (see architecture — per-surface `<CreditsTab audience=…/>`). `variant_key` (prefixed `buyer_`/`owner_`/`company_`) and package NAME are globally unique (revenue reverse-map depends on it).

- Buyer "Người mua" (báo cáo cơ hội = 1cr): Nhập Môn 200k→8 · Thực Tập 500k→22 · Nghiệp Dư 1tr→44 · Chuyên Nghiệp 2.3tr→96 · **Cao Cấp 2.5tr→116 (popular)** · **Trùm Săn 5tr→250 (best)**.
- Owner "Chủ tài sản" (báo cáo danh mục = 4cr): Dùng Thử 500k→20 · Khởi Động 1tr→44 · **Tăng Trưởng 2.5tr→112 (popular)** · **Bứt Phá 5tr→240 (best)**.
- Company "Công ty đấu giá" (xuất hồ sơ = 30cr): Khởi Đầu 1.5tr→60 · **Chuyên Nghiệp 3tr→150 (popular)** · Cao Cấp 6tr→300 · Doanh Nghiệp 12tr→600 · **Tập Đoàn 24tr→1320 (best)**.

- `credits` (granted) ≥ `base_credits` (paid) — bonus at higher tiers. Don't compute credits from VND — read the variant.
- Purchase flow: `/profile?tab=credits`|`/portal/credits`|`/chu-tai-san/credits` → `?package={variant_key}` → `/payment/vnpay` → `/payment-result`. **`addCredits` runs ONLY in `PaymentResult`** (double-credit guard) and stamps `variant_key`/`service_variant_id`.

---

## Unlock semantics

Three unlock kinds with **different lifetimes** — do not conflate them.

| Kind | Table | Lifetime | Helper (read) | Mutation |
|------|-------|----------|---------------|----------|
| Asset contact | `user_asset_unlocks` | **Permanent** | `assetUnlocked(id) → boolean` | `unlockAsset` |
| Company tracking | `user_company_unlocks` | **Time-limited + stacking** | `companyAccess(orgId) → CompanyAccess` | `unlockCompany` |
| Owner tracking | `user_owner_unlocks` | **Time-limited + stacking** | `ownerAccess(ownerId) → OwnerAccess` | `unlockOwner` |
| Deep report period | `user_report_unlocks` | **Permanent** | `isReportPeriodUnlocked` | `unlockDeepReportPeriod` |

### Rules

- **Asset** unlock is one-time and permanent — once bought, `assetUnlocked` stays true forever. Never re-charge `ASSET_COST` for an already-unlocked asset.
- **Company / Owner** tracking carries `tier` + `expires_at`. Purchases **stack**: a new purchase extends the window **from the existing expiry**, not from `now`. So buying 7-day then 30-day while active = 37 days of coverage. Access is granted while `expires_at > now`.
- **Deep report** unlock key format: **`"{slug}:{periodId}"`** (e.g. `"bds:2025-Q1"`). Purchasing a **year** unlocks every quarter/month inside it via **`expandUnlock()`** — one write fans out to all child period keys, and each becomes permanently unlocked.
- Every mutation calls `invalidate()` on `["user-credits", userId]` so `balance`/`transactions`/access helpers refresh reactively.
- Insufficient balance → the PaywallContext dialog surfaces a "buy credits" CTA; the deduction never partially applies.

### Credit ledger

`credit_transactions` is an **append-only ledger** — every earn (package purchase) and spend (unlock) is one immutable row. `user_credits` (PK = `user_id`) holds the running balance. Never mutate a past transaction; correct by appending a compensating row.

Ledger `type` values: `purchase`, `unlock_asset`, `unlock_company`, `unlock_owner`, `unlock_deep_report`, `owner_report_view`, and **`admin_grant`** (admin-gifted credit — a positive delta, distinct from `purchase`). Admin gifting is the **only** cross-user credit write and goes through the SECURITY DEFINER RPC **`admin_grant_credits(_user_id, _amount, _note)`** (guarded by `has_role(auth.uid(),'ADMIN')`) — client code can never write another user's `user_credits`/`credit_transactions`.

### Account activation ("nạp lần đầu để kích hoạt")

A self-registered user is **not activated** until their first credit top-up. Source of truth is **`profiles.activated` (+ `activated_at`)** — server-side, NOT `localStorage`. The login gate (`AuthDialog`) reads `profiles.activated`; `addCredits` sets it on the first top-up via `.eq('activated', false)` (so `activated_at` isn't overwritten on later top-ups); the personal `DepositCard` and `ProfileInfoTab` also read/write it. Admin-created users (via the edge function) are pre-activated. **Never reintroduce the old `localStorage["activated_${userId}"]` gate** — it broke across devices/logins.

### Account lock (khóa/mở)

Locking is a **real GoTrue ban** (`auth.admin.updateUserById(id, { ban_duration })`) done in the `admin-user-actions` edge function, mirrored to **`profiles.status`** (`'active' | 'locked'`) so the admin list can render "Bị khóa" without reading `auth.users`. A banned user cannot log in.

---

## Services & Orders — direct-sale revenue (NON-credit)

`services` = **groups** (2-level: group → `service_variants`, where the price lives), tagged `kind` (**`credit`** vs **`direct`**) + `audience` (buyer/owner/company/all) + `category` (package/unlock/feature/advertising). Credit variants are the pricing source of truth (above); `direct` groups (e.g. Quảng cáo) are sold for VND. `orders` = a `customers` (B2B) purchase of a `direct` service. Admin manages both at **Dịch vụ** (`/admin/dich-vu`, expandable group→variant rows + dropdown filters Nguồn/Nhóm/Đối tượng).

- **Orders only reference `direct` services.** The `orders_require_direct_service` trigger rejects an order whose `service.kind='credit'` (also filtered in the OrderFormDialog dropdown). This is the **double-count guard**: a credit "sale" is already the top-up in the ledger.
- **Fulfillment ("đã trả quyền lợi") = `fulfillment_status`** `pending | fulfilled | cancelled`. An advertising order auto-fulfills via DB trigger when its linked banner runs: `orders_fulfill_on_ad_active` (banner status → `active` fulfils linked `pending` orders) + `orders_fulfill_on_link` (order linked to an already-`active` banner fulfils on insert). Admin can still set status manually. (No scheduler exists — a banner reaches `active` only by an admin action.)
- **Revenue recognition (fixed rule):** *Doanh thu tổng* = credit **top-up** VND + `Σ orders.amount` (excluding `cancelled`). **Credit is counted at top-up (package purchase), NEVER at credit spend** — spend on features is consumption, not new cash. Direct orders recognized at placement (`pending`+`fulfilled`), bucketed by `ordered_at`. Report `revenueReport.ts`; see `architecture.md` Reporting.
- `orders.customer_id`/`service_id` are `ON DELETE RESTRICT` (can't delete a customer/service with orders); `advertisement_id` is `ON DELETE SET NULL`.

---

## KYC onboarding — 3-milestone flow

Route `/dang-ky-to-chuc`, rendered by `MilestoneProgress`. Components in `src/components/company-onboarding/`.

| Milestone | Component | Completes when |
|-----------|-----------|----------------|
| M1 — Tạo tài khoản | `M1AccountCreation` | Opens `AuthDialog`; done when user is authenticated |
| M2 — KYC | `M2KYC` → `KYCForm` | Full KYC form submitted → creates `organizations` row with `kyc_status = PENDING_KYC` |
| M3 — Đặt cọc | `M3Deposit` | Deposit confirmed → activates the org |

### M2 form structure (2-column, sticky `ReviewPanel` sidebar)

| Section | Component | Content |
|---------|-----------|---------|
| A | `CompanyTypeahead` | Typeahead search for the auction company |
| B | `Step2SelectTitle` | Role selector (legal rep / authorized rep) |
| C | `Step3PersonalInfo` | Identity fields (CCCD/passport, phone OTP, email) |
| D | `Step4Documents` | Legal document uploads |

Progress is computed from **`sectionStatus(form)`** (`M2/sectionStatus.ts`) — the sidebar reads from it; never recompute section completeness inline.

### Organization status lifecycle (`organizations.kyc_status` — fixed set)

```
PENDING_KYC  ──(admin review)──▶  APPROVED
                              └─▶  REJECTED
```

Never invent a status outside `{ PENDING_KYC, APPROVED, REJECTED }`. Transitions are admin-driven; the app writes only `PENDING_KYC` on submit.

### KYC validation rules (fixed)

| Field | Rule |
|-------|------|
| Full name | ≥ 3 characters |
| CCCD | 9–12 digits |
| Passport | ≥ 6 characters |
| Phone | `/^0[0-9]{9}$/` — **requires OTP verification** |
| Email | Valid format only (no domain restriction) |
| File uploads | PDF / JPG / PNG, ≤ 10 MB |

---

## Organization roles & permissions

Three roles seeded in `organization_roles`, wired by the `create_owner_membership` trigger.

| Role | Permissions |
|------|-------------|
| Owner | `ALL_PERMISSIONS` |
| Manager | `CAN_POST_LISTING`, `CAN_INVITE_AGENT`, `CAN_REMOVE_AGENT`, `CAN_MANAGE_LISTINGS`, `CAN_VIEW_ANALYTICS` |
| Agent | `CAN_POST_LISTING`, `CAN_VIEW_OWN_LISTINGS` |

- The org creator is auto-granted **Owner** membership via trigger — don't insert the membership manually.
- Gate actions by permission, not by role name where possible, so re-seeding roles doesn't break gates.

---

## RLS — "own rows" convention

Every credit/unlock table (`user_credits`, `credit_transactions`, `user_asset_unlocks`, `user_company_unlocks`, `user_owner_unlocks`, `user_report_unlocks`, `profiles.invoice_info`) carries a single **`"own rows"`** policy:

```sql
USING (auth.uid() = user_id)
```

- **Never expose credit/unlock data cross-user.** New per-user tables must ship with the same policy in the same migration.
- **Admin cross-user read** is the one sanctioned exception: a **separate** SELECT policy `<table>_admin_read USING (public.has_role(auth.uid(),'ADMIN'::app_role))` on `user_credits`, `user_roles`, and the 4 unlock tables (added in `20260712000012`). The own-rows policies stay intact; the admin policy only widens SELECT. Admin cross-user **writes** never widen a policy — route them through a SECURITY DEFINER RPC (e.g. `admin_grant_credits`) or the `admin-user-actions` edge function.
- Reads happen through the typed client (`src/integrations/supabase/client.ts`) and are filtered by RLS automatically — do not add app-side `.eq("user_id", …)` as the security boundary; RLS is the boundary.
- After any schema migration, regenerate `src/integrations/supabase/types.ts` (`npx supabase gen types …`). Do not hand-edit types except as a documented stopgap when Supabase creds are unavailable.

---

## Data & mock-data policy

- Real Supabase is the backend — build features against the typed client + React Query, not mock data.
- `src/lib/mock*.ts` (mockAuctionSessions, mockAuctionCompanies, mockBdsReport, mockOppReport, mockOutcomesReport, mockCredits) are **scaffolding only** — do not build new features on them.
- Reports (`/report`, `/report/:slug`, `/report/deep/outcomes`) are **Recharts dashboards**, not exports. Deep-report periods are the paywalled unit (see unlock semantics). There is no Excel/report-file export surface.
