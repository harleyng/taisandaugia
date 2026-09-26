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

## Thành viên không gian chủ tài sản (`asset_owner_workspace_members`, 2026-09-26)

A workspace (`asset_owner_workspaces`) can have many members (`20260926000001`, Phase 2 of `docs/owner-control-tower-plan.md`). The membership row IS the role assignment. Unlike the auction-org portal, there are **3 fixed roles and no permission matrix**:

| `role` | UI | `owner_ws_can` actions |
|---|---|---|
| `owner` | "Trưởng đơn vị" | `read`, `write`, `manage_members`, `manage_workspace`, `send_report` |
| `staff` | "Cán bộ" | `read`, `write` — writes limited to `branch_scope` via `owner_ws_branch_ok` |
| `viewer` | "Người xem" | `read` |
| *(not a member)* | — | `read` only if the caller is an active **owner** of this workspace's linked HQ (`parent_workspace_id`, Phase 14). `owner_ws_role` stays members-only |

The client mirror is `src/lib/ownerWorkspace/roles.ts` (`ownerWsCan`, `canWriteClaim`). It only hides buttons; RLS/RPC decide. Change the SQL matrix ⇒ change the mirror.

- Gate by `owner_ws_can(workspace_id, action)` / `owner_ws_role(workspace_id)` / `owner_ws_branch_ok(workspace_id, branch_id)`, all SECURITY DEFINER, and **only `status='active'` counts**. Non-members get `false`, never NULL.
- `branch_scope` NULL = whole workspace. `'{}'` is forbidden, and an owner is never scoped (CHECKs). Every element must be a `workspace_branches.id` of the same workspace (guard trigger). A record with `branch_id` NULL is off-limits to scoped staff. Reads stay workspace-wide.
- Every workspace gets its owner row automatically: `AFTER INSERT` trigger `owner_ws_seed_owner_member`. Never insert it by hand.

**Invariants enforced in the database:**
- ≥ 1 active owner always, including against service_role: trigger `owner_ws_protect_last_owner`. The only exception is a cascade DELETE, when the workspace or profile is already gone.
- Only an active owner may grant or revoke `owner`, including status changes on an owner row: trigger `owner_ws_members_guard`. Exceptions:
  - `auth.uid()` NULL (migration / service_role);
  - the **bootstrap** insert of the first owner for `owner_user_id`, which runs under the approving admin's JWT.
- `workspace_id` / `user_id` of a member row are immutable.

**Write matrix (Phase 3, `20260926140447`).** No policy uses `owner_user_id` any more; it only means "creator". A removed creator loses all access.

| Data | Read | Write |
|---|---|---|
| `asset_owner_workspaces` | `read` | UPDATE only, `manage_workspace`, and only the columns `primary_name / abbreviations / branch_names` (column GRANT). INSERT only via the KYC-approval trigger. |
| `workspace_branches` | `read` | `manage_workspace` |
| `asset_owner_claims` | `read` | `owner_ws_claim_write_ok(workspace_id, asset_owner_id)` = `write` + branch scope. A claim's branch is the `workspace_branches` row of the same workspace with the same `asset_owner_id`; no such row ⇒ unscoped writers only. |
| `run_workspace_match` | — | `manage_workspace` or ADMIN (`auth.uid()` NULL still passes; not executable by anon) |
| `asset_owner_workspace_members` | own row, or a **direct** member (`owner_ws_role IS NOT NULL`, Phase 14 — linked HQ does not see branch members; same for `owner_ws_list_members`) | **RPC only** — no direct write policies |

**Invitations** (`asset_owner_workspace_invites`, copy-link only — no email channel):
- Roles `staff` / `viewer` only. A second owner is made with `owner_ws_update_member` after the person has joined.
- Valid 7 days. One pending invite per (workspace, email). An expired one is auto-revoked when the same email is invited again.
- Accept (`owner_ws_accept_invite`) requires:
  - the email to match **exactly** — `lower(btrim(profiles.email))`, no "continue anyway" (unlike org invites);
  - `profiles.activated`;
  - a profile that is not locked;
  - an inviter who is still an active owner;
  - branch scope that is still valid — never widened to NULL.
- A `removed` row is deleted and re-inserted on re-join.
- Demoting or removing an owner revokes the pending invites they sent.
- Email confirmation is off, so matching the email does not prove mailbox ownership: **the link is the secret**.
- RLS: only `manage_members` can SELECT invites (they carry the token). The accept page uses `owner_ws_invite_preview` (anon), which returns no id, token or workspace_id.
- `owner_ws_update_member` / `owner_ws_remove_member`: `manage_members`, active rows only, never yourself. They lock the workspace row first, because the last-owner trigger counts without locking.

**FE:**
- `useOwnerWorkspace()` (`src/hooks/useOwnerWorkspace.ts`) is the only way to find the workspace: active memberships of the user plus the stored selection. Since Phase 4 the selection is a **tenant** (`pickTenant`, default order: owner-role workspace → Cá nhân → staff/viewer workspace). On "Cá nhân", `workspaceId` is null, and workspace-only pages render `OwnerNoWorkspaceState`.
- Pages that need the workspace of a specific KYC (onboarding) match `workspace.org_kyc_id`, not the current selection.

---

## Chi nhánh tự onboard — KYC rút gọn (`kyc_scope = 'branch'`, 2026-09-26)

Phase 13 of `docs/owner-control-tower-plan.md`, migration `20260926145010`. A bank / AMC **branch** gets its own "Trạm Điều Hành" that holds **only that branch's assets**.

**Two workspace kinds** (`asset_owner_workspaces.match_scope`):

| `match_scope` | Created from | Matching (`run_workspace_match`) |
|---|---|---|
| `names` | KYC `kyc_scope='organization'` | fuzzy by `primary_name + abbreviations + branch_names` (unchanged) |
| `entity` | KYC `kyc_scope='branch'` | ONLY listings with `listings.asset_owner_id = workspace.asset_owner_id`, claimed `auto_claimed` / `linked_entity`. Seeds are ignored even if the owner edits them |

- `asset_owner_workspaces.asset_owner_id` = the registry entity the workspace stands for (HQ or branch; NULL when the name was typed). Clients cannot update it or `match_scope` (P3 column GRANT).
- **One `entity` workspace per branch** (partial unique index). A second officer of the same branch must be invited, not KYC'd: `branch_workspace_exists`.
- On approval the entity gets one `workspace_branches` row (outcomes / `branch_scope` need it).

**Branch KYC documents (decision D3):**
- **Required:** official email (well-formed), "Giấy giao việc / Uỷ quyền của Giám đốc chi nhánh" (`authorization_doc_url`), and the officer's name, title, ID number and 2 ID photos.
- **Optional:** establishment decision / branch registration, selfie, branch tax code.
- A free-mail domain (gmail…) is **flagged** on the admin screen, never blocked.
- Client rules: `validateOrgKycForm` in `src/lib/assetOwnerKyc/orgKycValidation.ts`.
- Server trigger `asset_owner_org_kyc_branch_guard` only enforces what decides data scope: parent present, entity ≠ parent, entity's existing parent = declared parent, typed name ≠ parent name, letter present, email valid, no existing branch workspace. It fires when the status **moves to** `pending_review` (INSERT too). Organisation-scope KYC is untouched.

**Parent / entity resolution:**
- Picking a registry row that has `parent_owner_id` ⇒ branch mode automatically, with the parent taken from the registry.
- Otherwise the officer ticks "Đơn vị tôi là chi nhánh" and picks the parent.
- **Branch not in the registry:** created on approval under the declared parent with `parent_source='confirmed'` (a same normalised-name row is reused). Its id is written back to `linked_asset_owner_id`.
- An entity with no parent gets the declared parent (`'confirmed'`) on approval. A different existing parent ⇒ `branch_parent_mismatch`.

**Manual claims in an `entity` workspace** (trigger `owner_ws_claims_entity_guard`):
- Allowed only for listings owned by the branch, by its parent (crawled listings often carry the HQ name), or by nobody. Sibling or unrelated owners ⇒ `claim_outside_branch`.
- The claim's `asset_owner_id` is forced to the listing's owner. Admin and `auth.uid()` NULL bypass.
- `syncFromClaims` only syncs the branch itself.

**UI:**
- Admin list shows "Chi nhánh · «mẹ» · hồ sơ rút gọn". The detail page shows `OrgBranchReviewInfo`: parent, entity + own listing count, free-mail flag.
- The portal's alias tab becomes `BranchEntityScopePanel` (no alias editor).
- DB error codes are mapped to Vietnamese by `mapOrgKycError`.

---

## Hồ sơ số hoá theo tenant — `asset_postings.workspace_id` (2026-09-26)

Phase 4 of `docs/owner-control-tower-plan.md` (`20260926152759`). A user of the owner portal has several **tenants**: each active workspace membership, plus **"Cá nhân"** (personal KYC approved, or they still own postings with `workspace_id` NULL). A posting is created in the tenant that is currently selected. Lists, badges and summaries show only that tenant.

| Posting | Read | Write (edit, send RFQ, pick a quote, contract owner side, add-ons, cancel) |
|---|---|---|
| `workspace_id` NULL ("Cá nhân") | creator only | creator only |
| `workspace_id` set | any active member (`owner_ws_can … 'read'`) | `owner` / `staff`, plus `owner_ws_branch_ok(ws, branch_id)` |

- **One gate:** `owner_posting_row_can(ws, branch, user, action)` / `owner_posting_can(posting_id, action)`. Every child table, storage policy and owner RPC goes through it.
  - `user_id` (and `consignment_contracts.owner_user_id`, `auction_sale_contracts.seller_user_id`) now means only "created by / selected by". It is **never** the access check for a workspace posting.
  - A creator removed from the workspace loses all access, including as seller on sale contracts.
- **Client mirror:** `canWritePosting` in `src/lib/ownerWorkspace/roles.ts` (tests in `roles.test.ts`).
  - `useOwnerWorkspace().canWritePosting(p)` uses the membership of **the posting's own workspace**, not the currently selected tenant.
  - It only hides buttons, through `PostingAccessContext` (`src/components/asset-posting/postingAccess.ts`).
- **Branch** (`branch_id`):
  - A composite FK to `workspace_branches (workspace_id, id)` guarantees the branch belongs to the same workspace. `CHECK`: a personal posting has no branch. Deleting a branch sets it to NULL.
  - Scoped staff must pick a branch in their scope (wizard `requirements(…, { branchRequired })`). A posting without a branch is off-limits to them.
- **Immutability:** `user_id` and `workspace_id` cannot change after insert (trigger `asset_postings_owner_guard`, RAISE). There is no tenant-to-tenant move yet.
- **Owner party (Bên A)** comes from **the posting** (`consignment_posting_owner_party`):
  - workspace posting → the workspace's approved org KYC;
  - personal posting → **only** the creator's personal KYC;
  - neither → `unknown`, which blocks the draft via `party_incomplete`.
- **Address:**
  - Address edits: personal → `owner_update_kyc_address('individual')`; workspace → `owner_ws_update_org_address` (`manage_workspace`).
  - `owner_update_kyc_address('organization')` refuses a KYC that has a workspace unless the caller has `manage_workspace`.
  - Members read the address through `owner_posting_party_address` (address only, no ID numbers).
- **Money:** credits for add-ons are charged to the **acting** user's own wallet (D1). Paying a quoted service order (VR / giám định / tư vấn) is **requester-only** (`_settle_*`, `useCheckoutItem`); other members see "Chờ người gửi yêu cầu thanh toán".
- **Summaries:** `owner_consignment_summary(p_workspace_id)` / `owner_sale_contract_summary(p_workspace_id)`: NULL = personal. Actions (badges) are shown only for rows the caller can write.
- **Files:**
  - Members read a colleague's `asset-docs` file only if a posting of their workspace references it (proofs, docs, legal-consult submissions) **and** the file's root folder belongs to a member of that workspace. The org side follows the same rule.
  - Owners can no longer update or delete `asset-docs` / `asset-media` objects.
- **Approved org KYC** can no longer be edited or deleted by its creator (the policy blocks UPDATE/DELETE on `status='approved'`). The workspace depends on it.
- **Backfill rule** (one-off): a user with a personal KYC keeps postings as "Cá nhân" unless a live contract names an organisation party.

---

## Giá trúng hợp nhất — `owner_asset_outcomes_resolved` (2026-09-26)

The owner portal's winning price and "sold / not sold" come from **one** SECURITY DEFINER RPC, `owner_asset_outcomes_resolved(p_workspace_id)` (`20260926134757`, Phase 5 of `docs/owner-control-tower-plan.md` §A3; owner self-reports added in `20260926140659`, Phase 6). It returns one row per claimed listing (`auto_claimed | pending_confirmation | confirmed`). The frontend never merges sources itself: it reads `resolvedOutcome` via `useOwnerAssetOutcomes` and uses `isSoldRow` from the metrics hook.

| Rank | Source | `confidence_label` · UI |
|:-:|---|---|
| 1 | Latest lot on the platform for the listing: session `published`/`cancelled`, lot `closed`/`withdrawn`, price = sale contract `price` or else `winning_amount` | `platform` · "Sàn xác nhận" |
| 2 | Owner self-report (`owner_asset_outcomes`, latest round) that **matches** a non-CRAWLED `org_auction_records` row: same round, same outcome, and for sold both prices within 1% | `reconciled` · "Đã đối chiếu" |
| 3 | Owner self-report with minutes attached (`evidence_urls` not empty) | `owner_evidence` · "Tự khai · có biên bản" |
| 4 | Any other owner self-report; `org_auction_records` with `is_successful` set (a row with `source='CRAWLED'` drops to rank 5) | `self_reported` · "Tự khai" |
| 5 | Crawled listing: parsed `winning_price`/`win_price`, **or** `listings.status='SOLD_RENTED'` (no price) | `estimated` · "Ước tính" |

- **Owner self-reports:** only the **latest round** per listing (highest `round_no`) is a candidate. Older rounds are history, so a round-1 "unsold" with minutes can't outrank a round-2 "sold".
- **Winner:** the **current round** comes first: candidates dated within 7 days of the listing's newest candidate date, or with no date. Inside it, lowest rank wins, then the newer date, then source order `platform` → `owner_report` → `crawled` → `org_report`. So the owner's own number wins a rank-4 tie on the same date. Outcome, price, date and `payment_status` all come from that one candidate. A lower-ranked source never fills in a missing price.
- **`has_conflict`:** another candidate from the **same round** (dates ≤ 7 days apart, or a date missing) either has a different outcome, or is also sold with a price more than 1% away. Different rounds are not a conflict.
- **Dismissed sources (Phase 8, `20260926145216`):** a candidate whose fingerprint `owner_outcome_source_fp(kind, ref_id, outcome, price)` is listed in `conflict_resolution.dismissed` of the unit's **latest** own record is ignored in three places: the "newest date" that defines the current round, the winner pick (it sorts after every non-dismissed candidate of the round), and `has_conflict`.
  - Platform candidates and the unit's own record can never be dismissed.
  - If the source changes its outcome or price, the fingerprint changes and the flag comes back.
  - The same-round/1% rule lives in ONE helper, `owner_outcome_disagrees(...)`. Use it; don't re-implement it.
  - `sources[]` also carries `fp`, `dismissed`, `in_round` and `disagrees` (relative to the winner). The UI only renders these flags.
- **Platform `sold` + `payment_status='defaulted'`** (the winner defaulted) is still `sold`.
- **Never returns** buyer/winner identity, OAR `internal_notes`, or `details`. Non-members get `not_authorized` (42501); `anon` has no EXECUTE.
- **The signature is frozen.** Change only the body with `CREATE OR REPLACE`. Changing the columns requires `DROP FUNCTION` + re-GRANT.
- Self-reported data never flows to `/listings` or to the public market report.

### Owner self-reports — `owner_asset_outcomes` (Phase 6)

- **Schema:** exactly §A4 of the plan. `UNIQUE (workspace_id, listing_id, round_no)` for on-platform rows. `outcome='sold'` requires `winning_price`.
- **Access:** RLS read = `owner_ws_can(ws,'read')`. Insert, update and delete = `owner_ws_can(ws,'write') AND owner_ws_branch_ok(ws, branch_id)`.
- **Trigger `owner_asset_outcomes_guard`** (BEFORE, SECURITY DEFINER; runs before RLS WITH CHECK):
  - `reported_by := auth.uid()`, and it is immutable afterwards. `workspace_id` is immutable too.
  - `listing_id` must be a live claim of the workspace.
  - `branch_id` is derived from the claim: `workspace_branches.asset_owner_id = claim.asset_owner_id`, the same rule as `owner_ws_claim_write_ok`. Since Phase 8, the separate trigger `owner_asset_outcomes_guard_scope` (it fires after `_guard` by name) **always overwrites** `branch_id` on listing rows, on INSERT or whenever `listing_id`/`branch_id` changes. Before that, a branch-scoped staff member could send their own `branch_id` for another branch's listing and pass RLS.
  - `auction_org_id` defaults to `listings.auction_org_id`.
  - Every `evidence_urls` element must be `{workspace_id}/{id}/…` **and** exist in `storage.objects`.
- **Evidence:**
  - Private bucket `owner-outcome-evidence` (PDF/JPG/PNG, ≤ 10MB), policies via `owner_outcome_evidence_ok(name, 'read'|'write')`. There is no UPDATE policy.
  - The column name says URLs but it holds **paths**; open them with `createSignedUrl`.
  - Write order: insert row → upload → set `evidence_urls`.
- **`failure_reason`** holds a code for the quick picks (`no_registrants | single_bidder | deposit_forfeited`), or the free text typed for "Khác". Read it back with `unsoldReasonLabel()`.
- **Client:**
  - `useReportOwnerOutcome` invalidates `qk.ownerAssetOutcomes` (which also drives the KPI) and `qk.ownerOutcomeRounds`.
  - The default round is the highest reported round + 1.

### "Kết quả phiên" — `/chu-tai-san/ket-qua` (Phase 8, `20260926145216`)

- **One row per asset that has a result:** RPC `owner_outcomes_overview(p_workspace_id)` (SECURITY DEFINER, `read`).
  - On-platform rows are the rows of `owner_asset_outcomes_resolved` with a non-NULL outcome. Branch comes from the claim; the starting price is `listings.price` only when `price_unit='TOTAL'`.
  - Off-platform rows are the **latest round** per `title_key`, where `listing_id IS NULL AND asset_posting_id IS NULL`. Label `owner_evidence`/`self_reported`, never in conflict.
  - Never joins `asset_postings`: postings have no `workspace_id` before P4, so the DEFINER function would leak titles.
  - Totals and period filters are computed client-side over these rows (`src/lib/ownerOutcomesOverview.ts`, `src/lib/ownerPeriods.ts`); the frontend still never merges sources. Period = `resolved_date`, inclusive. Undated rows appear only under "Tất cả thời gian".
- **Off-platform asset identity:** `title_key` is a STORED generated column: lower + NFC + whitespace/NBSP collapsed + trimmed.
  - Unique index `(workspace_id, title_key, round_no)` for off-platform rows.
  - Rounds of the same asset must use the same name. "hoà" and "hòa" count as two assets.
  - `CHECK outcome_title_len` requires 3–300 characters. The guard trims and collapses `asset_title`.
- **Asset ID shown in lists:** the first 8 hex characters of `listings.id`, upper-cased (`shortAssetId`), shown as "Mã 3F9A12BC" on Tài sản and Kết quả phiên. Listings have no code column; this ID is what the Excel import matches.
- **Excel import — `owner_import_outcomes(p_workspace_id, p_rows jsonb)`:**
  - SECURITY INVOKER, so RLS and both guards apply as for manual entry. Requires `write`; at most **500** rows per call.
  - One savepoint per row; returns `[{idx, ok, id | code, message, constraint}]`, so one bad row never blocks the others.
  - Forces `source='owner_import'`, no evidence, `share_to_market=false`. Listing rows get NULL title/category/branch.
  - Client matching (`classifyOutcomeRows` in `src/lib/ownerOutcomeImport.ts`):
    - A **code that matches nothing is an error**, never an off-platform asset.
    - With no code, a name that matches exactly one live claim (accent-insensitive) links to it; several matches are an error; no match becomes off-platform.
    - A row with no result is skipped. An unknown branch, organisation or category is a warning only.
    - Blank round = 1, so re-importing the same file fails row by row with 23505 instead of duplicating.
- **Conflict handling — `owner_outcome_resolve_conflict(ws, listing, choice, source_fp)`:** SECURITY INVOKER. It reads sources through the DEFINER RPC and writes only the unit's own record, under RLS. Returns `{ok, reason}`, so callers must check `ok`.
  - `keep_mine` needs an own record in the current round and no disagreeing platform result (`platform_disagrees`).
  - `use_source` copies that source's outcome and price, updating the current-round own record or inserting round max+1. A stale fingerprint gives `source_changed`.
  - Both dismiss every other non-platform source that disagrees with the kept number, in `conflict_resolution {choice, adopted, dismissed[], at, by}`; `at`/`by` are stamped by the server.
  - Editing `outcome/winning_price/round_no/auction_date` without a new resolution clears it (trigger). Payment updates keep it.
  - Nothing is sent to the auction organisation.
- **Edit / delete a round:** edit via the dialog; editing a listing row never changes the listing, starting price or branch. Delete removes the minutes files **first**, because the storage policy needs the row, then the row.
- **"Thành" counts sold rows including defaulted ones** (shown as "trong đó N người trúng bỏ cọc"). Chỉ tiêu (Phase 9) excludes defaulted rows, so its sold count is lower by that number.

### "Tổng quan" to-dos (Phase 7, formerly "Nhịp đập")

The selection rules are pure, in `src/lib/ownerPulse.ts`. `useOwnerPulse()` feeds both the dashboard blocks and the sidebar badge `owner-outcome-due`.

- **Outcome due ("Chờ khai kết quả"):**
  - The claim is `auto_claimed | confirmed`. `pending_confirmation` is left to the "Chờ xác nhận" block.
  - The auction has passed: a timestamp must be earlier than now; a date-only value becomes due from the next day.
  - There is either no resolved outcome, or the resolved outcome is dated **more than 7 days before** the auction day. That means an earlier round of a re-auction. An outcome with no date counts as covering the round.
- **Awaiting payment ("Chờ thu tiền"):**
  - Resolved outcome `sold` with `payment_status ∈ {pending, partial}`.
  - It can be written **only** when the winning source (`sources[0]`) is `owner_report`. Its `refId` is the `owner_asset_outcomes.id`.
  - On-platform lots are read-only: their money lives in the sale-contract ledger on the seller side.
- **Payment writes are cash entries (Phase 15a, see "Dòng tiền" below).** The buttons never write `paid_amount` / `paid_at` any more:
  - "Đã thu đủ" calls `owner_cash_settle`, which inserts one `payment` entry for exactly winning price − collected (computed on the server under a row lock). "Hoàn tác" deletes that entry.
  - "Thu một phần" inserts a `payment` entry for the amount received **this time** (≤ what is left; equal settles it).
  - "Người trúng bỏ cọc" still sets the `defaulted` flag on the outcome and keeps the entries.
  - Every write invalidates via `invalidateOwnerOutcomes()` (`qk.ownerAssetOutcomes` + `qk.ownerOutcomePayments` + rounds).
- **Visibility:**
  - Branch-scoped staff see only their branches' to-dos.
  - Viewers see the list without buttons.
  - The badge is shown only when the user has `can('write')`.


### Chỉ tiêu — `owner_workspace_targets` (Phase 9)

A target is a recovery amount and/or a sold-asset count for one calendar period, for the whole unit (`branch_id` NULL) or one branch (`20260926145733`).

**Table**
- `period_type ∈ {month, quarter, year}`. `period_start` must be the first day of its period (CHECK `owt_period_aligned`).
- At least one of `target_amount` / `target_count` is set, and each one is > 0.
- One target per `(workspace, branch, period)`: `UNIQUE NULLS NOT DISTINCT`, so the whole-unit target is unique too.
- A branch's targets are deleted along with the branch (CASCADE).

**Access**
- Read: `owner_ws_can(ws,'read')`.
- Write: `owner_ws_can(ws,'manage_members')` exactly as the plan says. Today that is the "Trưởng đơn vị" only, the same as `manage_workspace`.
- `anon` has no table grant.
- Guard trigger:
  - `created_by := auth.uid()`;
  - `workspace_id` is immutable;
  - `branch_id` must be a branch of the same workspace.

**"Đã thu" is COMPUTED, never stored.** Its input `paid_amount` is itself a total computed from the cash entries since Phase 15a. The rule is pure, in `src/lib/ownerTargets.ts` (`recoveryOf()` + `recoveryInputsFromOverview()`). Its SQL mirror is `owner_report_recovery()` (Phase 10, periodic reports): **change both together**.
- **Input rows:** the rows of `owner_outcomes_overview`, the same rows as the "Kết quả phiên" page (Phase 8).
  - That means every claimed listing (`pending_confirmation` included) plus the latest round of each off-platform asset.
  - Only `resolved_outcome = 'sold'` counts.
- **Which period:** the auction date (`resolved_date`), with inclusive bounds. A sold row with no date (crawled `SOLD_RENTED`) belongs to no period.
- **Which branch:** the overview's `branch_id`, derived from the claim. A branch target counts only that branch's rows. The whole-unit target counts everything, including rows with no branch.
- **Amount per sold row, cash-strict (user decision, 2026-09-26):**

  | `payment_status` | Counts as "Đã thu" | Bucket |
  |---|---|---|
  | `paid` | `paid_amount ?? price` | recorded ("Đã ghi thu") |
  | `partial` | `paid_amount` | recorded; the rest of the price goes to awaiting |
  | `pending` | 0 | the whole price goes to awaiting ("Chờ thu") |
  | `defaulted` | excluded from both amount **and** count | — |
  | `null` (org/crawled source, no payment tracking) | the price | estimated ("Theo giá trúng") |

  Consequence: the target's sold count = "Kết quả phiên" sold count − defaulted rows.
- **Progress:**
  - Days left count today and the period's last day.
  - Weekly pace = remaining ÷ max(1, daysLeft/7), so the last week carries the whole gap.
  - Percentages are rounded **down**.
- **Client:**
  - `useOwnerTargetProgress()` reads `useOwnerOutcomesOverview` (shared cache) plus `qk.ownerTargets(ws)`.
  - Outcome/payment mutations already invalidate `qk.ownerAssetOutcomes`, which covers the overview.

### "Tài sản" — lifecycle stages (Phase 12, formerly "Đường ống")

`/chu-tai-san/tai-san` has a Bảng / Giai đoạn toggle (localStorage `owner-assets-view`). The kanban is **read-only** (no drag-and-drop). Rules are pure: `src/lib/ownerPipeline.ts` (stages, thresholds, rules R1–R16), `src/lib/ownerPipelineFacts.ts` (adapters + the posting select). No migration.

- **Who is on the board (current tenant):**
  - claimed listings `auto_claimed | confirmed` whose listing RLS lets through (`pending_confirmation` is NOT on the board — only a hint linking back to the table);
  - digitised postings of the tenant (`workspace_id = ws`, or personal `workspace_id IS NULL AND user_id = me`), except `status = 'cancelled'`.
  - Postings and listings are never linked ⇒ an asset that exists as both shows twice.
- **Columns (fixed order):** Số hoá → Chọn tổ chức → HĐ dịch vụ → Niêm yết → Phiên → Trúng → HĐ mua bán → Đã thu tiền, plus the failure branch Không thành / Chờ đấu lại.
- **The current round decides; pre-auction steps only count when there is no round.**
  - Sold: defaulted ⇒ Không thành; paid or sale contract done ⇒ Đã thu tiền; live sale contract or partial ⇒ HĐ mua bán; otherwise Trúng. Since Phase 15a a single deposit entry already makes the outcome `partial` ⇒ the asset moves to HĐ mua bán (accepted: the deposit normally arrives around contract signing).
  - Unsold ⇒ Không thành. Postponed / cancelled / withdrawn ⇒ Chờ đấu lại.
  - Session under way, or over with no result from any source ⇒ Phiên.
  - Announced: with an earlier round ⇒ Chờ đấu lại (**user decision 2026-09-26, "by next round scheduled"**; also when the earlier round was "sold" — the sale fell through); first round ⇒ Niêm yết.
  - No round: service contract signed ⇒ HĐ dịch vụ **until a lot is in a published session**; open contract / org chosen without contract (old data) ⇒ HĐ dịch vụ; any quote request or active "nhờ sàn" ⇒ Chọn tổ chức; else Số hoá.
- **Postings:** lots in `draft` sessions are ignored client-side (org managers/admins can read drafts through other policies). Current round = newest lot by `published_at`, then `starts_at`, then lot `created_at`; the next one is the prior round.
- **Listings:** an outcome dated > `SAME_ROUND_DAYS` (7) before the listing's auction day belongs to an older round (same rule as the RPC and Nhịp đập).
- **Days in stage / red:** calendar days since the stage's anchor date; red when **greater than** `PIPELINE_STALE_DAYS` (Số hoá 14, Chọn tổ chức 14, HĐ dịch vụ 21, Niêm yết 45, Phiên 7, Trúng 14, HĐ mua bán 30, Đã thu tiền never, Không thành 30, Chờ đấu lại 60 counted from the failed round).
- **Data:** one nested PostgREST read of `asset_postings` (requests, brokers, contracts, lots → session / lot state / sale contracts) under `qk.ownerPipelinePostings(userId, tenantKey)` = `["my-postings", …, "pipeline"]`, so every posting mutation that invalidates `qk.myPostings(userId)` refreshes it. Claims and resolved outcomes come from the page's existing queries.

### Báo cáo định kỳ — `owner_report_snapshots` (Phase 10, `20260926172328`)

A periodic report (month / quarter / year, whole unit or one branch) that a unit sends to HQ. It has 6 parts (§A5): target progress, results in the period, money (collected / awaiting / defaulted), stuck assets, next-period plan, officer's notes.

**Lifecycle**
- `draft`: the numbers are rebuilt on every open by RPC `owner_build_report_payload(ws, period_type, period_start, branch_id)` (STABLE, DEFINER, `read`). Only the period, scope and the two notes (`plan_note` "Kế hoạch kỳ tới", `notes` "Ghi chú của cán bộ") are stored.
- `final`: RPC `owner_finalize_report(id)` (DEFINER, `send_report`) rebuilds the payload **on the server**, adds `notes` + `people {prepared_by, finalized_by}` (`profiles.name`) + `finalized_at`, and freezes it in `payload`. Returns `{ok:false, reason: not_authenticated | not_found | forbidden | already_final}` — callers use `assertOwnerReportRpcOk`.
- **A final report is never edited or deleted** (user decision 2026-09-26). A correction is a new report for the same period; both stay in the list. Guard trigger `owner_report_snapshots_guard` blocks any change to a final row (even by postgres), except (a) FK `SET NULL` of `branch_id` / `created_by` / `finalized_by` when a branch or account is deleted (names stay in `payload.meta.scope` / `payload.people`) and (b) the share columns of Phase 11, which only SECURITY DEFINER RPCs can write.

**Access**

| Action | Rule |
|---|---|
| Read (list, draft preview, final) | `owner_ws_can(ws,'read')` — viewers included |
| Create / edit / delete a draft | `write` + `owner_ws_branch_ok(ws, branch_id)` ⇒ scoped staff only for their own branches, never whole-unit |
| Finalise | `send_report` (Trưởng đơn vị) |
| Client columns | Column GRANTs: INSERT `(workspace_id, branch_id, period_type, period_start, notes, plan_note)`, UPDATE `(branch_id, period_type, period_start, notes, plan_note)`. `status`, `payload`, `finalized_*`, `created_by` are server-only (`created_by := auth.uid()` in the guard). `anon` has no table or RPC access |

**Payload v1 rules** (the frontend only maps and renders — `src/lib/ownerPeriodicReport.ts`)
- Source rows = `owner_outcomes_overview` (Phase 8), the same rows as "Kết quả phiên" and Chỉ tiêu. No second source merge. A branch report keeps rows whose overview `branch_id` is that branch.
- **Period parts** (`targets`, `results`, `money`): `resolved_date` inside the period, both ends inclusive. Undated rows (crawled SOLD_RENTED) belong to no period. Money uses `owner_report_recovery` = `recoveryOf()`; results totals follow `summarizeOutcomes` (sold count includes defaulted; success rate rounded). Target % is rounded down. A whole-unit report lists the unit target and every branch target of the period.
- **State parts** are computed as of `meta.as_of` (build day, Asia/Ho_Chi_Minh): `money.carry_over` (sold before the period, still pending/partial), `stuck`, `plan`.
- **Stuck (§A5):** not sold and not withdrawn, and rounds ≥ 3 (max of `listing_price_sessions` count and own max `round_no`) **or** more than 90 days since the first known date = least(first price session, first own `auction_date`, `listings.created_at`) — user decision 2026-09-26. Off-platform assets use their rounds / first `auction_date`. This differs from the dashboard's "Tồn đọng" (≥ 2 rounds, ended), which is unchanged.
- **Plan:** targets of the next period + auctions from `as_of` to the end of the next period (published platform sessions' `starts_at`, else the listing's `auction_time/auction_date`), one row per asset, sold/withdrawn assets excluded; `stuck_unscheduled` = stuck assets with no future auction.
- **Never in the payload:** `workspace_id`, listing ids, winner identity, `evidence_urls`. Assets are identified by `asset_code` (8 hex = "Mã") + title.
- SQL ↔ TS parity was checked on 6 periods/scopes with every payment state (56/56).

**Exports:** Excel (`src/lib/ownerPeriodicReportExcel.ts`, 5 sheets, money as numbers `#,##0`, a source column on every row; drafts are named `…-ban-nhap.xlsx`). PDF = the print route `/chu-tai-san/bao-cao-dinh-ky/:id/in` + the browser's print dialog (A4, `@page` margin boxes "taisandaugia.vn · Trang x / y" in Chrome/Edge ≥ 131, logo at the end).

#### Link chia sẻ `/r/:token` (Phase 11, `20260926181355`)

A read-only public link to a **final** report for HQ. The recipient does not need an account. Page: `src/pages/SharedOwnerReportPage.tsx` (public, lazy, outside `ProtectedRoute`), with a CTA "Tháp Điều Hành" → `/lien-he?chu-de=Tháp Điều Hành`.

| Rule | Detail |
|---|---|
| Who manages the link | `send_report` only ("Trưởng đơn vị"): `owner_share_report(id, days)`, `owner_revoke_report_share(id)`, `owner_report_share_link(id)`. Reasons returned: `not_authenticated \| not_found \| forbidden \| not_final \| invalid_days` |
| **Who sees the token** | **Only "Trưởng đơn vị"** (user decision 2026-09-26). `authenticated` has column-level SELECT on every column **except `share_token`**, so the token is read through `owner_report_share_link`. Other members see `token_expires_at`, `view_count`, `last_viewed_at` only. **Never `select('*')` on this table** |
| What can be shared | Final reports only (`ors_share_final_only`: a draft has every share column empty) |
| Lifetime | 1–90 days from now (UI offers 7 / 30 / 90, default 30). Sharing again while the link is active **extends it and keeps the token**. An expired link gets a new token. Revoking clears token, expiry and `shared_*` but keeps `view_count` / `last_viewed_at` |
| Token | 32 random bytes as base64url, 43 characters (`extensions.gen_random_bytes`), partial UNIQUE index |
| Public RPC | `get_shared_owner_report(token)`, granted to `anon`, `authenticated`. Unknown, revoked or malformed token → `{ok:false, reason:'not_found'}`; past expiry → `expired` + `expired_at`. Returns only `{payload, expires_at}`: never the id, workspace, status or view count |
| Filtering | `owner_report_public_payload` = top-level whitelist (`version, meta, targets, results, money, stuck, plan, notes, people, finalized_at`) + recursive removal of keys `id`, `*_id(s)`, `winner*`, `*evidence*` (`owner_report_strip_private`) |
| View count | +1 per call **unless the caller is a direct member of the workspace** (a linked HQ owner counts — Phase 14). Every counted view checks the HQ-expansion signal (≥ 10 views). The page calls the RPC exactly once (`useSharedOwnerReport`: no retry, no refetch). Views don't touch `updated_at` (the `updated_at` trigger has `WHEN view_count unchanged`). This is a soft signal (P14): repeated anonymous opens still count |
| Privacy | `<meta name="robots" content="noindex">` on the page. `AnalyticsTracker` records the path as `/r/:id`, never the token |

## Liên kết trụ sở ↔ chi nhánh (Phase 14, `20260926185917`)

**Tree.** `asset_owner_workspaces.parent_workspace_id` (+ `parent_linked_at`), exactly **one level**: a parent has no parent, a child has no children (guard trigger `owner_ws_tree_guard` + a global advisory lock in every link RPC). Columns are server-only (no column GRANT).

**Link lifecycle** (`owner_workspace_link_requests`, history kept, status `pending → accepted | declined | cancelled`, `accepted → unlinked`):
- **HQ sends**: `owner_ws_request_link(parent_ws, child_ws)` needs `manage_workspace` on the HQ. Eligible when the HQ has an `asset_owner_id` and is not itself a child, and the child workspace's entity has `asset_owners.parent_owner_id = HQ.asset_owner_id` (`inferred` or `confirmed` — consent is what matters). The child must be unlinked with no children.
- **Branch owner answers**: `owner_ws_respond_link(request, accept)` needs `manage_workspace` on the child. Eligibility is re-checked at accept time. Accepting cancels the child's other pending requests.
- **Either owner** unlinks at any time (`owner_ws_unlink(child_ws)`). A later directory re-parent does NOT break an accepted link. A change of a workspace's `asset_owner_id` cancels its pending requests.
- Reasons: `link_forbidden | link_not_found | link_self | link_parent_not_eligible | link_not_a_branch | link_already_linked | link_already_pending | link_child_has_children | link_not_pending | link_not_linked`. Messages are in `src/lib/ownerWorkspace/errors.ts`.
- Requests table: SELECT only for **direct** members of either side, no write policy. Page `/chu-tai-san/lien-ket`, nav badge = pending requests for the branch owner.

**What a linked HQ sees.** HQ **owners** (not HQ staff/viewers) get `read` on the child through `owner_ws_can`, so they get everything gated by `read`: claims, outcomes + evidence files, targets, report snapshots, postings and their child tables, consignment/sale contracts (including buyer data), posting documents (`owner_asset_doc_readable`), and the resolved/overview/report RPCs.
- They **never** get: the branch member list, any write/manage/`send_report` action, the link inbox of the branch, or the benchmark.
- Nothing is visible before the branch accepts.
- FE: `useOwnerWorkspaceMemberships` appends linked children as `{role:'viewer', accessVia:'hq', memberId:null}`. A direct membership wins over an `hq` entry, and `hq` entries rank last in `pickTenant`. Label "Trụ sở · chỉ xem".

**Anonymous benchmark** (`owner_ws_benchmark(ws)`, direct members only — otherwise HQ could subtract linked children's real numbers from the aggregate and recover unlinked branches):
- Peers = workspaces whose entity has the same `parent_owner_id`, one per entity, self included. Window = 12 months by `resolved_date`, from `owner_outcomes_overview_core`.
- Success rate = sold / rows with an outcome (same definition as "Kết quả phiên" and the periodic report, **not** the KPI tile). A peer needs ≥ 3 results.
- Days to sale = median(`resolved_date − first known date`, clamped at 0) over listing-backed sold assets. The first-known formula is the P10 one — a 3rd copy, change them together. A peer needs ≥ 3 sold.
- Per metric: < 3 peers with a value ⇒ hidden; 3–4 ⇒ only better/same/worse vs the median (3 values plus their quartiles would reveal each branch); ≥ 5 ⇒ adds p25/p50/p75 (success rate rounded to 5 points, days to 1). Never ids, names, min, max or rank.
- `owner_asset_outcomes_resolved_core` / `owner_outcomes_overview_core` have no permission check and no client EXECUTE. The public functions are thin wrappers with frozen signatures.

**Sales signal → lead `source='owner_hq_expansion'`** (label "Tín hiệu Tháp Điều Hành"):
- Fires when ≥ 3 distinct child entities of one parent have a Trạm (triggers on workspace insert/entity change and on `asset_owners.parent_owner_id` change, with an advisory lock per parent), or when one report link reaches ≥ 10 counted views.
- **At most one lead per parent entity, ever**: partial UNIQUE `(prospect_id) WHERE source='owner_hq_expansion'` + `ON CONFLICT DO NOTHING`. A trigger locks `source` / `prospect_*` of such a lead (and forbids turning another lead into it). CHECK: it must point at an `asset_owners` row.
- A separate lead is created even if a `market_data` lead exists for the same bank (user decision). Its code is quoted in the note.
- `lead_type` is `bank` when `owner_kind='bank_credit'`, else `asset_owner`. Failures only raise a WARNING: they never break KYC approval or a public report view.
- Lead sources `market_data`, `asset_brokerage`, `owner_hq_expansion` are system sources (`SYSTEM_SOURCES` in `src/lib/leads/leadStatus.ts`) and cannot be picked manually.

---

## Dòng tiền — `owner_cash_events` (Phase 15a, `20260926223747`)

Page `/chu-tai-san/dong-tien` ("Điều hành" group, icon Wallet). Money of a self-reported outcome is a list of **dated entries**; the old columns on `owner_asset_outcomes` are **computed totals**.

| `kind` (UI) | Direction | Counts toward "collected" (`paid_amount`) | Allowed on |
|---|---|---|---|
| `deposit` "Tiền đặt trước" | in | + | any outcome (a forfeited deposit stays the owner's money) |
| `payment` "Tiền thanh toán" | in | + | `outcome='sold'` only (checked on insert / kind change; a later sold → other flip is NOT blocked, the ledger flags it "Kết quả đã đổi") |
| `refund` "Hoàn trả" | out | − | any outcome |
| `fee` "Phí & chi phí" | out | no (→ `auction_fee`) | any outcome |

**Computed columns** (trigger `owner_asset_outcomes_money`, the ONLY place they are computed; it fires after the `_guard*` triggers):
- `paid_amount` = max(0, Σdeposit + Σpayment − Σrefund), NULL when there is no non-fee entry; `paid_at` = latest deposit/payment day; `auction_fee` = Σfee.
- `payment_status`: non-sold ⇒ `pending`; sold ⇒ `defaulted` if that flag is set (the only manual value, sticky until the client writes another value), else `paid` (collected ≥ winning) / `partial` (> 0) / `pending`.
- A direct client write of `paid_amount` / `paid_at` / `auction_fee` raises P0001 ("Số đã thu được tính từ sổ thu chi…"). Editing the winning price or outcome recomputes the status.
- Every entry change touches the parent (`owner_cash_events_sync`, DEFINER so RLS cannot silently skip it). The touch never clears `conflict_resolution`.
- `payment_due_on` (new, writer-editable): due date of the winner's payment; must be ≥ `auction_date` when it is set/changed (checked in the trigger, not a CHECK — 23514 is mapped to "thiếu giá trúng" on this table). NULL ⇒ auction day + 30 (same as the platform's `payment_due_at`).

**Entries table** — no `branch_id` column: the branch always comes from the parent outcome.
- Read: `owner_ws_can(ws,'read')` (linked HQ owners included). Insert / update / delete: `owner_cash_event_ok(outcome_id,'write')` = `write` + `owner_ws_branch_ok` on the parent.
- **Editable and deletable** (user decision 2026-09-26, no reversal ledger); `created_by` / `updated_by` / timestamps are stamped by the guard; FK to profiles is `SET NULL` (deleting an account never deletes money records). Deleting an outcome round cascades its entries (the delete dialog warns).
- Column GRANTs: INSERT `(outcome_id, kind, amount, occurred_on, note)`, UPDATE `(kind, amount, occurred_on, note)`. Build payloads only with `toCashEventInsert` / `toCashEventUpdate` (`src/lib/ownerCashEvent.ts`).
- `occurred_on` ≤ today (Asia/Ho_Chi_Minh). `amount` > 0, whole VND.

**RPCs**
- `owner_cash_settle(outcome_id, day?)` — INVOKER; `SELECT … FOR UPDATE` (the outcomes UPDATE policy is the gate) then one `payment` entry for the remainder. `{ok:false, reason: not_authenticated | not_found | not_sold | defaulted | already_paid}`.
- `owner_cash_flow(ws, include_linked)` — STABLE DEFINER, 42501 without `read`. Units = self + (if asked) children with `parent_workspace_id = ws` that the caller can read. Returns `as_of` (VN today), `units`, `rows` (= `owner_outcomes_overview_core` per unit, trimmed), `events` (asset reference from the entry's OWN outcome row, so older rounds stay visible), `upcoming` (**copy #2** of the P10 "plan" rule, window today…+60 days — change both together).
  - Names of who recorded an entry only when the caller is a **direct** member of that unit (`owner_ws_role`); a linked HQ never sees branch staff names. Never user ids, winner identity or evidence paths.
- `owner_outcomes_overview_core` now returns `paid_amount` for listing rows **only when the winning source is the unit's own record** (`sources[0].kind='owner_report'`). Before, a platform result that outranked a tracked own record leaked the own record's cash into Chỉ tiêu / reports.

**Three meanings of "collected" — never mix them**
1. Hero "Thực nhận trong kỳ" = entries by **cash date** (`occurred_on`) in the period: in − refunds − fees.
2. Waterfall "Thác tiền các phiên bán trong kỳ" = tracked (`best_kind='owner_report'`), sold, non-defaulted assets whose **auction date** is in the period; collected/awaiting per row via `recoveryOf()` (so it matches Chỉ tiêu restricted to tracked rows); fees = fee entries of those assets across all rounds; missing starting price ⇒ counted as the winning price (footnoted).
3. Chỉ tiêu / periodic report "Đã thu" = every sold asset by auction date, untracked sources at their price, before fees, defaulted excluded (unchanged).
- Platform-sold assets are **not tracked** here (banks cannot read the sale-contract ledger of `org_on_behalf` lots): shown as one info line "Sàn theo dõi thanh toán". Sold assets won by org/crawled sources get the CTA "Khai kết quả để theo dõi thu tiền" — only for viewers who can write that asset in their own unit.

**Forecast** (`src/lib/ownerCashFlow.ts`): buckets Quá hạn / ≤ 30 / 31–60 / 61–90 days from `as_of`.
- Owed = remaining of each tracked sold non-defaulted asset at its due date (`payment_due_on ?? date + 30`).
- Estimate (hatched, labelled "Ước tính") = upcoming auctions × the unit's 12-month success rate (sold / results, `summarizeOutcomes`), needs ≥ 3 results; cash expected 30 days after the auction; never "overdue".

**Tháp Điều Hành.** `ownerPortalName()` (`src/lib/ownerWorkspace/roles.ts`, hook `useOwnerPortalName`) shows "Tháp Điều Hành" in the sidebar, tab title and error boundary when the selected workspace has a linked child the user reads (HQ owners only), else "Trạm Điều Hành". On Dòng tiền the HQ gets a scope select "Toàn hệ thống / each unit" and a "Theo đơn vị" table; branch rows are read-only.

**Credits:** the page charges nothing. Decision D1 = shared workspace wallet, built in Phase 15d; until then P4 add-ons still use the acting user's wallet.

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

## Model 3D của hồ sơ số hoá (chủ tài sản → trang lô công khai)

Bảng `asset_3d_scans` (`20260915000001`); "lô nháp" = một dòng `asset_postings`, `lot_id` = `asset_postings.id`.

- **Vòng đời phiên quét:** `awaiting_scan → processing → ready`, hoặc `failed` / `expired` (quá `expires_at` = tạo + 24h, đánh dấu lười khi chủ tài sản bấm quét lại). Model mới `ready` đẩy model cũ sang `superseded`. Mỗi hồ sơ tối đa MỘT phiên đang chạy và MỘT model hiện hành (unique partial index).
- **Giá:** biến thể `scan_3d_owner` (mặc định 30 credit). Trừ ATOMIC trong `start_asset_3d_scan`; bấm lại khi đang có phiên chạy ⇒ trả phiên cũ, KHÔNG trừ thêm. Ledger `scan_3d` (−) / `scan_3d_refund` (+). Hoàn đủ khi đối tác báo lỗi hoặc hết hạn, đúng một lần (`refunded_at`). Model về sau khi đã hoàn ⇒ từ chối (`invalid_status`).
- **BR-3D-02:** attach/fail/processing từ chối `lot_mismatch` nếu `lot_id` ≠ hồ sơ của phiên quét; idempotent theo `external_job_id` (gửi lại cùng job = no-op, job khác = `job_mismatch`).
- **BR-3D-01:** `published_at` bật khi `review_status` chuyển sang `approved`, tắt khi rời `approved` (kể cả guard tự đá về pending lúc chủ sửa hồ sơ). Model về sau khi hồ sơ đã duyệt ⇒ ẩn tới khi admin có quyền `tai-san-tu-nguyen:approve` bấm duyệt (`admin_publish_asset_3d_model`).
- **BR-3D-03:** công khai CHỈ qua RPC `public_session_lot_3d_models(session)` — phiên `published|cancelled`, hồ sơ `approved`, model `ready` + `published_at`. Nhãn "3D" + nút "Xem 3D" (dialog Ảnh/3D) ở `SessionLotList`.
- **RLS:** chủ tài sản ĐỌC dòng của mình, admin đọc qua quyền view; KHÔNG policy ghi — mọi ghi qua RPC / webhook.
- **Đối tác:** hiện là giả lập (`partner='mock'`). Deeplink dựng ở `src/lib/scan3d/partner.ts` (điểm nối duy nhất). Webhook thật: `supabase/functions/scan3d-webhook` (HMAC, header `X-Scan3D-Timestamp` / `X-Scan3D-Signature`).

## VR tour của hồ sơ số hoá (dịch vụ đối tác Silver Sea)

Bảng `asset_vr_tour_orders` (`20260915000010`); `lot_id` = `asset_postings.id` như 3D. Đối tác KHÔNG có tài khoản — admin thao tác thay (module `don-vr-tour`, `/admin/yeu-cau-dich-vu/vr-tour/:id`).

- **BR-VR-01 — vòng đời đơn:** `requested` (Chờ báo giá) → `quoted` (Báo giá) → `paid` (Đã thanh toán) → `scheduled` (Đã hẹn) → `delivered` (Đã giao) → `attached` (Đã gắn lô); nhánh `cancelled` (chỉ khi CHƯA trả — hoàn tiền ngoài phạm vi) và `superseded` (tour cũ khi gắn tour chụp lại). Trạng thái không bao giờ lùi. Mỗi hồ sơ tối đa MỘT đơn đang chạy và MỘT tour `attached` (unique partial index). CHECK theo trạng thái ép đủ cột (giá, mã giao dịch, lịch hẹn, link https, dòng hoa hồng).
- **Báo giá riêng từng đơn:** gói (`vr_tour_basic|standard|factory|collection`) chỉ mang giá "từ"; admin báo giá thật (`admin_quote_vr_tour`, hiệu lực 1–60 ngày, báo lại được khi chưa trả). Thanh toán VNPay mô phỏng `pay_vr_tour_order` → `_settle_vr_tour_order`: idempotent theo `payment_claims`, từ chối `quote_expired` và `quote_changed` (số tiền người bán thấy ≠ `quoted_price`).
- **BR-VR-03 — hoa hồng:** `admin_deliver_vr_tour` ghi ĐÚNG MỘT dòng `orders` (kind commission, `gross_amount` = giá báo, `amount` = phần sàn do trigger tính, snapshot điều khoản + `contract_id/contract_line_id`) theo hợp đồng hiệu lực TẠI NGÀY GIAO. Không có hợp đồng ⇒ chặn `no_contract_terms` (KHÔNG ghi 0% như hồ sơ tham gia). Gửi lại cùng link = no-op. Tiền giai đoạn paid→delivered chưa vào sổ `orders`; sổ công nợ sàn→đối tác chưa có.
- **BR-VR-02 — công khai:** gắn vào lô cần `tai-san-tu-nguyen:approve` VÀ hồ sơ `approved` (`posting_not_approved`). Đơn `delivered` KHÔNG tự gắn khi hồ sơ được duyệt. `published_at` của tour đã gắn bám `review_status` (trigger `asset_postings_vr_sync_publish`, WHEN OLD≠NEW) — chủ sửa hồ sơ ⇒ ẩn, duyệt lại ⇒ hiện.
- **BR-VR-04:** công khai CHỈ qua RPC `public_session_lot_vr_tours(session)`; nhãn "VR" + nút "Xem VR tour" (tab VR trong `Lot3dDialog`) ở `SessionLotList`; nhãn "VR" ở danh sách hồ sơ chủ tài sản + bảng admin.
- **Bí mật thương mại:** điều khoản hoa hồng KHÔNG nằm trên bảng đơn (chủ đọc được dòng của mình). Gói/đối tác cho người bán đi qua `public_vr_tour_packages` / `public_vr_tour_partners` vì dịch vụ commission bị ẩn khỏi public read.
- **RLS:** chủ đọc dòng của mình; admin đọc qua `don-vr-tour:view` HOẶC `tai-san-tu-nguyen:view`; KHÔNG policy ghi.

## Giám định tài sản (số hoá, bước 4 wizard)

Bảng `asset_authentication_orders` (`20260915000020`) + cổng (`…0021`); `lot_id` = `asset_postings.id` như 3D/VR. Tên kỹ thuật `authentication` — `pricing_mode='appraisal'` là ĐỊNH GIÁ, khác giám định. Đối tác KHÔNG có tài khoản — admin thao tác thay (module `don-giam-dinh`, `/admin/yeu-cau-dich-vu/giam-dinh/:id`).

- **Vòng đời:** `requested` → `quoted` (báo giá riêng, như VR) → `paid` → `item_pending` (gửi hiện vật: người bán nhập mã vận đơn · tại chỗ: admin hẹn lịch) → `in_review` → `completed`; "từ ảnh" đi thẳng `paid → in_review`. `cancelled` chỉ khi CHƯA trả; `superseded` = kết luận cũ khi giám định lại. Mỗi hồ sơ ≤1 đơn đang chạy, ≤1 đơn `completed`.
- **BR-GD-01:** chứng thư PDF chỉ vào qua `admin_complete_authentication` (quyền `don-giam-dinh:update`, "thay đối tác"); RPC kiểm object CÓ THẬT trong bucket private `asset-authentication-certs` tại `{posting}/{order}/…`; storage INSERT chỉ quyền đó. Ô tự khai "Đã có giấy thẩm định" đã bỏ khỏi `ANTIQUE_FIELDS`.
- **Kết luận:** `authentic` | `inconclusive` | `suspected_fake`; tiêu cực bắt buộc `verdict_reason` — thông tin RIÊNG (RLS: chủ + admin), không bao giờ ra RPC công khai.
- **BR-GD-02:** `suspected_fake` ⇒ hồ sơ về `draft` (mọi nhóm); `inconclusive` ⇒ về `draft` nếu nhóm Cổ vật. Hồ sơ `contracted` / đang trong phiên `published` ⇒ KHÔNG tự rút, trả `needs_manual_withdraw`. Kết luận tiêu cực hiện hành chặn: nộp hồ sơ nhóm Cổ vật (trigger `asset_postings_authentication_gate_*`, lỗi `GD_FAILED_CATEGORY`) và đưa lô Cổ vật vào phiên (trigger riêng `auction_session_items_authentication_gate`).
- **BR-GD-03:** bắt buộc = `_authentication_required_reasons`: `policy` (bảng 1 dòng `authentication_policy`: bật + nhóm + ngưỡng giá, mặc định Cổ vật ≥ 50,000,000₫) · `seller_restricted` (`seller_authentication_restrictions`) · `lot_flag` (`asset_authentication_requirements`). Chặn chuyển `status → active` và thêm lô vào phiên tới khi có chứng thư `authentic` (lỗi `GD_REQUIRED`). Sửa luật cần `tai-san-tu-nguyen:approve`. Hồ sơ "nhờ định giá" không có giá ⇒ chính sách không áp, admin dùng cờ lô. Wizard nhân bản ở `lib/authentication/requirement.ts` chỉ để báo trước; chứng thư chặn "Hoàn tất" chứ không chặn "Tiếp tục".
- **Mức xác minh (dẫn xuất, không lưu):** 0 · 1 chủ đã KYC · 2 hồ sơ `approved` · 3 chứng thư xác thực từ ảnh · 4 xác thực qua hiện vật/tại chỗ. SQL `asset_posting_verification_level` ↔ `lib/authentication/verificationLevel.ts`.
- **Hoa hồng:** 1 dòng `orders` lúc có kết luận (mọi kết luận — dịch vụ đã làm), theo hợp đồng hiệu lực ngày đó; thiếu hợp đồng ⇒ `no_contract_terms`.
- **Công khai:** chứng thư `authentic` hiển thị khi hồ sơ `approved` (trigger `asset_postings_authentication_sync_publish`, như VR) — KHÔNG cần bước "gắn lô" riêng. Đọc qua `public_session_lot_authentications(session)`; file đọc được bởi anon chỉ khi thuộc lô trong phiên công khai (`authentication_cert_readable`).


## Tư vấn pháp lý (số hoá, bước 3 wizard + tab `?tab=phap-ly`)

Bảng `asset_legal_consultations` (một dòng = một LẦN tư vấn) + `asset_legal_consultation_items` (checklist) — `20260915000030`. Đối tác chưa có tài khoản — admin thao tác thay (module `tu-van-phap-ly`, `/admin/yeu-cau-dich-vu/tu-van-phap-ly/:id`).

- **Vòng đời:** `requested` (người bán nộp bản chụp `submitted_doc_paths`, chỉ path `{uid}/…` có thật trong `asset-docs`) → `quoted` (admin gán đối tác có hợp đồng + `expert_name` + giá) → `paid` (VNPay mô phỏng, `?tvpl_order=`) → `in_review` (lưu nháp checklist) → `completed`. `cancelled` chỉ khi chưa trả. Rà soát lại = yêu cầu MỚI; kết quả cũ → `superseded`. Mỗi hồ sơ ≤1 lần đang chạy, ≤1 `completed`.
- **Checklist:** mục `sufficient | missing | needs_clarification`; hoàn tất đòi mọi mục đã chấm + mục khác Đủ có `required_action` ≥ 5 ký tự + `summary`. Mẫu theo nhóm cấp 1 ở `lib/legalConsult/checklistTemplates.ts` (TS, không master data); `template_key` NULL = chuyên gia thêm. Luật nhân bản `_legal_consult_replace_items` ↔ `lib/legalConsult/checklist.ts`.
- **BR-CNS-01:** không RPC/trigger nào ghi `asset_postings` — không đổi `status`/`review_status`/mức xác minh, không cổng chặn nộp. UI ghi rõ "mang tính tư vấn".
- **BR-CNS-02:** SELECT = chủ đơn OR `tu-van-phap-ly:view`; không policy ghi. Người bán chỉ đọc items khi lần tư vấn `completed`/`superseded` (nháp chuyên gia không lộ). Tệp tải thêm ở `{uid}/legal-consult/…` ngoài `ownership_proof_urls`/`doc_urls` ⇒ tổ chức có hợp đồng không đọc được. (`asset_docs_admin_read` vẫn cho mọi ADMIN đọc bucket.)
- **BR-CNS-03:** `version` gán LÚC HOÀN TẤT (max+1 theo hồ sơ, khoá dòng posting), `completed_at`; checklist bất biến sau hoàn tất (RPC chỉ ghi khi `in_review`).
- **Hoa hồng:** 1 dòng `orders` lúc hoàn tất theo `resolve_contract_terms`; thiếu hợp đồng ⇒ `no_contract_terms`. Đối tác seed `7e9a0000-…0001`, HĐ `03/2026/HĐHT-TVPL` 20%, giá gói `tvpl_review` 2,000,000₫ là GIỮ CHỖ.

## Tư vấn đấu giá (số hoá, bước 4 wizard + tab `?tab=tu-van-dau-gia`)

Bảng `asset_auction_consultations` (một dòng = một YÊU CẦU = một phiên bản tiềm năng) + `asset_auction_consult_proposals` (1:1, phương án) — `20260915000040`. Đối tác chưa có tài khoản — admin thao tác thay (module `tu-van-dau-gia`, `/admin/yeu-cau-dich-vu/tu-van-dau-gia/:id`).

- **Vòng đời:** `requested` (người bán nêu mục tiêu `fastest|max_price|balanced` + giá mong muốn / giá thấp nhất / tiến độ / hạn chót; server CHỤP hình thức, giá, nhóm, tỉnh của hồ sơ) → `quoted` (admin gán đối tác có HĐ + `expert_name` + giá) → `paid` (VNPay mô phỏng, `?tvdg_order=`) → `in_review` (lưu nháp phương án) → `completed`. `cancelled` chỉ khi chưa trả. Phương án khác = yêu cầu MỚI; bản cũ → `superseded`, vẫn xem được. ≤1 đang chạy, ≤1 `completed` mỗi hồ sơ.
- **Tham số phương án:** hình thức `truc_tiep|truc_tuyen|ca_hai`, phương thức `ascending|descending|sealed`, giá khởi điểm, giá bảo lưu (tuỳ chọn), bước giá (≤ giá KĐ), thời lượng lô 1–1440 phút (bắt buộc khi có trực tuyến), cọc `percent` (0–100] hoặc `amount` (≤ giá KĐ), lý giải ≥ 5 ký tự, `field_notes` theo khoá cố định. Bảo lưu: trả giá lên ≥ giá KĐ, đặt giá xuống ≤ giá KĐ. Cọc 5–20% chỉ CẢNH BÁO. Luật nhân bản `_auction_consult_write_proposal` ↔ `lib/auctionConsult/proposal.ts` (test đồng bộ reason với migration).
- **Riêng tư:** mục tiêu / giá mong muốn / giá thấp nhất / ghi chú chỉ người bán + `tu-van-dau-gia:view`. Người bán chỉ đọc proposals khi yêu cầu `completed|superseded` (nháp không lộ).
- **BR-CNS-04:** không RPC/trigger nào ghi `asset_postings`, `auction_sessions`, `auction_session_items` (nghiệm thu md5 trước/sau). Giá bảo lưu và phương thức khác trả giá lên KHÔNG BAO GIỜ áp dụng được vào lô (bảng công khai; engine chưa hỗ trợ) — `LOT_APPLICABLE_FIELDS` chỉ gồm giá KĐ / tiền đặt trước / bước giá.
- **BR-CNS-05:** `version` gán LÚC HOÀN TẤT (max+1, khoá dòng posting) + `expert_name`/`partner_name`/`completed_by`; proposal có `finalized_at` ⇒ trigger chặn UPDATE/DELETE.
- **Quyết định người bán:** `owner_decide_auction_consult` chỉ khi `completed` — `accepted|declined`, đổi được tới khi có bản mới; bản `superseded` đóng băng quyết định lúc đó. Chỉ lưu quyết định cuối (không lịch sử sự kiện).
- **BR-CNS-06:** tổ chức đọc qua `org_session_auction_consult_suggestions(session)` — chỉ bản `completed` + `accepted` + finalized, cho hồ sơ có request `selected` với `auction_org_id` của phiên + `consignment_contracts.status='signed'` (đúng cổng `auction_session_items_validate`); caller `can_manage_auction_sessions OR can_run_auction`; không quyền ⇒ rỗng. UI: panel "Áp dụng" từng trường ở Sửa lô / Thêm lô (override theo lô, mặc định vẫn là báo giá của tổ chức), cảnh báo lệch hình thức ở bảng lô, gợi ý thời lượng ở Mở lô (mặc định vẫn 30 phút). Giá trị đã áp dụng là bản chụp — người bán đổi quyết định sau không kéo lại.
- **Hoa hồng:** 1 dòng `orders` lúc hoàn tất theo `resolve_contract_terms`. Đối tác seed `8f2b0000-…0001`, HĐ `04/2026/HĐHT-TVDG` 20%, giá gói `tvdg_plan` 3,000,000₫ là GIỮ CHỖ. Mã đơn prefix `TD`.
