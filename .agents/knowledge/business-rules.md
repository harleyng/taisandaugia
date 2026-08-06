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

## "Giá trị khởi điểm" của một tin đấu giá (fixed rule)

Quy đổi ra VND bằng `startValueOf()` (`src/lib/reports/listingsReport.ts`) ↔ `public.listing_start_value()` — dùng ở mọi nơi tổng hợp giá trị kho tin:
- `price_unit='TOTAL'` → `price`.
- `price_unit='PER_SQM'` → `price × area` (area = 0 coi như 1).
- **`price_unit='PER_MONTH'` → NULL, bị loại khỏi Σ và trung vị.** Giá thuê/tháng không phải giá khởi điểm đấu giá; cộng vào tổng là sai đơn vị. Các tin này gom vào khoảng giá **"Chưa quy đổi"** — hiện ra chứ không giấu đi.
- `price` NULL hoặc ≤ 0 cũng trả NULL. KPI luôn kèm `valuedCount/total` để biết tổng đang dựa trên bao nhiêu tin.

---

## Khách hàng tiềm năng — loại hình & quan hệ chi nhánh (fixed rule)

Nguồn: `admin_prospects` / `admin_prospect_detail` / `admin_set_prospect_parent` (đều SECURITY DEFINER + gate `has_role ADMIN`). Nhãn ở `src/lib/prospects/types.ts`.

- **`entity_type`** chỉ có 2 giá trị `individual | organization`, và **chỉ chủ tài sản mới có thể là cá nhân** (`asset_owners.owner_kind = 'individual'`). Tổ chức đấu giá theo luật luôn là pháp nhân ⇒ cố định `'organization'`.
- **Loại hình hiển thị là 3 giá trị** — `Cá nhân` / `Tổ chức - Chính` / `Tổ chức - Chi nhánh` — do `entityRole(entity_type, parent_id)` suy ra, **không phải cột DB**. Chi nhánh cũng là một khách hàng tiềm năng độc lập trong danh sách nên badge này là thứ duy nhất phân biệt nó với trụ sở. Tab "Chi nhánh / AMC" **chỉ hiện với `role === 'main'`**.
- **`subtype`** là hình thức chi tiết, hai từ điển gộp chung một Record: chủ tài sản dùng `owner_kind` (`individual/bank_credit/amc/enforcement/state_agency/company/other`); tổ chức đấu giá quy đổi từ `auction_organizations.org_type` (`0→center, 1→enterprise, 2→company, 11→branch`). Không có cột `entity_type`/`subtype` trong DB — RPC suy ra tại chỗ.
- **Quan hệ mẹ–con** nằm ở `asset_owners.parent_owner_id` và `auction_organizations.parent_org_id`, kèm `parent_source`:
  - `'inferred'` — do `infer_org_parents()` suy ra. **Điều kiện CẦN: tên con tự nhận là đơn vị thành viên** (`org_branch_marker()` khớp chi nhánh / phòng giao dịch / sở giao dịch / AMC / quản lý nợ / quản lý tài sản / khai thác tài sản) hoặc `org_type = 11`. Cha phải `name_tokens <@` token con (strict subset) và đủ đặc trưng (≥2 token, hoặc 1 token dài ≥4 ký tự).
  - `'confirmed'` — do admin gán qua `admin_set_prospect_parent()`. **`infer_org_parents()` chỉ ghi vào dòng có cột cha đang NULL**, nên chạy lại không bao giờ đè lên quyết định của người.
- `org_branch_marker()` phải giữ đồng bộ với regex backfill `owner_kind` ở `20260805000001` — lệch một mẫu là bản ghi được gắn `owner_kind='amc'` nhưng không đủ điều kiện làm đơn vị thành viên.
- Chi nhánh **cũng là một prospect độc lập** trong danh sách — bảng phải hiện "Thuộc «mẹ»" để khỏi đếm trùng khi rà khách hàng.

### Cụm đơn vị & lịch sử đấu giá theo cụm (fixed rule)

- **Cụm** (`prospect_unit_groups`, VD "Cụm miền Bắc") **thuộc về MỘT công ty mẹ cụ thể**, không phải nhãn tự do toàn sàn: `admin_set_prospect_group` chỉ nhận đơn vị đang trực thuộc đúng công ty mẹ của cụm, sai thì `no_eligible_units`. Rời công ty mẹ ⇒ `group_id` NULL luôn.
- `prospect_unit_groups.parent_id` **cố ý không có FK** (trỏ vào `asset_owners` hoặc `auction_organizations` tuỳ `kind` — Postgres không có FK đa đích). Ràng buộc ép ở RPC; mọi lối ghi đều qua SECURITY DEFINER.
- **Xoá cụm KHÔNG làm mất chi nhánh** (`ON DELETE SET NULL`) — thành viên chỉ quay về "Chưa xếp cụm".
- `admin_prospect_detail.history` **gộp tin của cả cụm** (mẹ + chi nhánh), mỗi dòng mang `unit_id`/`unit_name` + `group_id`/`group_name`. **"Đơn vị" là một chiều thống nhất: công ty mẹ cũng là một lát cắt mang tên chính nó**, không phải "phần còn lại".
- **Lệch số có chủ đích:** KPI tab Lịch sử đấu giá (cả cụm) ≠ cột "Tài sản" ngoài danh sách lead (chỉ riêng đơn vị đó). Cột danh sách KHÔNG được gộp — chi nhánh cũng là dòng riêng, gộp là đếm trùng.
- `legal_flags` / `postings_count` giữ phạm vi công ty mẹ: khác nguồn (`asset_postings` qua workspace claim), gộp vào là sai đơn vị đo.
- `units` CTE chỉ đi **một cấp**. Muốn hỗ trợ chuỗi 3 cấp thì phải đổi sang đệ quy.
- `admin_set_prospect_parent` (đơn lẻ) chỉ là vỏ bọc gọi `admin_set_prospect_parents` (mảng) — sửa luật gán cha ở đúng một chỗ.

---

## Bồi dưỡng chuyên môn hằng năm của đấu giá viên (fixed rule)

Căn cứ **Thông tư 19/2024/TT-BTP** (hiệu lực 01/01/2025). Chu kỳ là **NĂM DƯƠNG LỊCH**, không phải chu kỳ theo thẻ ĐGV.

Nguồn sự thật DUY NHẤT của **quy tắc kết luận**: `src/lib/personnel/cpd.ts`. Lõi `evaluateCpd(agg, year, now)` nhận struct **đã gộp** (`CpdAggregate`), không nhận sự kiện thô — portal gộp từ `org_auctioneer_events`, admin nhận gộp sẵn từ `admin_cpd_report`. **Đừng viết nhánh tính thứ hai ở đâu khác**, kể cả trong SQL.

**CÁCH TÍNH GIỜ KHÔNG Ở TRONG CODE — nó là MASTER DATA admin quản lý** (`/admin/quan-tri/boi-duong`, module quyền `dm-boi-duong`). Ba bảng: `cpd_activity_types` (hình thức) · `cpd_activity_roles` (vai trò trong hình thức) · `cpd_exemption_reasons` (trường hợp miễn). Engine chỉ nhận một `CpdRuleResolver` (`makeCpdResolver(catalog)` trong `cpd-catalog.ts`) rồi hỏi từng bản ghi *"tính giờ hay đạt cả năm"*.

**VAI TRÒ THẮNG HÌNH THỨC.** Khi `cpd_activity_types.has_roles = true`, `credit_mode`/`fixed_hours` lấy từ vai trò, KHÔNG lấy từ hình thức. Đây là lý do cả mô hình tồn tại: cùng một hội thảo, *báo cáo viên* hoàn thành nghĩa vụ cả năm (Đ26.2) còn *người tham dự* chỉ được quy đổi 4 giờ. Quy tắc này **nhân bản ở CTE `records` của `admin_cpd_report`** — sửa một bên phải sửa cả hai.

Thứ tự kết luận — bỏ bước nào cũng ra kết luận SAI LUẬT:

| # | Căn cứ | Điều | `status` / `reason` |
|---|---|---|---|
| 1 | Có bản ghi trong `org_auctioneer_cpd_exemptions` cho năm đó | 26.3 | `MIEN` / `exempt` |
| 2 | Có ≥1 bản ghi mà quy tắc cho `credit_mode = 'FULL_YEAR'` | 26.2 | `DAT` / `full_year_form` — **đạt bất kể số giờ** |
| 3 | Tổng giờ ĐÃ QUY ĐỔI của các bản ghi `credit_mode = 'HOURS'` ≥ **8** | 26.1 | `DAT` / `hours_met` |
| 4 | Thiếu giờ, `year < năm hiện tại` | | `QUA_HAN` / `year_closed` |
| 5 | Thiếu giờ, năm còn chạy | | `CHUA_DU` / `hours_short` |

- Giờ quy đổi của một bản ghi = `fixed_hours` nếu danh mục khai, ngược lại `events.hours` do tổ chức nhập (`creditedHoursOf`). Với `FULL_YEAR` thì `hours` vẫn được LƯU và IN ra hồ sơ nhưng **không cộng** vào mốc 8 giờ.
- Sửa danh mục **ÁP DỤNG HỒI TỐ** — hệ thống luôn chấm lại theo cấu hình hiện hành, kể cả năm đã đóng. Không snapshot. Trang admin có cảnh báo tương ứng; đừng bỏ nó đi.
- `missingProof` (bản ghi không có `attachments`, Điều 27.1) là **CỜ PHỤ — không đổi `status`**. Tính hợp lệ pháp lý do Sở Tư pháp phán; hệ thống chỉ cảnh báo. Đừng biến nó thành điều kiện loại.
- **KHÔNG còn cờ "đơn vị được công nhận" trên từng bản ghi.** Tính được-công-nhận (Điều 25) nay nằm trong ĐỊNH NGHĨA của hình thức (`COURSE` = "Lớp bồi dưỡng do đơn vị được công nhận tổ chức"). Cột `org_auctioneer_events.is_accredited_provider` là LEGACY, không đọc/ghi nữa.
- `cpd_activity_type_id IS NULL` trên một dòng TRAINING = bản ghi đào tạo **không thuộc diện bồi dưỡng bắt buộc** (vd chứng chỉ tốt nghiệp đào tạo nghề đấu giá) ⇒ không tính. Cột `cpd_kind` là LEGACY.
- Năm tính nghĩa vụ đọc từ `cpd_year`; bản ghi cũ chưa có thì suy từ `started_on` (`cpdEventYear`). **Logic này nhân bản trong SQL của `admin_cpd_report` — sửa một bên phải sửa cả hai.**
- Phạm vi áp dụng: chỉ ĐGV `is_active = true`.
- Mốc cảnh báo (tính phía client, KHÔNG có cron/email): đến 30/9 `none` · 01/10–14/12 `warning` · từ **15/12** (hạn nộp Sở Tư pháp, Đ26.3) `urgent` · năm đã đóng `critical`. Sở Tư pháp đăng danh sách hoàn thành chậm nhất **31/12** (Đ27.2).
- Xuất CSV danh sách tuân thủ **KHÔNG trừ credit** — khác "Xuất hồ sơ nhân sự" (`export_personnel_dossier`, có tính phí).
- Hồ sơ kết xuất nhận danh mục qua `DossierBundle.cpdCatalog` — **truyền vào, builder không tự fetch**. Thiếu nó thì mục VI mất tên hình thức và mục VII chấm mọi người thành "chưa đủ giờ" ngay trên sản phẩm có tính phí.

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

Roles are **per-organization and user-creatable** (`org_roles`, since `20260805000020`). The old global `organization_roles` table — three fixed names + an `ALL_PERMISSIONS` JSONB that no code ever read — has been **dropped**; so has `has_org_role()`.

- `org_seed_default_roles(org_id)` seeds every new org with **Chủ sở hữu** (`OWNER`, `is_system`), **Quản lý** (`MANAGER`), **Nhân viên** (`AGENT`). Called by the `create_owner_membership` trigger — never insert the owner membership manually.
- `OWNER` stores **no permission rows**; full access short-circuits inside `org_has_permission()`. Its matrix is not editable (RPC refuses it).
- Permission catalog lives in **code**: `src/lib/orgPermissions.ts` (module × action `view/create/update/delete/export`). DB stores only granted `(module, action)` rows. **Module codes are immutable** — renaming one strips that permission from every role of every org.
- **Splitting a module out** (e.g. `nhan-su` out of `nl-dau-gia-vien`, `20260805000040`): always ship a backfill that *preserves what users could already do*, mapping across renamed actions where needed — there, `view` also had to grant `export`, because the "Xuất hồ sơ" button previously required only view. Also `CREATE OR REPLACE org_seed_default_roles()` so new orgs get the same presets.
- Gate by **permission, never by role name** — `org_has_permission(org_id, module, action)` / `org_is_owner(org_id)`, both SECURITY DEFINER.

**Invariants enforced in the database (not just UI):**
- A tổ chức must always keep ≥ 1 ACTIVE `OWNER` — trigger `org_protect_last_owner`.
- Only an Owner may grant or remove the `OWNER` role (RLS `WITH CHECK` + `create_org_invite`).
- A membership's `role_id` must belong to the *same* org (RLS `WITH CHECK`) — the escalation vector that per-org roles introduce.
- `is_system` roles can't be deleted, renamed, or moved between orgs — trigger `org_roles_protect_system`.

### Member invites

`organization_memberships.status = 'PENDING_INVITE'` = "Đang mời". No email is sent anywhere — `create_org_invite` returns a token and the inviter copies `/loi-moi/:token` by hand (same choice as admin's `CreateUserDialog`).

- Invites may be created for **any** email; the dialog only warns (Chưa có tài khoản / Chưa kích hoạt / Tài khoản bị khóa). Only duplicates hard-block (already a member, or an invite already pending).
- **Acceptance requires `profiles.activated = true`** — enforced server-side by `accept_org_invite`, which returns `{ok:false, reason:'not_activated'}`. The UI then shows `DepositCard` and retries after activation.
- RPCs return `{ok:false, reason}` for *expected* failures (expired / already_claimed / email_mismatch / locked) and `RAISE` only for abnormal ones, so Vietnamese copy stays in the UI instead of parsing Postgres errors.
- Email mismatch is a **two-step confirm**, not a hard block (`_confirm_email_mismatch`): links are hand-carried, so recipients often hold a different address and would otherwise dead-end.

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
