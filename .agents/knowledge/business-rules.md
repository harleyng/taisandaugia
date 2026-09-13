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

## Tiếp thị phiên & danh bạ khách hàng của tổ chức (2026-09-12)

- **Sàn không cung cấp dữ liệu người mua cho tổ chức.** Danh bạ `/portal/khach-hang` (`org_contacts`) do tổ chức tự nhập / import. Module quyền `khach-hang`: MANAGER đủ 5 action, AGENT chỉ `view`.
- **Người nhận hợp lệ** = `status='active'` VÀ `notifications_enabled=true`. Mặc định `false`; trigger đóng dấu `consent_changed_at/by`. Khách khớp nhưng chưa đồng ý vẫn hiện (mục riêng) để tổ chức thấy vì sao danh sách gửi nhỏ hơn.
- **Luật khớp** (chỉ ở RPC `org_session_audience`): mỗi dòng nhu cầu × mỗi lô; AND trong một dòng, OR giữa các dòng. Loại tài sản = slug hoặc slug cha; tỉnh so qua `normalize_province`; giá khởi điểm trong `[min, max]` tính cả hai đầu. Chiều bỏ trống = không giới hạn; lô thiếu dữ liệu ở chiều bị ràng buộc thì KHÔNG khớp. Không chấm điểm.
- **Phân khúc:** `lot:<item_uuid>` (khớp đúng 1 lô) / `multi` (≥2 lô). Tin gửi từng khách = câu chào của phân khúc + đúng các lô khách đó khớp.
- **Thông báo đấu giá:** câu chữ khoá theo phiên bản trong code; trình soạn chỉ điền ô `draft` (mô tả, hiện trạng), ô `case` do tổ chức nhập, ô `fact` đọc từ phiên. Mẫu `2026-09-12` **đang chờ pháp chế rà soát**.
- **Đánh dấu đã gửi:** chỉ khi phiên `published` và còn trong giai đoạn nhận hồ sơ; liên hệ từng khách chỉ với khách đang đủ điều kiện; nhật ký append-only. Phiên đã huỷ khoá mọi ghi.
- **Quyền:** xem gói = `phien-dau-gia.view`; soạn / sửa / đánh dấu kênh = `phien-dau-gia.update`; xem người nhận = thêm `khach-hang.view`; ghi nhận liên hệ khách = `khach-hang.update`.

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
- **Money collected on behalf of an auction org is NEVER a `direct` order.** Hồ sơ tham gia đấu giá: `_settle_bidding_contract` ghi đơn `commission` (`gross_amount` = tiền hồ sơ, `amount` = phần sàn theo hợp đồng, `user_id` = người mua, `fulfilled`). Xem mục "Hồ sơ tham gia đấu giá".

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

## Tài sản tự nguyện — `asset_postings.review_status` (fixed set)

**HAI cột trạng thái, đừng trộn.** `status` là vòng đời của **chủ tài sản**; `review_status` là kết luận của **admin**.

```
status        : draft → active → matched → contracted (│ cancelled)   ← chủ tài sản
review_status : pending ──(admin)──▶ approved                          ← admin
                        └─────────▶ rejected ──(mở lại)──▶ pending
```

- Mặc định `pending` cho **mọi** hồ sơ mới, kể cả `draft`. Admin xem được cả hồ sơ nháp (`/admin/tai-san`).
- **Cổng chặn:** chỉ `status='active' AND review_status='approved'` mới được gửi cho tổ chức đấu giá (`AssetPostingDetail.tsx`). Chưa duyệt ⇒ banner chờ; bị từ chối ⇒ hiện `rejection_reason`.
- **Chủ tài sản sửa hồ sơ đã duyệt ⇒ tự về `pending`.** Duyệt một lần rồi viết lại toàn bộ tài sản là lỗ hổng, không phải tính năng.
- `review_notes` là ghi chú **nội bộ** — không bao giờ render ở phía chủ tài sản. `rejection_reason` thì có.
- Quyền: module `tai-san-tu-nguyen` (`view`/`update`/`approve`/`export`), nhóm **Vận hành & Hỗ trợ**, nhãn "Tài sản tự nguyện" (đổi từ `duyet-tai-san` ở `20260906200001`). Mã này nằm trong 2 policy RLS + `guard_asset_posting_review()` + `admin_dispatch_service_requests()` — đổi mã phải đổi cả 4 chỗ trong DB. `approve` được enforce ở **trigger DB**, không chỉ ở UI — đây là module đầu tiên thực sự dùng action `approve`.
- **Chưa public:** hồ sơ đã duyệt KHÔNG lên `/listings`. `asset_postings` và `listings` vẫn là hai thế giới tách rời.

---

## Organization roles & permissions

Roles are **per-organization and user-creatable** (`org_roles`, since `20260805000020`). The old global `organization_roles` table — three fixed names + an `ALL_PERMISSIONS` JSONB that no code ever read — has been **dropped**; so has `has_org_role()`.

- `org_seed_default_roles(org_id)` seeds every new org with **Chủ sở hữu** (`OWNER`, `is_system`), **Quản lý** (`MANAGER`), **Nhân viên** (`AGENT`). Called by the `create_owner_membership` trigger — never insert the owner membership manually.
- `OWNER` stores **no permission rows**; full access short-circuits inside `org_has_permission()`. Its matrix is not editable (RPC refuses it).
- Permission catalog lives in **code**: `src/lib/orgPermissions.ts` (module × action `view/create/update/delete/export`, plus `operate/finalize` used only by `dieu-hanh-dau-gia`; the matrix editor draws each module's own actions). DB stores only granted `(module, action)` rows. **Module codes are immutable** — renaming one strips that permission from every role of every org.
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

## Ký gửi tài sản (chủ tài sản → tổ chức đấu giá)

Hồ sơ đã số hoá (`status='active'`) **và đã duyệt** (`review_status='approved'`) mới gửi được cho tổ chức. Hai lối, cùng đích:

| Lối | Đường đi |
|---|---|
| **Tự chọn** (`orgMode='self'`) | Chủ tài sản chọn tới **`MAX_RFQ_ORGS`=5 tổ chức** → 1 dòng `asset_service_requests` mỗi tổ chức (`origin='owner'`, `sent`), cùng một `message` → so sánh báo giá → chốt 1 |
| **Nhờ sàn chọn giúp** (`orgMode='platform'`) | `asset_broker_requests` (`pending`) → admin fan-out N tổ chức (`origin='platform'`, broker→`sourcing`) → tổ chức báo giá (`quoted`, broker→`quoted`) → chủ tài sản chốt 1 (`selected`) |

**Luật bất biến:**
- **Chỉ gửi tới tổ chức ĐÃ CÓ TÀI KHOẢN** (`organizations.kyc_status='APPROVED'` + `auction_org_id` trỏ danh bạ). Áp cho cả hai lối — `useMatchedOrgs` mặc định `onlyAccounted: true`, và `admin_dispatch_service_requests` bỏ qua tổ chức không đạt. Gửi cho tổ chức không có tài khoản = yêu cầu không ai trả lời được.
- **Trần RFQ đếm theo yêu cầu CÒN SỐNG**, không theo số dòng đã gửi: `isLiveServiceRequest` (`sent`/`seen`/`quoted`/`accepted`/`selected`) so với `MAX_RFQ_ORGS` (`constants/asset-posting-rules.ts`). `UNIQUE(asset_posting_id, auction_org_id)` chặn gửi lại một tổ chức **vĩnh viễn** kể cả sau khi nó `declined` — đếm cả dòng đã chết thì 5 lời từ chối là hết đường gửi tiếp. Hai tập KHÁC nhau: `alreadySentIds` (mọi dòng → làm mờ thẻ) vs `activeCount` (dòng sống → áp trần).
- **Gửi thêm tổ chức được, cho tới khi chốt**: card "Gửi thêm tổ chức" ở trang chi tiết hồ sơ mở cho tới khi có dòng `selected` (hoặc sàn đang gửi hộ, hoặc đủ trần). Đang gửi thêm thì lối "nhờ sàn chọn giúp" bị ẩn — hai luồng song song trên cùng hồ sơ làm thanh tiến trình "sàn đã gửi N tổ chức" đếm cả tổ chức chủ tài sản tự gửi.
- **Một bản brief cho mọi tổ chức** — `asset_service_requests.message` giống nhau trên mọi dòng của một lần gửi. Đó là định nghĩa của RFQ; không có ô nhắn riêng từng tổ chức.
- **Chốt một báo giá là cam kết**: `owner_select_service_quote` đặt dòng đó `selected`, đóng anh em cùng hồ sơ (`sent/seen/quoted`) thành `not_selected` (ghi `closed_by_request_id` + `status_before_close` để mở lại chính xác), và mở lead `source='asset_brokerage'` + cơ hội `stage='selling'` (dịch vụ "Môi giới ký gửi tài sản", `variant_key='broker_consignment'`). UI bắt buộc qua hộp thoại xác nhận (`AcceptQuoteDialog`).
- **Tối đa MỘT dòng đã chốt / hồ sơ — enforce ở DB, không chỉ RPC** (`20260912000001`): partial UNIQUE `(asset_posting_id) WHERE status IN ('selected','accepted')`; mọi đường ghi (chốt · báo giá · chèn yêu cầu · dispatch) lấy advisory lock `lock_asset_posting_consignment` rồi mới `FOR UPDATE` dòng; trigger chặn chèn yêu cầu vào hồ sơ đã chốt. Tổ chức **không báo giá được khi hồ sơ đã chốt** — chặn theo hồ sơ, vì dòng `declined` không bị đóng khi chốt.
- RPC ký gửi phía chủ tài sản/tổ chức trả `{ok:false, reason}` cho lỗi nghiệp vụ (`already_selected`, `not_quoted`, `posting_already_selected`, `request_closed`…) — client phải `assertRpcOk`, câu tiếng Việt ở `src/lib/consignment/errors.ts`.

### Hợp đồng dịch vụ đấu giá (chủ tài sản ↔ tổ chức đã chốt)

```
consignment_contracts.status:
  drafting ─(tổ chức chia sẻ dự thảo)→ awaiting_signatures ─(một bên tải bản đã ký)→ awaiting_confirmation ─(đủ 2 xác nhận)→ signed
  mọi trạng thái mở ─(một bên huỷ, lý do ≥ 10 ký tự)→ cancelled
```
- **Tạo cùng giao dịch với việc chốt báo giá**; `terms` = báo giá đóng băng lúc chốt, bất biến. Tối đa một hợp đồng chưa huỷ / hồ sơ.
- **Ký ngoài sàn, xác nhận trên sàn.** Chỉ tổ chức chia sẻ dự thảo; bên nào cũng tải được bản scan. Dự thảo mới hoặc scan mới **xoá mọi xác nhận**. Xác nhận phải gửi kèm đúng path đang xem (`document_changed` nếu tệp vừa bị thay).
- **Đã ký / đã huỷ là bất biến** (trigger guard; chỉ cho FK bị SET NULL).
- **Huỷ ⇒ chọn lại:** yêu cầu đã chốt → `contract_cancelled` (không gửi lại tổ chức đó); các dòng bị CHÍNH lần chốt đó đóng mở lại đúng trạng thái cũ (`reopened_at`); broker request về quoted/sourcing; cơ hội CRM `selling|pending_approval` → `lost`. Không huỷ được sau khi đã ký.
- **Ai thấy gì:** chủ tài sản đọc bảng qua RLS. Tổ chức KHÔNG có policy đọc — chỉ qua RPC `org_consignment_contract`, và chỉ khi hợp đồng chưa huỷ mới thấy danh tính, địa chỉ tài sản, giấy tờ sở hữu (`asset-docs` policy `asset_docs_contract_org_read`). Thao tác phía tổ chức cần `yeu-cau-ky-gui.update` (hoặc chủ sở hữu tổ chức).
- **Thông tin pháp lý tối thiểu** (`consignment_missing_parties`): địa chỉ chủ tài sản (KYC: `asset_owner_kyc.address` / `asset_owner_org_kyc.head_office_address`, bắt buộc khi nộp KYC, sửa sau duyệt qua `owner_update_kyc_address`) + `org_general_info.legal_rep_name`. Thiếu ⇒ `party_incomplete`, chặn chia sẻ dự thảo & tải bản ký. Bên A = KYC **tổ chức** nếu có, không thì cá nhân.
- **Phiên đấu giá chỉ nhận tài sản ký gửi có hợp đồng `signed`** — cả lúc thêm lô (`auction_session_items_validate`) lẫn lúc công bố (`auction_sessions_guard`).
- "Đã ký hợp đồng" trên hồ sơ là **suy ra** từ hợp đồng — không bao giờ ghi `asset_postings.status`.
- Tệp: bucket PRIVATE `consignment-contracts`, path `{organization_id}/{contract_id}/{draft|signed}-{epoch}-{tên}`; không UPDATE/DELETE.
- **Dự thảo tự sinh** (`src/lib/consignment/contract-pdf/`): dựng từ báo giá ĐÃ ĐÓNG BĂNG + thông tin các bên; điều khoản là MẪU chưa rà soát pháp lý, luôn in "DỰ THẢO"; thiếu thông tin các bên thì không cho tạo. Tổ chức vẫn có thể tải lên bản của mình (`draft_source = uploaded`).
- **Việc đang chờ (badge):** tổ chức = soạn/ký (`drafting`, `awaiting_signatures`) hoặc chưa xác nhận bản ký — cộng vào badge "Yêu cầu ký gửi". Chủ tài sản (`owner_consignment_summary.owner_action`, ưu tiên theo thứ tự): `confirm_contract` › `add_address` (hợp đồng mở mà KYC chưa có địa chỉ) › `choose_quote` (có báo giá, chưa chốt) — badge nav "Số hoá tài sản" = số hồ sơ có việc.
- **Miễn phí với chủ tài sản** — không trừ credit, không đụng `credit_transactions`. Doanh thu ghi nhận khi admin chốt thắng cơ hội (`admin_win_opportunity`), amount do admin nhập.
- Máy trạng thái nằm ở RPC, không ở client: tổ chức không có UPDATE qua RLS, chủ tài sản chỉ tự `withdrawn` được.
- Báo giá gồm **phương án tổ chức đấu giá** (`quote_plan` JSONB: hình thức đề xuất · bước giá · tiền đặt trước · địa điểm · kênh niêm yết · mốc thời gian · phạm vi dịch vụ) · **chi phí theo khoản mục** (`quote_fee_items` JSONB: `{key,label,amount,optional}`) · thù lao % · giá khởi điểm đề xuất · ghi chú · 1 tệp (bucket `quote-docs`, path `{organization_id}/{request_id}/{file}`). Tổ chức sửa lại báo giá được cho tới khi chủ tài sản chốt.
- **`quote_service_fee` và `quote_lead_time_days` là GIÁ TRỊ DẪN XUẤT — server tính, client không nhập.** `org_respond_service_request` đặt `quote_service_fee` = tổng các khoản **bắt buộc** (`optional=false`; khoản tuỳ chọn KHÔNG cộng) và `quote_lead_time_days` = mốc `mo_phien` trong `quote_plan.milestones`. Bắt buộc tính ở server vì `owner_select_service_quote` đẩy `quote_service_fee` thẳng vào `opportunities.gross_amount`: con số CRM phải đúng bằng con số chủ tài sản so sánh. Không có `fee_items` (dòng cũ/seed) thì mới lấy giá trị client gửi lên.
- **Danh mục phương án là hằng số trong code** (`src/constants/quote-plan.ts`: kênh niêm yết, mốc thời gian, phạm vi dịch vụ, preset khoản phí) — cố tình không master data: nhãn tự do thì hai báo giá không còn so sánh được, đúng thứ mà phương án có cấu trúc sinh ra để thay thế. Key ghi thẳng vào JSONB nên **bất biến**; đổi key là mất dữ liệu báo giá đã gửi. Tiền đặt trước ngoài 5–20% giá khởi điểm chỉ **cảnh báo**, không chặn.

## Hồ sơ tham gia đấu giá (người mua → phiên đấu giá)

Người mua mua hồ sơ của một **PHIÊN** đã công bố trên `/sessions/:id`, trả VND qua VNPay (mô phỏng); tổ chức quản lý ở `/portal/ho-so-tham-gia` và thẻ trong chi tiết phiên. Bảng `auction_bidding_contracts` (migration `20260911000005`).

**Luật bất biến:**
- **Một hồ sơ / (phiên, người mua)** — lô không tham gia điều kiện mua. Thành viên/chủ tổ chức KHÔNG mua được phiên của chính tổ chức mình.
- **Chỉ bán trực tuyến khi**: phiên `published`, trong `[registration_start_at, registration_end_at]`, trước `starts_at`, `dossier_fee > 0`, **và** tổ chức có `suppliers.auction_org_id` active + hợp đồng active có dòng cho dịch vụ "Bán hồ sơ tham gia đấu giá" (variant `auction_dossier_fee`). Không có hợp đồng ⇒ không bán, KHÔNG rơi về `direct`.
- **Giữ chỗ 15 phút** (`pending_payment` + `hold_expires_at`). Trần `max_registrants` = đã trả + giữ chỗ còn hạn; không hạ được trần dưới số đã trả (trigger `auction_sessions_cap_guard`).
- **Giá là bản chụp** (`fee_amount`) lúc giữ chỗ; đổi giá phiên không đổi hồ sơ đã có.
- **Thanh toán idempotent ở server** qua `payment_claims`; F5 trả `already_paid`. Mỗi lần trả = một đơn `commission`; hợp đồng hết hiệu lực giữa lúc giữ chỗ và trả ⇒ đơn `fixed 0` kèm ghi chú "cần đối soát" (không chặn người đã trả).
- **Riêng tư**: bảng không có policy ghi; người mua đọc dòng của mình, tổ chức (`ho-so-tham-gia` view) chỉ đọc dòng `paid`, admin chỉ đọc. Mọi thay đổi qua RPC tự kiểm quyền.
- **Tiền đặt trước**: `pending → received → refunded | forfeited` (forfeited bắt buộc ghi chú); lùi một bước được để sửa nhầm, lùi về `pending` **xoá số báo danh**. Phiên đã huỷ chỉ cho `received → refunded`. Sau chốt phiên trực tuyến thêm `applied` / `pending_refund` (xem mục dưới); hồ sơ đã trả giá hoặc phiên đã chốt thì `org_set_contract_deposit` bị trigger chặn.
- **Số báo danh** duy nhất trong phiên, chỉ cấp khi `deposit_status='received'` và phiên chưa huỷ; tự cấp = max + 1.
- **VNeID**: `user_verified_identities` (1 dòng/người, huỷ liên kết = xoá). Server gắn `identity_source='vneid'` khi họ tên + CCCD khớp và lấy ngày sinh/giới tính từ bản xác thực.
- **MÔ PHỎNG — chưa dùng cho tiền thật**: `pay_bidding_contract` và `save_vneid_identity` tin client. Trước khi có tiền thật phải thay bằng IPN VNPay / OAuth VNeID ở Edge Function (service_role) rồi thu hồi 2 hàm này.
- Chưa có: sổ khoản sàn phải trả tổ chức (`gross − amount`), hoàn tiền hồ sơ khi phiên huỷ.

## Đấu giá trực tuyến (trả giá lên) — phiên `truc_tuyen` / `ca_hai`

Engine ở SQL, migration `20260913000001` (kế hoạch + các bước UI còn lại: `docs/online-auction-plan.md`). v1 là thí điểm, chưa phải trang đấu giá trực tuyến được phê duyệt.

**Luật bất biến:**
- **Chỉ trả giá lên** (`bidding_method='ascending'`). Đủ điều kiện trả giá = hồ sơ `paid` + có số báo danh + `deposit_status='received'`.
- **Giá hợp lệ**: lượt đầu ≥ giá khởi điểm; sau đó ≥ giá hiện tại + 1 bước; phải nằm trên lưới `giá khởi điểm + k × bước giá`; nhảy tối đa `max_bid_steps` bước (mặc định 10). Người đang dẫn đầu không tự trả giá đè (`already_leading`).
- **Thời gian = server.** Lô đóng khi `ends_at` qua; lượt hợp lệ khi còn < `extension_seconds` (mặc định 300) ⇒ `ends_at = now + extension_seconds`. Tạm dừng: không nhận giá, tiếp tục cộng lại thời gian dừng. Mốc kết thúc ban đầu = giờ kết thúc phiên.
- **Rút lại giá đang dẫn đầu chỉ ảnh hưởng LÔ đó** (người dùng chọn 2026-09-12): lô quay về lượt hợp lệ trước; tiền đặt trước (tính theo PHIÊN) bị tịch thu ngay ⇒ không trả giá thêm ở đâu nữa, nhưng vẫn giữ dẫn đầu lô khác và vẫn trúng.
- **Kết quả**: có lượt hợp lệ ⇒ `sold`, người trúng = người dẫn đầu, hạn thanh toán = giờ đóng + 30 ngày; không ⇒ `unsold`. Tổ chức xác nhận thanh toán thủ công; không thanh toán ⇒ tịch thu tiền đặt trước (`applied → forfeited`).
- **Chốt phiên** chỉ khi mọi lô `closed`/`withdrawn` (lô chưa mở phải rút trước). Tiền `received`: người trúng ⇒ `applied`, người không trúng ⇒ `pending_refund` ⇒ `refunded` (quyền `ho-so-tham-gia.update`). Đã `forfeited` thì giữ nguyên.
- **Biên bản công khai SAU chốt** (người dùng chọn 2026-09-12) ⇒ PDF biên bản chỉ ghi họ tên + số báo danh người trúng, **không CCCD / địa chỉ**. Công khai lượt trả giá chỉ theo số báo danh.
- **Biên bản (Bước 6)**: tệp tải lên `auction-minutes/{orgId}/{sessionId}/{tên}.pdf` TRƯỚC rồi mới gọi `org_issue_minutes` (RPC từ chối `file_missing`). Tệp bất biến, `pdf_path` UNIQUE, `sequence_no` do server cấp max+1 ⇒ **giấy không in số thứ tự cũng không in hash của chính nó** (quyết định 2026-09-12); số thứ tự + SHA-256 hiện cạnh link tải. Thử lại chỉ gọi lại RPC, không tải lại tệp. Tiền in kèm chữ (`soThanhChu.ts`); đấu giá viên chọn từ `org_auctioneers`. Mẫu `MINUTES_TEMPLATE_VERSION` — **chưa rà soát pháp lý**.
- **Kết quả công khai chỉ hiện sau `finalized_at`** (người dùng chọn 2026-09-12), cùng mốc RLS mở biên bản cho khách. Không có "kết quả sơ bộ".
- **Khi đã có lô rời `pending`**: không đổi hình thức/giờ/quy tắc phiên, không thêm/xoá lô, không đổi giá khởi điểm/bước giá/tiền đặt trước, không đổi tiền đặt trước/số báo danh của người đã trả giá — tất cả chặn ở trigger.
- Quyền: module `dieu-hanh-dau-gia` — `operate` (mở / tạm dừng / tiếp tục / rút tài sản), `finalize` (chốt, biên bản, xác nhận thanh toán). MANAGER có cả ba, AGENT chỉ `view`.
- **Phòng trả giá `/sessions/:id/dau-gia` (Bước 4):** route công khai, KHÔNG `ProtectedRoute`. Chưa đủ điều kiện ⇒ **chặn cả trang** (người dùng chọn 2026-09-12), không xem được giá/diễn biến. Cổng là hàm thuần `roomGateOf()` (`src/lib/bidding/roomAccess.ts`) với thứ tự: loading → not_found/draft → cancelled → not_online → method_unsupported → not_started (`now < starts_at`) → forfeited → blocked → open.
- **Người đã rút giá (`deposit_status='forfeited'`) có nhánh riêng**, không dùng câu `no_deposit`: họ vẫn có thể đang dẫn đầu lô khác và vẫn trúng, chỉ mất quyền trả giá tiếp.
- **"Vào được phòng" KHÁC "trả giá được" (Bước 6).** Chốt phiên đẩy mọi tiền đặt trước đã nộp sang `applied`/`pending_refund`, nên `deposit_status !== 'received'` KHÔNG có nghĩa là chưa nộp tiền. `roomGateOf` trả `view_only { reason: forfeited | settled | refunded }` — giữ người đã tham gia ở lại đọc kết quả, chỉ khoá ô trả giá; `view_only` đòi có số báo danh, không thì `blocked("no_bidder_no")`.
- **Lô tạm dừng thì KHÔNG chạy đồng hồ**: `org_resume_lot` cộng bù khoảng dừng vào `ends_at`, nên `ends_at` lúc đang dừng là số cũ.

## Hỏi đáp theo tài liệu phiên (người mua → tổ chức đấu giá)

Người mua hỏi trên `/sessions/:id/hoi-dap` hoặc Zalo (hiện giả lập); tổ chức trả lời ở `/portal/hoi-dap`. Migrations `20260912000100-101`.

**Luật bất biến:**
- **Chỉ trả lời từ tài liệu của CHÍNH phiên đó** — không dùng phiên khác, không kiến thức chung. Tư vấn / dự đoán / hỏi phiên khác ⇒ chuyển chuyên viên.
- **Câu trả lời AI luôn có 1–3 trích dẫn NGUYÊN VĂN** từ điều khoản citable (`clause.status='confirmed'` VÀ tài liệu `confirmed`; riêng `clarification` xác nhận theo từng điều khoản). Không có trích dẫn phân giải được ⇒ không bao giờ tới người mua.
- **Không trả lời được ⇒ chuyển chuyên viên VÀ ghi sổ `case_question_escalations`.** Trạng thái sổ (lỗ hổng tài liệu đã bù chưa) TÁCH khỏi `qa_state` (người hỏi đã được trả lời chưa).
- **Tự gửi hay soạn nháp** theo cấu hình tổ chức từng kênh + ngưỡng `min_confidence`; mặc định soạn nháp. "Chạy lại AI" luôn ra nháp. Tin chờ khi chuyển tiếp chỉ gửi ở kênh bật tự gửi và không chứa số liệu.
- **Điều khoản trích xuất tự động là NHÁP**; còn `[[CẦN NHẬP]]` thì không xác nhận được; sửa nội dung / đổi tệp ⇒ về nháp. Câu trả lời đã gửi mà điều khoản không còn khớp ⇒ người mua thấy "tài liệu đã thay đổi", nội dung bị ẩn.
- **Chuyên viên được trả lời không trích dẫn** (nhãn "Chuyên viên trả lời"); đính kèm điều khoản thì phải citable + cùng phiên.
- Hỏi trên sàn phải đăng nhập; phiên `published` và chưa kết thúc; tối đa 10 câu/10 phút và 40 câu/ngày mỗi người.
- Quyền: tài liệu phiên = `phien-dau-gia.update`; hộp thư = `hoi-dap` view/update (MANAGER + AGENT); bật tự gửi = `hoi-dap-cai-dat` (MANAGER, OWNER).

## Hợp đồng mua bán tài sản đấu giá (sau khi phiên chốt kết quả)

Bảng `auction_sale_contracts` (`20260914000001`). MỘT hợp đồng cho MỘT lô đã bán,
do tổ chức lập **tường minh** sau khi chốt phiên — không tự sinh lúc finalize.

**Vòng đời** (`status`):
`drafting → awaiting_signatures → awaiting_confirmation → signed → completed`,
và `cancelled` cắt ngang từ bất kỳ trạng thái nào **trừ** `completed`.
Giai đoạn hiển thị (`stage`, suy ra) : `signing · paying · handover · completed · cancelled`.
`completed` đòi **cả** `paid_at` **và** `handed_over_at`.

**Bên bán suy từ nguồn của lô — KHÔNG có cột chủ sở hữu trên `auction_session_items`:**

| Nguồn lô | `seller_kind` | Ai thao tác phía bên bán |
|---|---|---|
| `posting` (ký gửi) | `owner_user` | Chủ tài sản, trong cổng chủ tài sản |
| `listing` (tin đăng) | `org_on_behalf` | Tổ chức đấu giá ký thay (chủ tài sản là thực thể danh bạ, không có tài khoản) |

Không giải được bên bán ⇒ RPC trả `seller_unresolved`. **Không bịa ra một bên bán.**

**Chữ ký:** bên mua + bên bán bắt buộc; tổ chức là bên thứ ba chỉ khi `org_signs`.
Chia sẻ dự thảo mới **xoá** bản ký và mọi xác nhận. Xác nhận phải gửi lại đúng
đường dẫn đang hiển thị (`document_changed`).

**Tiền — sổ ghi thêm, không phải một nút bấm:**
- Số dư = `price − deposit_credit − Σ(thu ròng)`. Tiền đặt trước chỉ thành
  `deposit_credit` khi engine đã chuyển cọc sang `applied`; cọc nộp theo PHIÊN
  nên phải trừ phần đã ghi cho hợp đồng khác của cùng hồ sơ, và kẹp `≤ price`.
- Phân bổ **FIFO tính lại từ đầu** ⇒ hoàn bút toán tự mở lại đúng các kỳ đã đóng.
- Số dư về 0 ⇒ `paid_at` + `auction_lot_states.payment_status = 'paid'`.
- Chỉ **tổ chức** ghi nhận tiền. Ghi được cả khi chưa ký (cọc thường chuyển sớm),
  nhưng giai đoạn không nhảy sang `paying` cho tới khi ký xong.
- Đổi lịch kỳ hạn chỉ khi **chưa ký VÀ sổ tiền còn trống** (`payments_exist`).

**Huỷ — hậu quả tiền đặt trước khác nhau theo `cancel_kind`** (Điều 39 Luật ĐGTS):

| `cancel_kind` | Tiền đặt trước | Lô |
|---|---|---|
| `buyer_refused` | **MẤT** (`forfeited`) | `payment_status = 'defaulted'` |
| `seller_refused` | `pending_refund` | về `pending` |
| `mutual` | `pending_refund` | về `pending` |

Lý do huỷ tối thiểu 10 ký tự. Huỷ một hợp đồng **đã ký** là hợp lệ (thoả thuận).

**Bàn giao:** tổ chức hẹn lịch; **hai bên** (mua + bán) cùng xác nhận mới có
`handed_over_at`. Tổ chức không xác nhận thay. Sang tên (`title_transfer_status`)
chỉ là **ghi nhận**, không phải quy trình — thủ tục ở cơ quan nhà nước.

**Mặc định:** hạn ký `now + 7 ngày`; một kỳ duy nhất đến hạn đúng `payment_due_at`
của lô (ends_at + 30 ngày); hạn bàn giao `now + 7 ngày` kể từ lúc ký xong.
Bên nhận tiền mặc định là **tổ chức** (`payee_side = 'org'`).

**Mẫu hợp đồng `HDMB-MAU-2026-09` CHƯA được rà soát pháp lý** — như `HDDV-MAU`
và `BBDG-MAU`. Ngoài phạm vi: người trả giá liền kề (Điều 51), huỷ kết quả đấu
giá (Điều 72), công chứng (chỉ ghi nhận), sổ thanh toán tổ chức→bên bán.
