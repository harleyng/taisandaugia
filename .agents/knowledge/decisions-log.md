# Decisions Log — Tài Sản Đấu Giá (taisandaugia)

> **History file — grep, don't auto-read.** Reverse-chronological (newest first). This is the audit trail of *why*; the canonical *what* lives in the current-truth files (`architecture.md` / `business-rules.md` / `design-system.md` / `component-registry.md` / `common-pitfalls.md`). **Rule: this log records only WHY.** When a decision establishes or changes a rule, update the rule file too — if a rule lives only here, agents won't find it and it is effectively lost. Use `/log-decision`.
> Format per entry: `## YYYY-MM-DD — Short title`, then **Context** (the problem / why now), **Decision** (what we chose), **Consequences** (follow-ups, obligations, what it makes true).

---

## 2026-08-06 — Danh mục bồi dưỡng rời code thành master data; cách tính = HÌNH THỨC × VAI TRÒ

**Context:** Bản đầu hard-code 5 `cpd_kind`, xếp cứng 4 loại là "hình thức thay thế Đ26.2" ⇒ đạt bất kể giờ. Nhưng `SPEAKER` gộp làm một hai việc khác hẳn: **làm báo cáo viên** hội thảo (Đ26.2, đạt cả năm) và **đi dự** hội thảo (chỉ quy đổi ít giờ) ⇒ ai đi nghe hội thảo cũng được chấm "Đạt". Sai kết luận tuân thủ, không phải sai nhãn.
**Decision:**
- **3 bảng danh mục admin quản lý** (`20260806000040_cpd_catalog.sql`): `cpd_activity_types` · `cpd_activity_roles` · `cpd_exemption_reasons`. Trang `/admin/quan-tri/boi-duong`, module quyền mới `dm-boi-duong` (nhóm Quản trị). Báo cáo tuân thủ đổi tên thành "Bồi dưỡng chuyên môn" để hai mục không trùng tên.
- **`has_roles` bật ⇒ vai trò THẮNG hình thức.** Engine `cpd.ts` không còn biết mã nào là gì — chỉ nhận `CpdRuleResolver` và hỏi "tính giờ hay đạt cả năm". Thứ tự ưu tiên kết luận giữ nguyên trong TS; SQL `admin_cpd_report` chỉ gộp số (trả `credited_hours` + `full_year_forms`).
- **Bỏ hẳn cờ `is_accredited_provider`**, không chỉ giấu checkbox — giấu ô mà giữ cột thì bản ghi mới mặc định `false` và cảnh báo "chưa được công nhận" nổ sai trên toàn bộ dữ liệu mới. Tính được-công-nhận (Đ25) nay nằm trong TÊN hình thức `COURSE`.
- **Không snapshot: sửa quy đổi ÁP DỤNG HỒI TỐ** (chọn 3a). Đơn giản, đổi lại kết quả năm cũ — trang admin có banner cảnh báo bù.
- **Nhãn form lấy từ danh mục** (`title_label`/`org_label`/`evidence_hint`) để gỡ hết nhánh `if (kind === 'PUBLICATION')` rải trong `DossierEventDialog`.
- Bảng tuân thủ hiện **`x/8 giờ` cho mọi trường hợp** (`progressHours()`: đạt-cả-năm quy về 8/8, miễn = "Không áp dụng"); badge chỉ còn "Đạt". Hiện "0/8 giờ" cạnh trạng thái "Đạt" là mâu thuẫn trên cùng một dòng.
**Consequences:**
- **Backfill CỐ Ý ĐỔI KẾT QUẢ:** `COURSE` từ cộng-giờ thành đạt-cả-năm ⇒ **3 lượt (người × năm) nhảy Chưa đủ → Đạt** (1 ở 2025, 2 ở 2026). Đã đếm trước khi push. `SPEAKER` cũ → (Hội thảo × Báo cáo viên), giữ nguyên kết luận.
- Dữ liệu "đi dự hội thảo" trước đây không phân biệt được nên **không tự suy** — tổ chức phải tự sửa lại vai trò nếu khai nhầm.
- `cpd_kind`, `is_accredited_provider`, `exemptions.reason` thành LEGACY (giữ cột, ngừng đọc); CHECK trên `reason` phải DROP nếu không admin thêm diện miễn thứ tư là INSERT chết.
- Hồ sơ kết xuất (có tính phí) nhận danh mục qua `DossierBundle.cpdCatalog` — thiếu là in sai.
- Migration `20260806000040` ĐÃ PUSH; `types.ts` đã regenerate. Vai trò admin tùy chỉnh phải tick lại `dm-boi-duong`.

## 2026-08-06 — Trang Khách hàng dựng ngang tầm KHTN; `user_id` là cầu nối tới email marketing

**Context:** Hai đầu phễu CRM lệch nhau: `/admin/khach-hang-tiem-nang` có lọc nhiều chiều + tab pháp nhân, còn `/admin/khach-hang` — nơi lead hạ cánh — vẫn là bảng 6 cột và trang phẳng. `customers` đang có 3 cột **có schema nhưng không nơi nào đọc/ghi**: `segment`, `source_lead_id`, `user_id`.
**Decision:**
- **Thêm `customers.prospect_kind/prospect_id`, KHÔNG join ngược qua lead.** Join qua `source_lead_id` chỉ chạy với khách chuyển đổi và chết nếu lead bị xóa; cột riêng cho phép gắn pháp nhân cho cả khách nhập tay sau này. `admin_convert_lead` (`CREATE OR REPLACE` trong `20260806000010`) copy sang, nhánh gộp chỉ `COALESCE` vá chỗ trống — không đè dữ liệu admin nhập.
- **`user_id` là cầu nối DUY NHẤT tới email marketing.** `marketing_campaigns` không có `customer_id` (đối tượng nhận là người dùng sàn theo tiêu chí) — thêm cột đó sẽ tạo hai mô hình audience song song. Đi qua `campaign_recipients.user_id` thay vì bịa quan hệ mới. Gắn hai đường: RPC tự khớp email → 9 số cuối SĐT (qua `auth.users.phone`; `profiles` KHÔNG có cột phone) + `UserPickerField` gắn/gỡ tay.
- **Tab Đơn hàng gộp `customer_id` OR `user_id`.** `orders_party_check` cho phép một trong hai; bỏ vế `user_id` là ẩn toàn bộ 502 đơn nạp credit khỏi trang khách hàng.
- **Tách `ProspectAuctionHistoryTab`/`ProspectBranchesTab` sang `components/admin/crm/prospect/`** thay vì import chéo từ module leads — chúng chỉ nhận `{kind, prospectId}`, không dính gì tới lead.
- **`Customer` types dọn sang `src/types/customers.ts`**, `types/advertising.ts` re-export ngược (5 file đang import, `advertising.ts` còn `Pick<Customer,…>`).
**Consequences:**
- Route `khach-hang` nay **có** `AdminPermissionRoute` (trước không) và module khai thêm `create`/`delete` — mọi admin hiện tại là SUPER_ADMIN nên không ai mất quyền, nhưng **vai trò tùy chỉnh tạo sau phải tick lại 2 ô mới**, nếu không nút Thêm/Xóa biến mất.
- Backfill trả **0/0**: 39 lead có prospect đều là `market_data` chưa chuyển đổi, và không email khách nào khớp `profiles`. Đúng dữ liệu, không phải lỗi logic — RPC đã kiểm 4 tình huống (copy prospect / idempotent / tài khoản đã bị chiếm → `user_id` NULL / nhánh gộp) đều pass.
- **`campaign_recipients` có 36 dòng nhưng 0 dòng có `user_id`** (toàn email import ngoài) ⇒ card Email marketing sẽ rỗng cho mọi khách cho tới khi có chiến dịch giải đối tượng theo user thật. Không phải bug hiển thị.
- Backfill email có thể khớp nhầm hộp thư dùng chung (`info@congty.vn`) — chấp nhận, gỡ tay được bằng picker.
- Migration `20260806000010` ĐÃ PUSH; `types.ts` đã regenerate.

## 2026-08-06 — Bồi dưỡng chuyên môn hằng năm của đấu giá viên (TT 19/2024/TT-BTP)

**Context:** Luật buộc mỗi ĐGV bồi dưỡng ≥8 giờ/năm; tổ chức chịu trách nhiệm theo dõi. Repo chỉ có `trainingCompliance()` cộng giờ cho MỘT người, MỘT năm hiện tại, ngay trong hồ sơ cá nhân — không biết miễn trừ, không biết hình thức thay thế, nên báo "thiếu giờ" cho cả người đang tuân thủ hợp pháp. Backlog #5 của `docs/ho-so-nhan-su-dgv-spec.md`.
**Decision:**
- **MỘT engine duy nhất, neo theo NĂM DƯƠNG LỊCH** — `src/lib/personnel/cpd.ts`. Lõi `evaluateCpd()` nhận một struct ĐÃ GỘP, không nhận sự kiện thô, để portal (gộp từ events) và admin (gộp trong SQL) dùng chung đúng một quy tắc. Học từ CME của `lms-bigbro`: dự án đó có hai engine song song (trailing-window vs neo theo ngày cấp GPHN) trả `earned_hours` lệch nhau cho cùng một người.
- **Thứ tự kết luận: miễn (Đ26.3) ▸ hình thức thay thế (Đ26.2, ĐẠT bất kể số giờ) ▸ đủ 8 giờ.** Bỏ bước nào cũng ra kết luận sai luật.
- **Mở rộng `org_auctioneer_events` (3 cột), KHÔNG dựng bảng ledger song song** — sự kiện TRAINING đã có sẵn và đã được in ra 3 đường kết xuất; tách bảng phải viết lại cả ba mà không đổi lại gì. Chỉ miễn trừ tách bảng vì gắn với NĂM chứ không phải một hoạt động.
- **RPC `admin_cpd_report` trả SỐ LIỆU THÔ, không trả trạng thái.** SQL chỉ gộp, TS giữ nguyên một bản quy tắc — tránh lặp lại lỗi `sessionStatus` nhân bản SQL↔TS ở báo cáo Tin đấu giá.
- Tab "Đấu giá viên" **không cần RPC**: `*_admin_all` đã cho admin đọc thẳng. Một component `AuctioneersTab` dùng chung cho CẢ Khách hàng lẫn Khách hàng tiềm năng, nhận `AuctioneerSource` phân biệt hai lối resolve — lead trỏ thẳng bằng `prospect_id`, khách hàng phải thử ba con trỏ (`prospect_id` ▸ `source_lead_id → leads.prospect_id` ▸ `user_id → organizations.owner_id`).
- Biểu đồ báo cáo **một chuỗi/một màu**, không stack theo trạng thái: xanh cạnh hổ phách chỉ cách nhau ΔE 7.5 với người mù màu đỏ-lục (validator của skill `dataviz`).
**Consequences:**
- `trainingCompliance()` nay là wrapper mỏng — giữ chữ ký cũ cho 3 nơi tiêu thụ, nhưng **phải truyền miễn trừ vào** nếu không kết luận sai. `useDossierExports` và `usePersonnelDossier` đã nạp thêm `cpdExemptions`.
- Mã quyền mới `boi-duong` ở CẢ hai danh mục (portal + admin) — trùng tên, khác bảng, vô hại.
- **Đường nối chưa sửa:** roster `org_auctioneers` vẫn chỉ mở qua `nl-dau-gia-vien:view`, nên cấp riêng lẻ `boi-duong` cho một vai trò không có mã kia sẽ ra bảng rỗng. Backfill cố ý gắn hai mã đi cùng nhau; mục `nhan-su` cũng đang vậy.
- Admin **cố ý không thấy** CCCD và file đính kèm của ĐGV dù policy cho đọc — che ở tầng UI, không nới policy storage.
- Chưa có cron/email: cảnh báo hạn 15/12 tính phía client, hiện ở Tổng quan + trang Đấu giá viên.
- Minh chứng (Điều 27.1) dùng lại `PersonnelFileUpload` + bucket `personnel-docs`, gắn vào cả `DossierEventDialog` lẫn `CpdExemptionDialog` — hai dialog nhận `organizationId`+`auctioneerId`, thiếu một trong hai thì ẩn ô upload vì `uploadDocFile` dựng path `{org}/{auctioneer}/…` khớp policy bucket.
- Migrations `20260805000310`, `20260805000311` ĐÃ PUSH; types đã regenerate. Seed kiểm thử `20260806000020` cũng đã push — nó còn **sửa dữ liệu thật**: điền `customers.prospect_id` cho 5 khách hàng phân khúc `auction_company` (trước đó rỗng ⇒ tab luôn ra empty state).

## 2026-08-06 — Bộ lọc "Chi nhánh/AMC" dạng cây, kéo thả xếp cụm, badge trạng thái tại chỗ

**Context:** Hai bộ lọc "Đơn vị" và "Cụm" đứng cạnh nhau nhưng thực chất là hai CẤP của cùng một cây — người dùng phải tự ghép trong đầu. Xếp cụm chỉ làm được qua checkbox + menu. Trạng thái lead nằm sâu trong hộp thoại chỉnh sửa dù là thứ đổi thường xuyên nhất. Và biểu đồ "Phân bổ theo đơn vị" vỡ giao diện với tên chi nhánh ngân hàng.
**Decision:**
- **Gộp hai bộ lọc thành một `scope` mã hoá tiền tố** (`all` / `unit:<id>` / `group:<id>` / `group:none`) thay vì giữ hai trường state cho một dropdown — hai trường cho một control là nguồn sinh trạng thái mâu thuẫn.
- Cây dựng từ **chính các dòng lịch sử**, không phải từ `branches`: danh sách chỉ hiện đơn vị THỰC SỰ có tin, nên chọn mục nào cũng ra kết quả, không bao giờ rỗng. Chưa có cụm nào ⇒ danh sách phẳng, không dựng cấp thừa.
- Mượn `CategoryTreeConnectors` của lms-bigbro: một cột 20px mỗi cấp, cột cuối vẽ khuỷu, cột trước chỉ vẽ kẻ dọc khi tổ tiên **chưa** phải con út. **Bỏ rail khi đang gõ tìm kiếm** — tổ tiên có thể đã bị lọc mất, rail treo lơ lửng trông như cây gãy.
- **Kéo thả GIỮ song song với menu hàng loạt**, không thay thế: danh sách dài thì kéo qua nhiều màn hình rất cực, và kéo thả không thao tác được bằng bàn phím.
- Vùng thả = dải tiêu đề cụm **và mọi dòng trong cụm đó** (một `<tr>` vừa draggable vừa droppable, id droppable thêm tiền tố `row-`). Chỉ dải tiêu đề thì quá mỏng.
- Kéo một dòng **đang nằm trong vùng chọn** ⇒ chuyển cả vùng chọn. Đích đọc từ `over.data.current.groupId`, không suy từ hình học (khuôn `SubjectContentTab` của lms-bigbro).
- **Trạng thái chuyển hẳn ra badge góc trên-phải** trang chi tiết, xoá field khỏi `LeadFormDialog`. `'converted'` không có trong menu và badge bị khoá khi đã chuyển đổi — trạng thái đó do `admin_convert_lead` đặt kèm việc tạo khách hàng + dời cơ hội, chọn tay sẽ ra trạng thái rỗng ruột.
- `LeadUpsert` tách thành union: tạo mới cần đủ trường, cập nhật là **bản vá từng phần** — để đổi mỗi `status` không phải gửi lại toàn bộ bản ghi.
**Consequences:**
- `DistBarChart` cắt nhãn ở 24 ký tự (`tickFormatter`) + `interval={0}`, trục rộng 120→170, chiều cao hàng 30→36. Recharts tự xuống dòng nhãn dài nhưng KHÔNG nới chiều cao hàng ⇒ nhãn 5–6 dòng đè lên nhau. Tên đầy đủ vẫn còn ở tooltip. Sửa ở component dùng chung nên mọi biểu đồ bar ngang đều hưởng.
- `PointerSensor` phải có `activationConstraint: { distance: 8 }`, không thì mỗi cú bấm checkbox trên dòng đều thành drag.
- Cụm rỗng vẫn render — nếu ẩn thì không có chỗ để thả chi nhánh đầu tiên vào.
- Kéo thả chỉ bật khi đã có ít nhất một cụm (`grouping`); chưa có cụm thì bảng phẳng, không `DndContext`.

## 2026-08-06 — Lịch sử đấu giá gộp cả cụm + tầng "cụm" đơn vị + phân biệt Chính/Chi nhánh

**Context:** Tab Lịch sử đấu giá chỉ lấy tin của chính pháp nhân đang xem, tin của chi nhánh nằm ở bản ghi chi nhánh nên hoàn toàn ngoài tập dữ liệu — không thể phân bổ theo chi nhánh. Song song, quan hệ chỉ có MỘT cấp mẹ→chi nhánh và gán/gỡ từng cái một: ngân hàng vài chục chi nhánh thì danh sách phẳng không đọc nổi. Và vì chi nhánh cũng là một lead độc lập trong danh sách, không có gì phân biệt nó với trụ sở chính.
**Decision:**
- **`history` gộp cả cụm**, mỗi dòng mang `unit_id`/`unit_name`. **"Đơn vị" là một chiều thống nhất — công ty mẹ cũng là một lát cắt mang tên chính nó**, không phải "phần còn lại"; biểu đồ nhờ vậy đọc được ngay ai đóng góp bao nhiêu. Mặc định xem toàn cụm.
- **Chấp nhận lệch số có chủ đích:** KPI của tab (cả cụm) ≠ cột "Tài sản" ngoài danh sách (chỉ riêng đơn vị đó). Cột danh sách KHÔNG gộp vì chi nhánh cũng là dòng riêng — gộp là đếm trùng. Tab có một dòng chữ nói rõ điều này.
- Trần dòng `history` **500 → 1000**: gộp cụm làm số dòng tăng vài lần, giữ 500 là âm thầm cắt mất tin của chi nhánh cuối danh sách.
- **Tầng cụm** `prospect_unit_groups` (kind + parent_id + name, UNIQUE theo bộ ba) + `group_id` trên hai bảng pháp nhân. `parent_id` **cố ý không có FK** — trỏ vào một trong hai bảng tuỳ `kind`, Postgres không có FK đa đích; ràng buộc ép ở RPC vì mọi lối ghi đều qua SECURITY DEFINER.
- **Cụm thuộc về một công ty mẹ cụ thể, không phải nhãn tự do toàn sàn**: `admin_set_prospect_group` chỉ nhận đơn vị đang trực thuộc đúng công ty mẹ của cụm (không thì `no_eligible_units`). Rời công ty mẹ ⇒ `group_id` NULL luôn, tránh thành viên mồ côi trong cụm nhà người khác.
- Xoá cụm dùng `ON DELETE SET NULL` — **xoá cụm KHÔNG làm mất chi nhánh**, chúng chỉ về "Chưa xếp cụm".
- `admin_set_prospect_parent` (đơn lẻ) nay chỉ là vỏ bọc gọi `admin_set_prospect_parents` (mảng) — một chỗ duy nhất giữ luật gán cha.
- **Loại hình 3 giá trị** `Cá nhân / Tổ chức - Chính / Tổ chức - Chi nhánh`, **suy ra từ việc có công ty mẹ hay không** (`entityRole()`), KHÔNG thêm cột DB. Tab "Chi nhánh / AMC" chỉ hiện với `role === 'main'` — chi nhánh đã nằm dưới một công ty mẹ thì không quản lý cấp dưới.
**Consequences:**
- `units` CTE chỉ đi MỘT cấp. Mô hình không có chi nhánh của chi nhánh (suy luận không chọn cha đang là chi nhánh, gán tay chặn chu trình 1 cấp) — nếu sau này cho phép chuỗi 3 cấp thì CTE này phải đổi thành đệ quy.
- `legal_flags` / `postings_count` giữ phạm vi công ty mẹ: khác nguồn (asset_postings qua workspace claim), gộp vào là sai đơn vị đo.
- Biểu đồ + bộ lọc "Đơn vị"/"Cụm" và cột "Đơn vị" đều **ẩn khi cụm chỉ có một đơn vị** ⇒ prospect đơn lẻ thấy y hệt trước khi đổi.
- Bộ lọc cụm có mục `"none"` = tin của công ty mẹ + chi nhánh chưa xếp; đừng nhầm với `"all"`.

## 2026-08-05 — Khách hàng tiềm năng: phân loại cá nhân/tổ chức + danh sách chi nhánh / AMC

**Context:** Màn Khách hàng tiềm năng không phân biệt được chủ tài sản cá nhân với pháp nhân, dù `asset_owners.owner_kind` đã có sẵn (backfill regex từ `20260805000001`) — RPC `admin_prospects` đơn giản là không trả cột đó. Song song, khối "Đơn vị thành viên / chi nhánh" trong tab Lịch sử đấu giá **luôn rỗng**: nó đọc `asset_owners.parent_owner_id` mà không có chỗ nào trong code ghi cột này, và nhánh SQL còn chốt cứng `p_kind = 'asset_owner'` nên công ty đấu giá không bao giờ có chi nhánh dù `org_type = 11` ("Chi nhánh") đã tồn tại trong dữ liệu.
**Decision:**
- **Cá nhân/tổ chức chỉ áp cho chủ tài sản.** Tổ chức đấu giá theo luật luôn là pháp nhân ⇒ `entity_type` của `auction_org` cố định `'organization'`, hình thức chi tiết lấy từ `org_type` (0/1/2/11 → center/enterprise/company/branch). Không thêm cột `entity_type` nào vào DB — RPC suy ra tại chỗ.
- **Suy luận quan hệ mẹ–con, không nhập tay từ đầu.** `infer_org_parents()` (`20260805000230`) yêu cầu **điều kiện CẦN là tên con tự nhận** (`org_branch_marker()`: chi nhánh / PGD / sở giao dịch / AMC / quản lý nợ) hoặc `org_type = 11`; cha phải có `name_tokens <@` token con, strict subset, và "đủ đặc trưng" (≥2 token, hoặc 1 token dài ≥4 ký tự để cứu "agribank"). Bao hàm token là tín hiệu YẾU — quét mò trên tên trung tính sẽ gán bậy hàng loạt.
- **`parent_source` ('inferred' | 'confirmed')** trên cả hai bảng. `admin_set_prospect_parent()` luôn ghi `'confirmed'`; `infer_org_parents()` chỉ đụng dòng có cột cha đang NULL ⇒ chạy lại không bao giờ đè lên quyết định của người.
- Đặt ở **tab riêng "Chi nhánh / AMC"**, chỉ hiện khi `entity_type = 'organization'`; gỡ hẳn khối badge cũ khỏi tab Lịch sử đấu giá.
**Consequences:**
- `auction_organizations` nay có `normalized_name` / `name_tokens` generated STORED — `admin_prospects` bỏ được `normalize_org_name(a.name)` tính lại mỗi dòng.
- Bộ lọc "Loại hình" chạy **client-side** trên `useProspectStatsMap` (trần 1000 prospect/loại có sẵn); lead nhập tay không nối pháp nhân nên bị loại khi lọc — chấp nhận, vì loại hình chỉ suy ra được từ dữ liệu sàn.
- Ngưỡng ≥2 token bỏ sót công ty mẹ tên quá ngắn (tokens còn lại chỉ `{chau}` của "Ngân hàng TMCP Á Châu"); đổi lại không gán sai. Admin gán tay bù qua `AssignBranchDialog`.
- `org_branch_marker` phải khớp heuristic `owner_kind` — thiếu `quan ly tai san` là lệch, đã vá ở `20260805000231`.
- Dialog gán tái dùng `admin_prospects(p_search)` thay vì RPC tìm kiếm riêng: nó đã lọc theo tên chuẩn hoá và trả sẵn số tài sản để admin chọn đúng đơn vị khi tên gần giống nhau.

## 2026-08-05 — KYC Chủ tài sản: tên tổ chức chọn từ danh bạ `asset_owners`, không gõ tay

**Context:** Ô "Tên theo Giấy phép / Quyết định thành lập" (nhánh tổ chức) là text tự do. Khớp tài sản sau khi duyệt (`run_workspace_match` → `org_name_similarity` với `public.asset_owners`) hoàn toàn dựa vào chuỗi này, nên sai một dấu là tụt điểm và tài sản không tự về danh mục. Dữ liệu thực tế đã chứng minh: các hồ sơ hiện có mang `org_name` kiểu `"ngân hàng"`, `"cơ quan"`.
**Decision:**
- Thay ô text bằng `AssetOwnerTypeahead` đọc `public.asset_owners` (RLS public-read), lọc bỏ `owner_kind = 'individual'` — cá nhân thuộc nhánh KYC Cá nhân. Tìm phía server + debounce, đối xứng với `CompanyTypeahead` của KYC công ty đấu giá.
- **Giữ lối thoát "Nhập tên thủ công"** — khác `CompanyTypeahead` (bắt buộc chọn). Danh bạ dựng từ tài sản đã lên sàn nên chưa phủ hết pháp nhân; ép chọn sẽ chặn tổ chức mới nộp hồ sơ.
- Cột mới `asset_owner_org_kyc.linked_asset_owner_id` (`20260805000150`): NULL = tự nhập tay. Admin duyệt thấy hàng "Nguồn tên tổ chức" xanh/hổ phách để biết có cần soi kỹ giấy tờ không.
- Chọn entity còn kéo theo: gộp `aliases` của danh bạ vào alias người khai, và điền hộ `org_type` từ `owner_kind` **chỉ khi** người khai chưa chọn.
**Consequences:**
- KHÔNG đụng `create_workspace_on_org_approval`/`run_workspace_match`: chọn từ danh bạ khiến `org_name` khớp tuyệt đối (similarity 1.0 → `auto_claimed`), logic khớp giữ nguyên.
- Không hiện badge "Đã có TK" như `CompanyTypeahead`: `asset_owner_org_kyc` là own-rows + admin-read, người khai không được phép biết tổ chức nào đã có hồ sơ.
- Chế độ nhập tay **suy ra từ dữ liệu** (`orgName && !linkedAssetOwner`), không chốt lúc mount — prefill từ `orgKyc` chạy ở effect, sau lần render đầu của section.
- Các hồ sơ cũ có `org_name` rác vẫn nguyên; cần soát tay nếu muốn khớp lại.

## 2026-08-05 — Tách "Hồ sơ nhân sự" thành mục cấp cao + mã quyền riêng

**Context:** Hồ sơ nhân sự đang là mục con của "Hồ sơ năng lực", dùng ké mã quyền `nl-dau-gia-vien`. Là một màn nghiệp vụ độc lập (số hoá hồ sơ, xuất file tốn credit) nên cần đứng riêng và cấp phát quyền riêng.
**Decision:**
- Nav: mục cấp cao **trên** "Hồ sơ dự tuyển". URL đổi `/portal/nang-luc/ho-so-nhan-su` → **`/portal/nhan-su`**; giữ 2 route redirect (kèm `RedirectNhanSuId` cho `/:id`) vì link đã phát ra ngoài.
- Mã quyền mới `nhan-su` + category cùng tên, actions **`view/update/export`** — KHÔNG có create/delete: thêm/xóa người vẫn thuộc màn Đấu giá viên.
- **Backfill BẢO TOÀN HÀNH VI** (`20260805000040`): `(nl-dau-gia-vien,view)` → `(nhan-su,view)` **và** `(nhan-su,export)`, `(…,update)` → `(nhan-su,update)`. Cấp export theo `view` là cố ý: nút "Xuất hồ sơ" trước đây chỉ cần quyền XEM, không map thì mọi Nhân viên/Quản lý mất tính năng.
**Consequences:**
- `org_seed_default_roles()` được `CREATE OR REPLACE` kèm preset `nhan-su` ⇒ tổ chức tạo mới cũng có. Đã đối chiếu số liệu: 5 AGENT + 5 MANAGER có đủ view/export, MANAGER thêm update; OWNER vẫn 0 dòng (đi tắt toàn quyền).
- Xuất hồ sơ **có trừ credit** mà Nhân viên mặc định được cấp — muốn siết thì bỏ tick ở màn Vai trò, không cần migration.
- **Luật chung khi tách module quyền:** luôn backfill từ mã cũ sang mã mới theo hướng *giữ nguyên những gì người dùng đang làm được*, kể cả khi action đổi tên (view→export ở đây).

## 2026-08-05 — RBAC cấp tổ chức + luồng mời thành viên cho portal CTDG

**Context:** `/portal` chỉ gác bằng session (buyer thường cũng vào được), không có phân quyền. `organization_memberships` có sẵn `PENDING_INVITE`/`invite_token` từ 10/2025 nhưng KHÔNG UI nào tạo lời mời; code nhận invite ở `Auth.tsx` redirect về `/broker/dashboard` (route chết). `organization_roles.permissions` JSONB chưa từng được code nào đọc. Mọi chỗ resolve tổ chức bằng `owner_id` ⇒ thành viên không phải chủ sở hữu thấy portal trống.
**Decision:**
- Mô phỏng admin RBAC nhưng **KHÔNG có bảng gán vai trò riêng**: `org_roles`+`org_role_permissions` theo tổ chức, `organization_memberships.role_id` trỏ thẳng sang `org_roles` (membership CHÍNH LÀ dòng gán — thêm bảng thứ ba tạo hai nguồn sự thật). Bảng `organization_roles` cũ đã DROP.
- Danh mục quyền ở code (`src/lib/orgPermissions.ts`), DB chỉ lưu `(module, action)`. Module `tin-dang` không có mục nav — tồn tại để đỡ RLS `listings`.
- **Không gửi email**: lời mời trả token, người mời copy link `/loi-moi/:token` gửi tay (pattern `CreateUserDialog`). Mời được MỌI email, chỉ chặn khi trùng; cổng kích hoạt nằm ở SERVER (`accept_org_invite` → `reason='not_activated'`).
- `OrgProvider` mount trong `PortalLayout` (KHÔNG phải App.tsx) để không đảo thứ tự provider.
**Consequences:**
- Bịt 2 lỗ hổng có sẵn: Manager tự chèn membership Owner (policy INSERT bị bỏ, chuyển sang RPC có guard) và không có policy UPDATE để đổi vai trò.
- Quyền `nl-*`/`ho-so-du-tuyen` hiện **CHỈ UI** — dữ liệu còn ở localStorage, không có DB để enforce. Chỉ `thanh-vien`/`vai-tro`/`tin-dang` được RLS bảo vệ thật.
- `OrgSwitcher` **cố ý ẩn khi chỉ có 1 tổ chức** cho tới khi dữ liệu năng lực chuyển sang Supabase (Giai đoạn B) — nếu không, đổi tổ chức sẽ hiện nhầm dữ liệu localStorage.
- Còn nợ: `organizations` UPDATE thiếu `WITH CHECK` ⇒ chủ tổ chức tự sửa được `kyc_status='APPROVED'` (ngoài phạm vi đợt này).

## 2026-08-05 — "Tin đấu giá": bộ lọc lên cấp trang, gom về một định nghĩa SQL

**Context:** Bản đầu đặt bộ lọc trong bảng chi tiết ở CUỐI trang (sau 6 khối biểu đồ) nên người dùng không thấy, và nó chỉ lọc bảng — biểu đồ vẫn hiện toàn bộ, tức lọc chỉ đúng một nửa. Hàng KPI "Toàn sàn" lặp y hệt hàng trên khi khoảng ngày phủ hết dữ liệu.
**Decision:**
- Bộ lọc chuyển thành **cấp trang** (`ListingsFilterBar`, ngay dưới tiêu đề, chung khối với bộ lọc thời gian) và chi phối **cả biểu đồ lẫn bảng**.
- Thêm `public.admin_listings_scope()` = **định nghĩa bộ lọc duy nhất**; `admin_listings_report()` (DROP rồi tạo lại vì đổi chữ ký) và `admin_listings_rows()` mới đều JOIN vào đó. Bảng chi tiết bỏ query PostgREST + màn tra id tổ chức/chủ tài sản 2 bước ở client — ngữ nghĩa tìm kiếm giờ chỉ tồn tại một chỗ, trong SQL.
- Search bao **tên + mô tả** tin, cộng tỉnh/quận và tên tổ chức/chủ tài sản (EXISTS trong SQL). Combobox tổ chức/chủ tài sản tìm phía server.
- Dòng "Toàn sàn" chỉ render **khi bộ lọc thực sự thu hẹp** (`totalListings > periodListings`).
**Consequences:**
- Kiểm chứng bất biến: `kpis.period.listings` = `rows.total` = Σ`bySessionStatus` dưới mọi tổ hợp lọc. Thêm filter mới ⇒ chỉ sửa `admin_listings_scope`, đừng đụng hai RPC kia.
- `byProvince` nới LIMIT 30 → 100 (VN 63 tỉnh; top-30 giấu tỉnh hiếm khỏi chính dropdown lọc tỉnh).

## 2026-08-05 — Báo cáo admin "Tin đấu giá" (tồn kho tài sản trên sàn)

**Context:** 3 báo cáo admin sẵn có đều nhìn về tiền & người dùng; không chỗ nào trả lời "sàn đang có bao nhiêu tài sản, phân bổ ra sao". Bản cho người mua (`/report`) thì 100% mock + paywall.
**Decision:**
- `/admin/bao-cao/tin-dau-gia` (module quyền `tin-dau-gia`, category `bao-cao`) — nguồn DUY NHẤT là `listings`, GỒM cả `DRAFT/PENDING_APPROVAL/INACTIVE`; khoảng ngày lọc theo `created_at`. KHÔNG đọc `asset_postings`.
- RPC `admin_listings_report` (`20260805000003`) — 10 section + 4 helper SQL. **`kpis.total` cố tình KHÔNG lọc theo ngày**: "tổng tài sản trên sàn" là tồn kho (stock), scope theo range sẽ làm số headline tụt khi thu hẹp bộ lọc.
- **Bảng chi tiết tách khỏi RPC**, query thẳng `listings` phân trang server (`useAdminListingsTable`) — gộp vào RPC thì mỗi phím gõ chạy lại cả 10 section tổng hợp.
- Ba luật mới (chi tiết ở `architecture.md` / `common-pitfalls.md` / `business-rules.md`): rollup slug 2 thế hệ nhân bản SQL↔TS; `sessionStatusOf()` là nhà chính thức của logic trạng thái phiên; `PER_MONTH` bị loại khỏi tổng giá khởi điểm.
**Consequences:**
- Smoke-test lộ 2 slug thật chưa map (`kho-xuong` 16 tin, `dat-nen` 4 tin) rơi vào "Khác" → section `byCategoryChild` chính là công cụ phát hiện drift này, giữ nguyên đừng bỏ.
- Migration PUSHED, `types.ts` regen. Route bọc `AdminPermissionRoute` (khác `giao-dich`/`truy-cap` vốn chưa bọc — bất nhất có sẵn, không đụng).

## 2026-07-26 — Module "Công cụ đấu giá" (Admin Nội dung + MKP) + CTA lead-gen

**Context:** Cần khu giới thiệu 4 công cụ hỗ trợ đấu giá (Số hoá / Định giá / Vay vốn / Pháp lý), mỗi công cụ do đối tác ngoài hoặc SSCorp cung cấp; khách dùng dịch vụ phải phát sinh doanh thu + hoa hồng qua phễu CRM sẵn có.
**Decision:**
- **3 bảng** (`20260726000001-4`): `auction_tools` (4 công cụ cố định, seed, `public_read` theo `is_active`), `auction_tool_providers` (gắn `supplier_id`+`service_id` để quy doanh thu — đối tác ngoài dùng service `kind=commission`, SSCorp `is_own=true` dùng `direct`; `public_read` theo `status='active'`), `auction_tool_showcases`.
- **Showcase bí mật qua RPC, KHÔNG public_read**: `url`/`access_password` nhạy cảm mà RLS lọc theo dòng không giấu được cột → bảng chỉ `admin_all`; MKP đọc qua SECURITY DEFINER `list_tool_showcases` (chỉ trả `url` khi `visibility='public'`, còn lại `is_locked=true`) + `unlock_tool_showcase` (đổi mật khẩu lấy url). Cùng tinh thần "commission ẩn khỏi catalog" của services.
- **CTA MKP → CRM (RPC public cho END-USER)**: `request_tool_service` grant `authenticated` (bắt buộc đăng nhập), **KHÔNG** gọi `admin_has_permission` — tạo lead (`source='tool_marketplace'`) + opportunity `stage='selling'` gắn service của provider; dedup theo (`created_by`, `tool_provider_id`, stage mở). Admin chốt thắng bằng `admin_win_opportunity` như thường → khách hàng + đơn + hoa hồng.
- Thêm `leads.source='tool_marketplace'` + cột `tool_provider_id` trên `leads` & `opportunities`; module quyền `cong-cu-dau-gia` (category `noi-dung`).
**Consequences:**
- Provider chưa gắn `service_id` ⇒ CTA đổi thành "Liên hệ tư vấn" (không tạo được opportunity vì `opportunities.service_id` NOT NULL). Opportunity commission cần admin nhập `gross` lúc chốt (variant seed `price=0`).
- Mẫu MỚI: RPC SECURITY DEFINER public cho end-user (không cần quyền admin) để ghi vào bảng admin-only — khác các RPC chuyển đổi CRM (vốn gác `admin_has_permission`).
- Migrations 1-4 PUSHED, `types.ts` regen.

## 2026-07-26 — Số hoá tài sản: trạng thái `active` + tách luồng gửi tổ chức + làm lại vỏ wizard

**Context:** Wizard số hoá `/chu-tai-san/dang-tai-san` BẮT BUỘC chọn 1 tổ chức đấu giá ở bước cuối mới lưu được (kẹt nếu chỉ muốn số hoá). Yêu cầu: số hoá không cần chọn tổ chức; chọn/gửi tổ chức là luồng riêng; đồng thời làm lại UI/UX vỏ wizard (tham khảo project `build-space-78164`, KHÔNG clone vì ref chỉ BDS-only).
**Decision:**
- **Thêm status `active` ("đã số hoá")** vào CHECK `asset_postings.status` (migration `20260726000005`; các giá trị cũ giữ nguyên). Vòng đời: `draft` (Lưu và thoát) → `active` (số hoá xong, KHÔNG cần tổ chức). `matched` không còn là điều kiện hoàn tất.
- **Tách 2 luồng** trong [useAssetPosting.ts](src/hooks/useAssetPosting.ts): `useSubmitPostingWithOrg` bị bỏ, thay bằng `useCreatePosting({posting,status,postingId?})` (chỉ lưu hồ sơ, `chosen_org_id:null`, insert HOẶC update draft) + `useSendServiceRequest({postingId,orgId,matchScore,message})` (insert `asset_service_requests` — luồng riêng, KHÔNG đổi status posting; quan hệ tổ chức chỉ nằm ở bảng request).
- **Vỏ wizard mới = FULL-PAGE takeover** (`fixed inset-0 z-50 flex-col`, phủ cả OwnerPortalLayout — như ref): `WizardHeader` full-width (X trái · `WizardProgress` stepper ngang nhãn+thanh gạch · "Lưu và thoát"=lưu draft, guard cần parent/child/title), vùng nội dung cuộn giữa có tiêu đề/mô tả từng bước, `WizardNavigation` thanh đáy cố định (Quay lại · Tiếp theo). `WizardProgress` clickable (chỉ quay lại bước đã xong). Bước cuối đổi `Step5MatchAndSend`→`StepReview` (xem lại + 2 nút: "Hoàn tất số hoá" vs "Số hoá & gửi cho tổ chức"). Chọn tổ chức tách ra `ChooseOrgAndRequest` (tái dùng: full-page sau số hoá trong wizard + nút "Gửi cho tổ chức" trong `AssetPostingDetail` khi `status==='active' && !request`). Ảnh: kéo-thả sắp xếp + badge "Ảnh bìa" (ảnh đầu mảng).
**Consequences:**
- `SuccessScreen.orgName` giờ nullable (biến thể "Đã số hoá tài sản" khi không gửi tổ chức). `AssetPostingStatus` + mọi `STATUS_STYLE`/label phải có `active` (đã cập nhật types + Landing + Detail).
- Draft resume TỪ DANH SÁCH chưa làm — "Lưu và thoát" tạo được draft nhưng bấm lại từ Landing hiện mở Detail, không mở lại wizard. Việc sau (cần map `AssetPosting`→`WizardValues`).
- `types.ts` regen thêm các bảng `auction_tools*` (đã push trước đó, chưa regen) — additive.

## 2026-07-15 — Catalog nhóm→biến thể làm NGUỒN GIÁ + gói credit theo đối tượng + reprice

**Context:** Giá gói credit + chi phí tính năng là hằng số code (1 danh mục dùng chung). Cần: (1) Dịch vụ 2 cấp nhóm→biến thể, giá ở biến thể; (2) 3 bộ gói credit theo đối tượng (người mua/chủ tài sản/công ty) — DB là nguồn sự thật; (3) reprice tính năng.
**Decision:**
- **`service_variants`** (con của `services`, migration `20260715000001`): `variant_key UNIQUE`, `price`(gói)/`credit_cost`(tier-feature), `base_credits`/`credits`, flags popular/best. `services` thêm `audience` (buyer|owner|company|all) + **public-read RLS** (`SELECT USING is_active`) để trang mua + hàm unlock đọc giá; admin vẫn full CRUD (tamper-proof, đã test anon update = 0 rows). `orders`/`credit_transactions` thêm `service_variant_id`+`variant_key`.
- **DB = nguồn giá runtime** (KHÔNG dùng SECURITY DEFINER RPC — initiative riêng; mô hình vẫn client-trusted như trước). Hook `useServiceCatalog` (UI) + module cache `serviceCatalog.getVariantCost/getVariantPackage` (cho `credits.ts` async) — **luôn fallback hằng số code** nếu DB lỗi. `credits.ts` KHÔNG import `serviceCatalog` constants (tránh vòng lặp — serviceCatalog hardcode fallback). `addCredits(userId, credits, variantKey)` + mọi unlock đọc `getVariantCost(variant_key)` + ghi `variant_key`/`service_variant_id` vào ledger.
- **3 bộ gói theo đối tượng, áp THEO GIAO DIỆN**: `CreditsTab` nhận prop `audience` → `packagesForAudience()`; hồ sơ=buyer, `/portal/credits`=company, TRANG MỚI `/chu-tai-san/credits`=owner. `?package=` mang `variant_key`; Vnpay/PaymentResult tra biến thể qua catalog (PaymentResult dùng module cache `getVariantPackage` để an toàn timing). Key + tên gói duy nhất toàn cục (15 gói).
- **Doanh thu bền vững**: `resolvePurchase` ưu tiên `variant.price`/`variant_key`, fallback khớp tên legacy; GIỮ `CREDIT_PACKAGES` code vĩnh viễn cho dòng cũ. Báo cáo đổi tên **"Doanh thu"**; thêm by-audience + top-variant + tăng trưởng; "Giao dịch credit" gom theo nhóm+đối tượng. Seed mock 12 tháng (500 nạp + 1600 tiêu dùng + 70 đơn) qua `20260715000002/3`.
- **Reprice (loại ledger mới `unlock_opp_report`/`export_profile`)**: báo cáo cơ hội (người mua) = **1 credit TRỪ THẬT** (wire `chargeOppReport` ở MarketReport, trước chỉ cosmetic); báo cáo danh mục (owner) **49→4** (`OWNER_REPORT_COST`+DB); xuất hồ sơ (công ty) **50→30** (`chargeExportProfile`, bỏ anti-pattern `addCredits(-cost)`).
**Consequences:**
- Đổi giá = sửa `service_variants` (admin UI hoặc SQL) — KHÔNG cần deploy. Nhưng phải giữ đồng bộ fallback hằng số trong `serviceCatalog.ts` + `credits.ts` cho trường hợp DB lỗi.
- Deduction VẪN client-trusted (RLS credit own-rows) — chuyển sang RPC enforce là việc SAU.
- Admin sửa biến thể phải invalidate `["service-catalog"]` + `resetCatalogCache()` (đã wire trong hooks) nếu không giá client bị cũ.
- ESLint/tsc: 82 lỗi + 21 warning nền GIỮ NGUYÊN (không thêm mới); build (vite, không typecheck) pass.

## 2026-07-14 — Sale & Marketing: Dịch vụ + Đơn hàng + Doanh thu tổng

**Context:** Marketing chỉ theo dõi doanh thu credit; nền tảng còn bán dịch vụ trả tiền trực tiếp (quảng cáo…) mà chưa có danh mục dịch vụ, đơn hàng, hay doanh thu tổng phân nguồn.
**Decision:**
- **2 bảng mới** (`20260714000002_services_orders.sql`, đã push + regen `types.ts`): `services` (danh mục hợp nhất, `kind` `'credit'|'direct'`, `credit_feature_key` = khóa gói CREDIT_PACKAGES cho category `package` / `credit_transactions.type` cho `unlock`, `price` VND, `credit_cost`) + `orders` (`customer_id`→customers, `service_id`→services, `amount`, `fulfillment_status` `pending|fulfilled|cancelled`, `advertisement_id` nullable). RLS admin-only `has_role ADMIN`; code trigger `DV…`/`DH…`. Seed 16 dịch vụ credit + 1 dịch vụ `Quảng cáo` direct.
- **Quy tắc doanh thu (QUAN TRỌNG):** Doanh thu tổng = credit tính LÚC NẠP GÓI (tái dùng `resolvePurchase`/`isPurchase`) + đơn dịch vụ direct (trừ `cancelled`). Credit tiêu cho tính năng là TIÊU DÙNG, KHÔNG tính doanh thu (tránh double-count). Báo cáo mới `/admin/bao-cao/doanh-thu` (`revenueReport.ts` thuần, dùng lại `enumerateBuckets`/`bucketKeyOf` vừa export). Báo cáo cũ đổi tên **"Giao dịch credit"** (giữ slug `bao-cao/giao-dich` + module code `giao-dich`).
- **Fulfillment tự động qua trigger DB:** `orders_fulfill_on_ad_active` (AFTER UPDATE OF status trên advertisements → đơn `pending` liên kết thành `fulfilled` khi ad `active`) + `orders_fulfill_on_link` (BEFORE INSERT/UPDATE trên orders khi ad liên kết đã `active`). `orders_require_direct_service` chặn đặt đơn vào dịch vụ `kind='credit'` (chống double-count). Đã test 4 case (rollback, không để lại data).
- **Đổi tên** nav section + RBAC category label `marketing` → "Sale & Marketing" (CODE `marketing` giữ nguyên). Thêm module code `dich-vu`, `don-hang` (marketing) + `doanh-thu` (bao-cao) vào `MODULE_DEFINITIONS` — code-only, KHÔNG migration; SUPER_ADMIN thấy ngay.
**Consequences:**
- `customers` (B2B, gắn orders) ≠ `profiles` (end user, mua credit) — báo cáo doanh thu chỉ hợp nhất ở mức VND + nguồn, KHÔNG có view "theo khách hàng".
- `orders.customer_id`/`service_id` = `ON DELETE RESTRICT` → xóa khách/dịch vụ có đơn sẽ fail (toast báo lỗi thân thiện). Đơn `fulfilled` bị đưa về `pending` khi ad còn `active` sẽ tự fulfill lại ở lần ghi kế (chấp nhận).
- Doanh thu vẫn là SUY RA (chưa có cổng thanh toán/bảng payments) cho cả 2 nguồn.

## 2026-07-13 — Admin RBAC ("Quản trị") + sửa catch-22 đăng nhập admin

**Context:** Admin chỉ có cổng nhị phân `user_roles.ADMIN`. Cần phân quyền chi tiết: 2 trang `/admin/quan-tri/tai-khoan` (tài khoản admin) + `/admin/quan-tri/vai-tro` (vai trò + quyền). Đồng thời phát hiện bug tiềm ẩn: admin bị KHÓA đăng nhập.
**Decision:**
- **3 bảng mới** (prefix `admin_`, KHÔNG lẫn `organization_roles`): `admin_roles`, `admin_role_permissions(role_id,module,action)`, `admin_role_assignments(user_id,role_id)` — layer TRÊN `user_roles.ADMIN` (vẫn là cổng /admin). Migration `20260713000010_admin_rbac.sql` (đã áp + regen `types.ts`).
- **Quyền hiệu lực** = hợp `(module,action)` mọi vai trò được gán, HOẶC toàn quyền nếu có vai trò hệ thống `SUPER_ADMIN` (đi tắt theo `code`). Danh mục quyền ở CODE: `src/lib/adminPermissions.ts` (module theo section nav × action `view/create/update/delete/approve/export`).
- **Helper SECURITY DEFINER** `admin_has_permission(module,action)` + `admin_is_super_admin(uid)` (mô phỏng `has_role`). RLS 3 bảng: SELECT mở cho mọi ADMIN; ghi vai trò/quyền gated `admin_has_permission('vai-tro',*)`, ghi gán gated `('tai-khoan','update')`. Ma trận quyền thay ATOMIC qua RPC `admin_set_role_permissions(role_id,jsonb)` (delete-all-then-insert). Trigger `admin_roles_protect_system` chặn xóa/đổi mã vai trò `is_system`. Seed `SUPER_ADMIN` cho MỌI `user_roles.ADMIN` hiện tại.
- **Enforce = UI + model** (giai đoạn này): frontend lọc nav + chặn route qua `useAdminPermissions()`/`useHasAdminPermission()` + guard `AdminPermissionRoute`. Module admin CŨ vẫn giữ cổng ADMIN ở RLS. **"Xóa" admin = thu hồi** (xóa assignments + `user_roles` ADMIN, giữ login). Tạo admin: reuse edge fn `admin-user-actions` (create+makeAdmin) rồi gán vai trò; thăng cấp user = insert `user_roles` ADMIN trực tiếp (policy "Admins can manage all roles" FOR ALL cho phép).
- **Bug fix (Lovable-era):** `Auth.tsx` `handleLogin` signOut mọi ADMIN kèm lỗi "Tài khoản admin không thể đăng nhập vào marketplace" — nhưng `/auth` là trang login DUY NHẤT → catch-22 khóa admin. Sửa: admin được điều hướng về `/admin` (helper `redirectByRole` trong `useEffect`), không signOut.
**Consequences:**
- **Follow-up:** enforce quyền chi tiết ở TẦNG DB (RLS/RPC/edge) cho từng module admin cũ (hiện mới UI-gate). Nếu tạo admin mới bằng account chưa có quyền `tai-khoan.update` thì bước gán vai trò sau `create` sẽ bị RLS chặn (super admin OK).
- `types.ts` regen (3 bảng + 3 RPC mới). Nav admin giờ phụ thuộc `useAdminPermissions` — ai không có SUPER_ADMIN/permission `view` sẽ KHÔNG thấy mục đó (fail-closed). Cần SMTP để gửi link tạo mật khẩu (như module người dùng).

## 2026-07-12 — Module Quản lý người dùng (admin) + activation server-backed

**Context:** Admin chưa có cách quản lý người dùng (list/chi tiết/tặng credit/tạo+kích hoạt/khóa-mở/reset mật khẩu). Đồng thời phát hiện bug: activation chỉ lưu ở `localStorage["activated_${userId}"]`, path nạp thật không ghi → popup kích hoạt hiện lại mỗi lần login/đổi thiết bị.
**Decision:**
- **Activation server-backed**: thêm `profiles.activated` + `activated_at` (nguồn sự thật duy nhất). Sửa gate login (`AuthDialog`), `addCredits` (`.eq('activated', false)` để lần nạp ĐẦU kích hoạt, không ghi đè `activated_at`), `DepositCard` (personal), `ProfileInfoTab`. Migration `20260712000012` backfill `activated=true` cho ai `balance>0` hoặc có giao dịch `purchase`.
- **Khóa/mở = GoTrue ban thật** (`ban_duration`), mirror vào `profiles.status` (`CHECK IN ('active','locked')`) để list render "Bị khóa" không cần đọc `auth.users`.
- **Tặng credit cross-user** = RPC `admin_grant_credits(_user_id,_amount,_note)` SECURITY DEFINER + guard `has_role ADMIN` (mẫu `resolve_campaign_audience`); ledger type MỚI `'admin_grant'`. Là cách DUY NHẤT ghi credit user khác (bảng credit vẫn own-rows).
- **Đọc cross-user** = policy SELECT admin riêng `<table>_admin_read USING has_role ADMIN` trên `user_credits`, `user_roles`, 4 bảng unlock — GIỮ nguyên own-rows.
- **Auth đặc quyền** (tạo user qua `inviteUserByEmail`, khóa/mở qua `ban_duration`) → edge function MỚI `supabase/functions/admin-user-actions` (service_role + verify caller ADMIN, gọi qua `functions.invoke`). Reset mật khẩu client-side `resetPasswordForEmail`.
**Consequences:**
- **Ops bắt buộc:** cấu hình SMTP trong Supabase Auth để email invite/reset gửi thật (bộ gửi mặc định của Supabase giới hạn ~vài/giờ). Edge function đã deploy; `SUPABASE_SERVICE_ROLE_KEY` tự inject.
- `credit_transactions.type` giờ có thêm `'admin_grant'` (báo cáo/thống kê cần biết). Route `/admin/nguoi-dung` + `/:id`; nav mục "Chăm sóc khách hàng".

## 2026-07-12 — Module "Báo cáo giao dịch" (admin) + sửa bug cộng credit x2

**Context:** Admin cần module Báo cáo (báo cáo đầu tiên: doanh thu + tiêu dùng credit). KHÔNG có bảng payments/orders — VND doanh thu không lưu trong DB. Phát hiện thêm bug: mỗi thanh toán thành công cộng credit 2 lần → doanh thu/credit x2.
**Decision:**
- **Suy ra doanh thu từ ledger**: revenue = `credit_transactions` rows `type='purchase' AND credit_delta>0 AND description LIKE 'Mua gói %'`, map giá VND từ `CREDIT_PACKAGES` (`src/lib/credits.ts`) — **nguồn giá VND duy nhất, không hardcode vào SQL/RPC**. Purchase dương không khớp gói = "Nạp khác" (VND=0, tách riêng, loại khỏi avg). Purchase ÂM = spend "Xuất hồ sơ" (type ghi nhầm) → tính vào tiêu dùng.
- **Tổng hợp phía client**: hook `useTransactionReport` (React Query, queryKey theo range; granularity qua `useMemo` không refetch; fetch phân trang 1000/trang cap 50k). Logic thuần + catalog `FEATURE_LABELS` ở `src/lib/reports/transactionReport.ts` (có unit test). Route `/admin/bao-cao/giao-dich`.
- **Sửa bug credit x2**: bỏ `addCredits` ở `VnpayCheckout.tsx`; điểm cộng credit DUY NHẤT là `PaymentResult.tsx`.
**Consequences:**
- Doanh thu chỉ đúng khi giá gói không đổi (giao dịch cũ định giá theo giá hiện tại) — future-proof: lưu VND lúc mua. `credit_transactions` SELECT vẫn mở cho authenticated (admin gate ở UI) — hardening = SECURITY DEFINER RPC. Residual: reload PaymentResult vẫn có thể cộng lại (ranRef reset) — cần cờ server-side. Dữ liệu lịch sử đã x2 vẫn còn (dọn ở task riêng nếu cần).

## 2026-07-12 — "Danh sách cụ thể": gửi được email NGOÀI hệ thống + badge "Chưa có tài khoản"

**Context:** `resolve_campaign_audience` giải đối tượng hoàn toàn `FROM profiles` → email import không khớp tài khoản nào bị âm thầm loại bỏ (không vào số "sẽ nhận", không snapshot lúc gửi) dù admin vẫn thêm vào danh sách được. Yêu cầu: cho phép gửi tới người ngoài hệ thống + đánh dấu họ.
**Decision:**
- **RPC thêm nhánh email ngoài hệ thống** (`20260712000007_campaign_audience_external_emails.sql`, `CREATE OR REPLACE`): mọi email trong `spec.emails` KHÔNG khớp `profiles` (anti-join `lower(p.email)`) trả về `user_id=NULL` và **LUÔN được gửi** — `respect_optin` chỉ áp cho tài khoản có sẵn (email ngoài HT không có `notifications_enabled`). `count_campaign_audience` + snapshot (`campaign_recipients.user_id` nullable) thừa hưởng.
- **UI badge "Chưa có tài khoản"**: hook `useEmailAccountStatus` (mirror `useUserLabels`) tra `spec.emails` trong `profiles` (lowercase, kiểu `fetchOptOut`); `SelectedRecipientsTable` gắn badge hàng `noAccount`.
**Consequences:**
- Áp bằng `psql "$SUPABASE_DB_URI"` (ở `.env.local`) + `supabase migration repair --status applied 20260712000007` — KHÔNG `db push --include-all` để tránh áp nhầm migration đang dở song song (`20260712000008_profile_terms_consent`).
- `ResolvedAudienceRow.user_id` nay `string|null`. `types.ts` KHÔNG regen (feature consent sẽ tự regen); hook mới chỉ select `profiles.email` (type đã có).

## 2026-07-12 — Module Quảng cáo (Banner) + Khách hàng dùng chung

**Context:** Cần cụm admin "Marketing" gộp Email Marketing + Quảng cáo; xây quản lý banner (tạo/list/chi tiết) tham khảo Email Marketing + ảnh Kiot.pro, có master data vị trí/giá, chặn vị trí unique, và 1 module Khách hàng nằm ngoài Marketing (dùng chung nhiều dịch vụ).
**Decision:**
- 5 bảng (`20260712000002_advertising.sql`, admin-only RLS): `ad_pages`→`ad_positions` (master data 2 cấp, `placement_type` slide/unique + `price NUMERIC(12,0)`), `advertisements` (banner; `code` "B0000009" qua trigger + `ad_code_seq`; lifecycle `draft/scheduled/active/paused/ended`, chỉ draft+scheduled sửa được), `ad_daily_stats` (seed demo 30 ngày×2 device cho biểu đồ ComposedChart), `customers` (generic, `code` "KH…").
- **Chốt cứng unique**: trigger `enforce_unique_ad_position` dùng `tstzrange(start,end) &&` — chặn 2 banner scheduled/active trùng thời gian ở cùng vị trí unique; slide không chặn. UI cũng cảnh báo + toast `isUniquePositionError`.
- Bucket `ad-banners` (public read, admin write, 10MB). `AdminLayout` refactor sang NAV có `children` + Collapsible (port từ PortalSidebar): cha "Marketing"→[Email, Quảng cáo], thêm item "Khách hàng". Routes `/admin/marketing/quang-cao/*` (+`/vi-tri` master data) và `/admin/khach-hang/*`.
- **Bỏ** phần audience/đối tượng so với bản tham khảo. Form banner dùng controlled `AdFormState` (không RHF).
**Consequences:**
- ✅ `npx supabase db push` OK (3 migration local==remote) + **regenerate `types.ts` thành công** — nay chứa cả advertising lẫn marketing_campaigns; hook mới dùng `(supabase as any)` theo convention (không còn bắt buộc nhưng giữ nhất quán).
- Render banner ra site công khai + tracking view/click thật = việc SAU (hiện admin-only, stats là seed demo). `numeric` có thể về string → `formatVnd` coerce `Number()`.

## 2026-07-12 — Audience preview = số THỰC NHẬN, gate/lỗi tường minh + seed opt-in

**Context:** Block "Người nhận đủ điều kiện" khi tạo/sửa chiến dịch email hiện `count ?? 0` vô điều kiện (không gate, không đọc `isError`) → chưa cấu hình vẫn ra "0", lỗi RPC nuốt thành "0", mỗi loại một kiểu; loại "Theo tiêu chí" **không bao giờ nhảy số** vì DB có 0 user opt-in (`notifications_enabled` mặc định `false`) và preview lọc `respect_optin=true`.
**Decision:**
- **1 nguồn sự thật** `audiencePreviewHeadline(spec,{count,isFetching,isError})` trong `src/lib/marketing/audienceCriteria.ts` → 4 trạng thái: `empty` ("Chưa cấu hình đối tượng", gate theo `hasAnyAudience`), `loading`, `error` ("Không tính được số người nhận" — KHÔNG hiện 0 giả), `ready` ("{n} người sẽ nhận email"; loại `list` kèm caption "trong N đã chọn"). Dùng chung ở `CampaignReviewPanel` (nay nhận `spec`+`isError`) và `AudienceSummary`; header loại `list` trong `AudienceSection` cũng surface `isError`.
- **Số hiển thị = số THỰC NHẬN** (deliverable, `respect_optin=true`) đúng như số gửi; **gửi vẫn giữ opt-in** (không đổi luồng gửi).
- **Seed opt-in** `20260712000001_seed_optin_sample.sql`: bật `notifications_enabled=true` cho ~1/3 profiles (md5-order, idempotent) để số > 0 và thấy rõ lọc opt-in; **default cột giữ `false`** (opt-in thật cho user mới).
**Consequences:**
- ✅ Gỡ 2 nợ ops từ 2026-07-11: **4 migration marketing đã push** (local==remote), và **project thật = `dvdpfjprncvkhfwcvqmp`** (khớp `config.toml`, CLI linked) — CLAUDE.md ghi `bcusbpkfnydqcvxxjvew` là cũ/sai.
- `types.ts` chưa regen (cần personal access token) → `useCampaigns.ts` vẫn dùng `(supabase as any)`; không đổi schema nên không chặn.
- Seed chỉ là dữ liệu mẫu; sản xuất thật vẫn phụ thuộc user tự bật opt-in.

## 2026-07-12 — "Danh sách cụ thể": chặn opt-out sớm + báo cáo import gộp theo dòng

**Context:** Luồng chọn "Danh sách cụ thể" (tạo/sửa chiến dịch email) để admin thêm được cả người opt-out rồi mới bị lọc âm thầm lúc gửi; import chỉ báo "N email hợp lệ", không cho biết dòng nào bị bỏ. Import bản redesign từ Claude Design (`email-audience/Danh sách cụ thể.html`).
**Decision:**
- **Chặn opt-out NGAY khi thêm/import** (không đợi lúc gửi): opt-out = `profiles.notifications_enabled !== true`, **nhất quán** với bộ lọc của `resolve_campaign_audience` (chỉ gửi khi `= true`). Tab "Tìm & chọn" disable user opt-out ("Chưa cho phép nhận email / Không thể thêm"); import tra `profiles` theo lô 200 để tách nhóm opt-out.
- **Báo cáo import gộp theo dòng**: `src/lib/marketing/importClassify.ts` (thuần) parse giữ số dòng → phân loại sai định dạng / trùng (vs danh sách hiện có + trùng trong file) / chưa cho phép / hợp lệ; `collectIssues` gộp 1 danh sách + `downloadIssueRows` tải `.xlsx`. UI: `audience/ImportReport.tsx`.
- **Bỏ tiêu đề lặp**: header section chỉ còn `{N} người nhận` + nút (bỏ "Người nhận" trùng "Đã chọn N…"); `SelectedRecipientsTable` bỏ tiêu đề đếm, "Xoá tất cả" dời vào hàng lọc (chỉ hiện khi > 10 dòng), nhãn phân trang `start–end / total`.
**Consequences:**
- `notifications_enabled` mặc định `false` NOT NULL → nhiều user hiện "Không thể thêm"; đây là hành vi ĐÚNG (khớp ai thực sự nhận được), không phải lỗi.
- `AddRecipientsDialog` nay cần prop `existingEmails` (lowercase) để bắt trùng; đọc `profiles` thêm cột `notifications_enabled` (đã có trong `types.ts`).

## 2026-07-11 — Email Marketing admin feature (cụm Marketing) + admin-only RLS + RPC audience resolution

**Context:** New admin "Marketing" cluster starting with Email Marketing (list / create-wizard / tabbed-detail). Audience targeting must segment users by criteria (registration date, account type, KYC, credit balance, tỉnh/thành) — but several of those live behind `own rows` RLS (`user_credits`) or across many tables, and admins need cross-user reads.
**Decision:**
- New back-office tables `marketing_campaigns` + `campaign_recipients` (`supabase/migrations/20260711000001_marketing_campaigns.sql`) use RLS **`admin_all` via `has_role(auth.uid(),'ADMIN')`** — a **deliberate deviation** from the default `own rows` convention because this is admin data, not user-owned.
- Audience resolved by **SECURITY DEFINER** RPC `resolve_campaign_audience(_spec jsonb,_respect_optin)` + `count_campaign_audience` (admin-guarded: `RAISE` unless `has_role ADMIN`), joining profiles/user_credits/organizations/memberships/asset_owner_kyc/asset_owner_org_kyc/user_roles/auction_organizations to derive account_type/credit/province **without widening those tables' RLS**. `account_type='buyer'` = NOT(admin OR company_rep OR owner_*); province best-effort via `organizations.license_info->>'auction_org_id'` → `auction_organizations.province`.
- `audience_spec` jsonb = 3 mode-gated sources (criteria/import/specific) **unioned**; every branch in the RPC MUST be gated on its `modes` flag (review caught ungated userIds/emails branches sending to toggled-off recipients).
- Marketing sends **always respect opt-in** (`profiles.notifications_enabled`) — `_respect_optin` hardwired `true`.
- **Send is STUBBED**: `useSendCampaign` resolves audience → snapshots `campaign_recipients` → transitions status; no email provider. Future `supabase/functions/send-campaign` consumes the snapshot at that seam.
- Nav = one flat entry in `AdminLayout` `NAV` (`/admin/marketing/email`); 4 routes under the `/admin` group in `App.tsx`.
**Consequences:**
- **Ops obligation:** run `npx supabase db push` then regenerate `types.ts` — migration is NOT pushed (CLI unauthenticated here); until then `useCampaigns.ts` uses `(supabase as any)` casts (per `useArticles.ts`).
- **Discrepancy to resolve:** `supabase/config.toml` `project_id=dvdpfjprncvkhfwcvqmp` ≠ CLAUDE.md `bcusbpkfnydqcvxxjvew` — confirm the live project before pushing.
- Real delivery + open/click tracking (recipient status pending→sent/opened/clicked, `sent_count` etc.) is the phase-2 follow-up. Reflected in `architecture.md`.

## 2026-07-05 — Decouple Lovable, migrate to native Supabase Google OAuth + Vercel

**Context:** The app originated on the Lovable AI platform and shipped with Lovable-specific auth and build shims — `@lovable.dev/cloud-auth-js` wrapping sign-in and the `lovable-tagger` Vite plugin. Now deployed on **Vercel** with a standalone Supabase project (`bcusbpkfnydqcvxxjvew`), that coupling was dead weight and a lock-in risk, and the wrapped auth blocked using Supabase's own OAuth.
**Decision:**
- Removed `@lovable.dev/cloud-auth-js` and `lovable-tagger` from `package.json` and `vite.config.ts`.
- `AuthDialog` now calls **`supabase.auth.signInWithOAuth({ provider: 'google' })`** directly via the typed client (`src/integrations/supabase/client.ts`); the multi-step identifier→OTP/password flow stays, Google is added as a first-class provider. Auth remains globally driven by `AuthDialogContext` + `AuthProvider` (single auth source — do not add parallel `getSession`/subscriptions).
- Hosting/build is now plain Vite → Vercel; no Lovable-injected tags in the bundle.
**Consequences:**
- **Ops obligation:** enable the **Google provider** in Supabase Auth (client ID/secret) and **whitelist the Vercel domains** (production + preview URLs) in Supabase Auth → URL Configuration (Site URL + Redirect URLs), or OAuth redirects 400. Google Cloud OAuth consent screen must list the same redirect URIs.
- Preview deploys use ephemeral Vercel URLs — either add a wildcard/known preview domain to the allow-list or accept that OAuth only works on whitelisted hosts.
- Reflected in `architecture.md` (auth stack, providers, deploy target). Mock files under `src/lib/mock*.ts` remain legacy scaffolding, unaffected.

## 2026-07-05 — Adopt the 4-layer `.claude` + `.agents` management system (ported from vsf-tm)

**Context:** Solo/agent-driven work on a real production app needed a repeatable operating model — expert personas, a knowledge base that separates current-truth from history, project slash-skills, and safety hooks — instead of ad-hoc prompting. The sibling `vsf-tm` project already had a proven version; port it, adapting from vsf-tm's mock-store/no-database prototype assumptions to taisandaugia's **real Supabase + RLS + React Query** reality.
**Decision:** Installed the four layers with canonical slugs (so cross-references resolve):
1. **Personas** at `.agents/skills/<slug>/SKILL.md`: `orchestrator`, `cpo`, `cto`, `system-architect`, `qa-qc`, `ui-ux-designer`, `data-analyst`, `kyc-expert`, `credits-paywall-expert`.
2. **Thin subagent wrappers** at `.claude/agents/<name>.md` (8, no orchestrator): `cpo`, `cto`, `system-architect`, `qa` (→`qa-qc`), `ui-ux` (→`ui-ux-designer`), `data-analyst`, `kyc-expert`, `credits-paywall-expert`.
3. **Project slash-skills** at `.claude/skills/<slug>/SKILL.md`: `new-page`, `migration`, `add-query`, `log-decision`, `add-unlock`.
4. **Knowledge base** at `.agents/knowledge/`: current-truth files (`architecture.md`, `business-rules.md`, `design-system.md`, `component-registry.md`, `common-pitfalls.md`) + this grep-only `decisions-log.md`, with the auto-read map in `README.md`.
- **Domain swap from vsf-tm:** HR/L&D/IDP/Excel-export content dropped. `hr-expert`→**`kyc-expert`** (3-milestone KYC, `kyc_status` PENDING_KYC→APPROVED|REJECTED, org roles Owner/Manager/Agent, RLS "own rows", CCCD/passport/phone-OTP). `ld-expert`→**`credits-paywall-expert`** (append-only `credit_transactions` ledger, `unlockAsset` permanent vs `unlockCompany`/`unlockOwner` time-limited & stacking, `unlockDeepReportPeriod` `{slug}:{periodId}` + `expandUnlock`, `PaywallContext`, `useCredits` single access point). Reports are **Recharts dashboards**, not Excel.
- Safety hooks at `.claude/hooks/`: `inject-workflow-context.sh`, `guard-main-push.sh` (advisory `ask` on push to `main`), `check-safety.sh`.
**Consequences:**
- `main` is protected **by policy**: only repo owner **@harleyng** pushes to `main`; agents branch + open a PR and don't self-merge. `guard-main-push.sh` is advisory (soft confirm), not a server-side block.
- Governance is authored assuming a real backend — reads respect RLS, writes go through the typed client and invalidate React Query keys (e.g. `["user-credits", userId]`); `system-architect` may propose schema/migrations/RLS.
- Knowledge stays discoverable only if the **current-truth ↔ history split** is honored: decisions logged here MUST be paired with an update to the canonical rule file.
