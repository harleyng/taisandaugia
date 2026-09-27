# Decisions Log — Tài Sản Đấu Giá (taisandaugia)

> **History file — grep, don't auto-read.** Reverse-chronological (newest first). This is the audit trail of *why*; the canonical *what* lives in the current-truth files (`architecture.md` / `business-rules.md` / `design-system.md` / `component-registry.md` / `common-pitfalls.md`). **Rule: this log records only WHY.** When a decision establishes or changes a rule, update the rule file too — if a rule lives only here, agents won't find it and it is effectively lost. Use `/log-decision`.
> Format per entry: `## YYYY-MM-DD — Short title`, then **Context** (the problem / why now), **Decision** (what we chose), **Consequences** (follow-ups, obligations, what it makes true).

---

## 2026-09-27 — Gói thuê bao tổ chức chủ tài sản (hạn mức tháng thay credit)

**Context:** Tổ chức chủ tài sản chuyên nghiệp muốn trả theo kỳ thay vì credit từng lượt; mỗi tổ chức một cấu hình do admin đặt; cá nhân vẫn credit. Người dùng chốt: hạn mức THEO TÍNH NĂNG / tháng, hết hạn mức mặc định CHẶN (admin đổi được sang trừ credit), trả online VNPay + admin kích hoạt tay, chỉ thành viên TRỰC TIẾP của Trạm được bao, kỳ do admin đặt, reset tháng dương lịch VN.
**Decision:**
- 1 dòng `owner_subscriptions` / Trạm (không có mẫu gói) + `_entitlements` (variant_key, monthly_quota NULL = không giới hạn) + `_terms` / `_usage` / `_events` chỉ ghi thêm; mọi ghi qua RPC, bảng chỉ admin đọc (module `goi-thue-bao`).
- `_owner_sub_consume` nối vào `start_asset_3d_scan` (dựng từ bản live) và RPC MỚI `owner_charge_portfolio_report` (trừ báo cáo danh mục chuyển từ client lên server). Hoàn quét 3D ⇒ dòng đảo lượt, không hoàn credit.
- `_charge_owner_feature_credits` = chỗ DUY NHẤT trừ credit tính năng chủ tài sản ⇒ Phase 15d chỉ đổi ví ở đây.
- Mig `20260927200000` + `…200100` áp qua psql; SQL 58 PASS (ROLLBACK) + race 2 phiên; E2E trình duyệt 18/18 (tài khoản `sub-*@example.com`, đã xoá).
**Consequences:** Thêm tính năng vào gói = sửa `owner_sub_supported_variants()` + `SUPPORTED_SUB_VARIANTS` + nối consume. `owner_report_views` còn policy INSERT legacy cho bản production cũ — bỏ sau khi deploy. Không hoàn tiền tự động khi huỷ; doanh thu ghi trọn kỳ lúc trả (không phân bổ).

## 2026-09-27 — Vai trò tuỳ chỉnh Trạm Điều Hành (module × thao tác, DB chặn ghi)

**Context:** Người dùng muốn trang quản lý vai trò cho cổng chủ tài sản như admin; trước đó 3 vai trò cố định + `owner_ws_can` CASE cứng (§A2 "upgrade when needed"). Người dùng chốt: ma trận module × thao tác, DB chặn GHI theo module, chống leo quyền theo tập con, Tác nghiệp tách 3 module.
**Decision:**
- `owner_ws_roles` + `owner_ws_role_permissions` theo Trạm (mẫu `org_roles`; membership = assignment qua `role_id`, FK SET NULL). Seed OWNER (hệ thống) / STAFF (= đúng quyền `staff` cũ) / VIEWER; self-check parity 0 khác biệt.
- `owner_ws_has(ws,module,action)` / `owner_ws_has_in(…,branch)` thay mọi kiểm quyền ghi (~40 điểm, sinh từ `pg_get_functiondef` live). `owner_ws_can` chỉ còn `'read'`; action cũ RAISE `0A000` để code sót lỗi rõ. `owner_ws_role` trả code vai trò.
- Đọc KHÔNG đổi; "Xem" chỉ ẩn menu + cổng `OwnerPermissionGate` trong layout (bảng đường dẫn → module, không bọc từng route vì App.tsx nóng).
- `owner_cash_settle` → DEFINER; RPC `owner_cash_set_due` / `_set_defaulted` để Thu tiền không cần quyền sửa Kết quả phiên.
- Bỏ cột `role` 3 bước: A `20260927170000` + B `20260927170100` ĐÃ ÁP (psql); C ở `supabase/pending/owner_ws_drop_legacy_role.sql`.
**Consequences:** Áp C sau khi frontend lên production (bản cũ đọc `role`, gọi overload `p_role`). Migration mới của cổng chủ tài sản phải dùng `owner_ws_has*` / `owner_posting_can(id,module,action)`. Phase 15c/15d dùng module mới thay `manage_workspace`/`write`.

## 2026-09-27 — Chỉ tiêu: dựng lại theo design (danh sách · chi tiết · trang đặt/sửa)

**Context:** Claude Design "Chi Tieu - Danh sach & Chi tiet" (project 979d4c55) thay accordion + dialog bằng thẻ-dòng, trang chi tiết mới và form đầy đủ; người dùng đòi "exactly as design", duyệt kế hoạch.
**Decision:**
- Danh sách: `OwnerTabBar` 3 trạng thái + lọc Phạm vi / Loại kỳ (`?tab=&scope=&ky=`, theo luật một kiểu tab/lọc); thẻ-dòng = ô kỳ + tên + phạm vi + x/y tiêu chí + thanh có vạch thời gian; tab Đang thực hiện chia "Kỳ đang diễn ra" / "Sắp tới".
- Chi tiết: **người dùng chốt** thẻ HERO trắng như Số hoá / Ký gửi (ô kỳ + tên + meta + nút sửa, dải Tiến độ chung | Thời gian ở đáy thẻ — không để thông tin nằm thẳng trên nền xám); thẻ tiêu chí gọn, lưới cố định 4 cột (2 tiêu chí không kéo giãn hết hàng); "Số liệu cấu thành" 5 dòng/trang + thanh chia tiền.
- Đặt / sửa = TRANG `/chi-tieu/moi`, `/chi-tieu/:id/sua` (bỏ `TargetDialog`, bỏ `?dat=1`). Trùng kỳ + phạm vi ⇒ cảnh báo + khoá lưu (KHÔNG tự chuyển sang sửa chỉ tiêu kia). Mở sẵn ở kỳ + phạm vi trống đầu tiên. Gợi ý "Kỳ trước".
- Chỉ dựng phần design HIỂN THỊ: bỏ khối kết luận, cột thời gian, pips, chú giải, ghi chú dưới bảng (prototype tính nhưng không render).
- Màu không token: ô quý + nhãn "Đang thực hiện" = sắc trung tính foreground; chậm tiến độ = warning; "Chưa thu" = chữ thường + chấm warning.
**Consequences:** Không migration. Lib hiển thị `src/lib/ownerTargetView.ts` (+test). Thanh chia tiền dùng chung `overview/recoverySegments.ts` với `RecoveryBar`. Nếu cần lại ghi chú "không tính N tài sản bỏ cọc" thì thêm vào `TargetContributionCard`.

## 2026-09-27 — Menu "Hợp đồng" (3 loại) + hợp đồng dịch vụ thật + mẫu hợp đồng ở admin

**Context:** Cổng chủ tài sản chỉ có "Hợp đồng mua bán"; hợp đồng ký gửi nằm lẫn trong trang Ký gửi; 4 dịch vụ trả tiền (VR, giám định, TVPL, TVĐG) không có văn bản hợp đồng; admin không xem được hợp đồng nào và mẫu điều khoản là hằng số TS chưa rà soát pháp lý.
**Decision:**
- **Người dùng chốt:** menu "Hợp đồng" quản lý ký gửi / mua bán / dịch vụ; hợp đồng dịch vụ là HỢP ĐỒNG THẬT — đồng ý trước khi trả, lưu bản chụp + phiên bản mẫu; admin XEM mọi hợp đồng + QUẢN LÝ MẪU; admin nhóm nav mới "Pháp lý & Đấu giá" (chuyển "Văn bản pháp lý" vào đây).
- Tự quyết: mã `HDCU` (HDDV đã là hợp đồng dịch vụ đấu giá); cổng trả tiền = trigger theo `paid_at` (không chép lại 4 `_settle_*`), UX gate ở `useCheckoutItem`; Bên A chưa KYC vẫn đồng ý được (thêm `signatory`); Bên B = khối `provider_*` trong mẫu (repo chưa có pháp nhân sàn ⇒ seed `[CẦN NHẬP]`); mẫu = câu chữ theo slot, cấu trúc ở builder, fallback hằng số từng slot; ngày hiệu lực mẫu theo giờ VN, không lùi ngày; admin chỉ đọc hợp đồng (không can thiệp), danh sách qua RPC vì quyền đọc bảng đơn đi theo module từng dịch vụ.
- Hợp đồng ký gửi RỜI trang Ký gửi sang `/chu-tai-san/hop-dong/ky-gui/:contractId` (phối hợp phiên f0); badge tách: `confirm_contract`/`add_address` ⇒ "Hợp đồng", còn lại ⇒ "Ký gửi".
**Consequences:** mig `20260927150001` (contract_templates) + `20260927150002` (service_contracts + RPC) ĐÃ ÁP (psql, ghi schema_migrations). Trigger cổng trả tiền ở `supabase/pending/service_contract_payment_gate.sql` — CHƯA ÁP, chờ FE lên production. Sequence HDCU đã bị nghiệm thu tiêu 1 số (bản đầu tiên thật là HDCU000002). Mẫu dịch vụ cần admin điền Bên B trước khi chạy thật. Luật ở `business-rules.md` §Menu "Hợp đồng", §HDCU, §Mẫu hợp đồng.

## 2026-09-27 — Ký gửi đấu giá: dựng lại theo design + dữ liệu thật cho mọi ô

**Context:** Claude Design "Ky Gui Dau Gia - Danh sach & Chi tiet" (bảng + chi tiết theo giai đoạn); vài ô của design (mã HS, hạn phản hồi, hiệu lực báo giá, ngày dự kiến, chuyên viên, thành tích tổ chức) chưa có dữ liệu.
**Decision:**
- **Người dùng chốt:** bỏ dải "hồ sơ đang chờ bạn"; "Cần bạn xử lý" + badge gồm cả Chưa gửi / Cần gửi thêm (RPC `send_orgs`/`add_orgs`, mig `20260927180000`); nhờ sàn mở cả khi mọi tổ chức từ chối; các ô thiếu phải CÓ dữ liệu thật (mig `20260927140000`): hạn phản hồi 7 ngày, hiệu lực báo giá bắt buộc +30 ngày.
- Tự quyết: giữ "Gửi thêm tổ chức" khi đang chờ/đã có báo giá (design không vẽ) + "Chi tiết phương án" (QuoteDetails) trong bảng so sánh; màu "việc của bạn" = chấm warning + chữ thường (tương phản); tiền theo `formatMoneyShort`. Không thêm "phương thức trả giá lên" (không có dữ liệu).
- UI mới ở `src/components/consignment/owner/**`; xoá ConsignmentPanel/SendToOrgsCard/QuoteComparison/AcceptQuoteDialog.
**Consequences:** Hợp đồng dịch vụ KHÔNG ở trang Ký gửi — nút "Xem hợp đồng" mở `/chu-tai-san/hop-dong/ky-gui/:contractId` (menu Hợp đồng, phiên khác); `CONSIGNMENT_OWNER_ACTIONS` chỉ còn choose_quote/add_orgs/send_orgs. Quyền ký gửi đọc qua `usePostingCanConsign()` (chờ tách ky-gui của RBAC). `owner_consignment_summary` sửa phải dựa bản LIVE (RBAC 20260927170100).

## 2026-09-27 — Cổng chủ tài sản: dấu * đỏ cho trường bắt buộc, bỏ "(tuỳ chọn)"

**Context:** Form ở `/chu-tai-san/*` lẫn lộn: phần lớn không đánh dấu trường bắt buộc, 26 chỗ ghi "(tuỳ chọn)" (có cả helper `OptionalMark`); người dùng đòi thống nhất.
**Decision:**
- Mọi trường bắt buộc có `<span className="text-destructive">*</span>` sau nhãn — xác định từ zod / `canSubmit` / RPC, gồm cả radio/select chọn sẵn; luật có điều kiện ⇒ `*` có điều kiện. Không ghi "(tuỳ chọn)" ở đâu nữa; `OptionalMark` đã xoá.
- **Người dùng chốt:** áp luôn cho dialog dùng chung (hợp đồng mua bán — cả phía người mua + `/portal`, hợp đồng ký gửi, `CreditsTab`); giữ "Tuỳ chọn" khác nghĩa (khoản phí tuỳ chọn trong báo giá / PDF hợp đồng, lọc ngày "Tuỳ chọn...").
**Consequences:** Rule ở `design-system.md` § Owner portal. Test tìm nhãn bằng regex neo đầu. Ô mã vận đơn giám định có nhãn thật. `ShareDraftDialog` không `*` (tệp đến từ "Tạo dự thảo" HOẶC tải lên).

---

## 2026-09-27 — Một kiểu tab / tìm / lọc cho cả Trạm + thiết kế lại "Số hoá tài sản"

**Context:** Cổng chủ tài sản có 4 kiểu tab, 3 kiểu ô tìm, 3 kiểu lọc; người dùng đòi "chỉ 1 style" khi port design "So Hoa Tai San - Danh sach & Chi tiet".
**Decision:**
- **Người dùng chốt:** tab gạch chân + số đếm (kiểu design Số hoá); áp cho MỌI màn `/chu-tai-san/*`. Bộ dùng chung ở `asset-owner-portal/ui/`: `OwnerTabs` (`OwnerTabBar` lọc; `OwnerTabsList`/`OwnerTabsTrigger` trong `Tabs` khi có panel), `OwnerSearchInput`, `OwnerFilterSelect`, `OwnerFilterBar`. Số đếm tab bỏ qua ô tìm.
- Số hoá: trạng thái GỘP `digitizeStatusOf` (`lib/asset-posting/digitizeStatus.ts`) = status + review_status + `consignmentStageOf` + `owner_action` → 1 nhãn / 1 người phải làm / 1 bước trên 4 bước. Chi tiết: dải tiến trình + MỘT nút thay `ConsignmentOverviewCard` và 2 banner duyệt; 3D/VR/Giám định mở thẻ đầy đủ trong dialog.
- **Người dùng chốt:** "Chỉnh sửa" chỉ trước khi gửi tổ chức (nháp / chờ duyệt / cần sửa / sẵn sàng); wizard cho hồ sơ đã lưu mở qua `?ho-so=<id>`, thoát về chi tiết.
**Consequences:** Ngoại lệ không đổi: `AssetViewToggle` (đổi chế độ xem), ô trong dialog/form. Mã hồ sơ = `asset_postings.code` ("HS-0001", mig `20260927140000` của phiên Ký gửi) — tìm kiếm + đầu trang chi tiết. Kỳ ở Tổng quan từ toggle thành select.

---

## 2026-09-27 — Kết quả phiên: một thẻ sổ có tab (theo design)

**Context:** /chu-tai-san/ket-qua có 5 khối (chờ khai, hero, thẻ lệch số liệu, 4 ô thống kê, bảng + 6 bộ lọc). Design "Ket Qua Phien Chu Tai San.html" (Claude Design) gộp thành một thẻ sổ.
**Decision:**
- Tab Cần xử lý (lệch số liệu + phiên chưa khai, xử lý ngay tại chỗ) / Tất cả / Thành / Không thành / Hoãn–Huỷ; tóm tắt "Đã bán · Tỷ lệ thành" bên phải; bảng 8 dòng/trang; bấm dòng mở ngăn chi tiết "Nguồn của con số". Luật chọn nút xử lý lệch chuyển vào `conflictView` (lib thuần, `ownerOutcomesLedger.ts`).
- **Người dùng chốt:** giữ tính năng ngoài design (nút "Khai tài sản ngoài sàn", các lượt đã khai sửa/xoá/khai tiếp — gập trong ngăn); 3 nút Thành/Không thành/Hoãn–Huỷ trong hộp đều MỞ DIALOG chọn sẵn (không lưu 1 chạm, vì cần lý do / loại hoãn-huỷ-rút); thời gian ĐÚNG 5 lựa chọn của design (7 ngày/tuần/tháng/6 tháng/năm nay, mặc định 6 tháng) — kết quả cũ hơn đầu năm nay không xem được trên trang này.
- Bỏ lọc Nguồn + "Chỉ số liệu lệch" (lệch vào tab Cần xử lý). Địa chỉ lấy từ `listings.address` qua `ListingRow.addressLine`; tài sản ngoài sàn hiện "—".
**Consequences:** `OutcomeDueBlock`, `OutcomeConflictSheet`, `OutcomeConflictCards`, `OutcomeTotals`, `OutcomeFilters`, `OutcomesTable`, `OutcomeSourceCard` đã xoá. Huy hiệu menu "Kết quả phiên" của design = chưa khai + lệch; menu hiện chỉ đếm chưa khai (menu do phiên khác làm — chưa đổi).

## 2026-09-27 — Chỉ tiêu nhiều tiêu chí + trang chi tiết

**Context:** Chỉ tiêu chỉ có 2 mục tiêu cố định (tiền, số tài sản) và không có chi tiết; người dùng muốn đặt nhiều tiêu chí, xem được số liệu cộng lại thành chỉ tiêu, danh sách chỉ còn tên + tiến độ.
**Decision:**
- Bảng con `owner_workspace_target_criteria` + cột `name` (mig `20260927124605`); 4 loại: tiền thu hồi, tổng giá trúng, số tài sản đấu thành, số tài sản đưa ra đấu giá (**người dùng chọn**). Ghi qua RPC `owner_save_target` (INVOKER, một giao dịch).
- **Người dùng chốt:** vẫn 1 chỉ tiêu / kỳ + phạm vi; danh sách = tên + MỘT thanh tiến độ chung (trung bình, mỗi tiêu chí tối đa 100%); tên tự sinh điền sẵn.
- Trang `/chu-tai-san/chi-tieu/:id`: thẻ từng tiêu chí + bảng "Số liệu cấu thành" (tổng = số thực tế, cùng `contributionOf`).
- Báo cáo định kỳ chỉ đọc 2 tiêu chí cũ (vá CTE `tg`, payload giữ cấu trúc; parity 24 tổ hợp).
**Consequences:** **Rollout 2 bước (người dùng chốt):** `target_amount`/`target_count` còn giữ vì production đang chạy code cũ — SAU KHI deploy phải DROP 2 cột (đừng tạo file migration sớm). Loại tiêu chí mới chưa vào Báo cáo định kỳ/Tổng quan. `TargetProgressSummary`/`TargetProgressStats` đã xoá.

## 2026-09-27 — Tách "Dòng tiền" thành Thu tiền (tác nghiệp) + Dòng tiền (báo cáo)

**Context:** Trang Dòng tiền trộn việc hằng ngày (quá hạn, ghi thu, đặt hạn) với báo cáo theo kỳ, và hero theo NGÀY TIỀN VỀ lệch nghĩa với thác tiền theo NGÀY PHIÊN. Design "Dong Tien Chu Tai San.html" (Claude Design) tách hai màn.
**Decision:**
- `/chu-tai-san/thu-tien` (Tác nghiệp): tính đến hôm nay, 3 nhóm hạn = bộ lọc, tab Còn phải thu / Đã ghi, huy hiệu quá hạn. **Người dùng chốt:** "Người trúng bỏ cọc" vào menu ⋯ của từng dòng — KHÔNG đặt `AwaitingPaymentBlock` ở đây; Tổng quan "Chờ thu tiền" dẫn tới trang này.
- `/chu-tai-san/dong-tien` (Phân tích): **người dùng chốt** mọi số = tài sản BÁN trong kỳ (Đã thu + Còn phải thu = Giá trúng) dù số mẫu của design trộn "còn phải thu tới hôm nay"; bỏ hero theo ngày tiền về (`periodCashTotals`, `unitBreakdown` xoá). Thác 5 bậc, bỏ giá khởi điểm (theo design). **Người dùng giữ** Dự báo tiền về ở cuối dù design bỏ. Thêm Xuất Excel.
- Thác vẽ bằng HTML thay Recharts (số in sẵn, thanh aria-hidden). Không migration.
**Consequences:** Hai trang dùng chung 1 RPC `owner_cash_flow` (cùng cache với huy hiệu sidebar). HQ nhiều đơn vị chưa kiểm được trên trình duyệt (tài khoản demo đều là staff/viewer) — chỉ có unit test.

## 2026-09-27 — Tổng quan chủ tài sản: 4 khối, việc cần làm chỉ là lối vào

**Context:** Tổng quan có 9 khối ngang hàng (chỉ tiêu, KPI, so sánh chi nhánh, chờ khai, chờ thu, lịch, chờ xác nhận, tồn đọng…); bộ lọc chỉ nằm trong khối Chỉ tiêu. Bản thiết kế "Tổng Quan Chủ Tài Sản" (Claude Design) gộp còn 4 khối.
**Decision:** **Người dùng chốt:** Chỉ tiêu doanh thu → Phân tích danh mục (giá trúng lũy kế theo tuần + 4 KPI so với cùng kỳ năm trước) → Việc cần làm + Lịch 7 ngày. Bộ lọc Đơn vị + Kỳ lên đầu trang. Việc cần làm BỎ nút thao tác (đi ngược §A8.1.4 "actions next to the information" — riêng trang này): mỗi dòng chỉ dẫn tới trang làm việc; dòng mô tả chỉ tên tài sản chờ lâu nhất (người dùng bỏ "Lâu nhất X ngày"). Vì "Người trúng bỏ cọc" / "Đã thu đủ" không có ở trang nào khác ⇒ `OutcomeDueBlock` dời lên đầu Kết quả phiên; thao tác thu tiền (kể cả bỏ cọc) nằm ở trang "Thu tiền" `/chu-tai-san/thu-tien` (phiên khác dựng cùng ngày), dòng "Chờ thu tiền" dẫn tới đó; `BenchmarkBlock` dời sang Phân tích danh mục. KPI theo kỳ: so với CÙNG KHOẢNG NGÀY năm trước (kỳ này mới đi một phần); tỷ lệ thành công chênh điểm %; "Đang tồn đọng" so với cùng NGÀY năm trước (ước tính từ lịch sử phiên, tăng = xấu).
**Consequences:** Không migration. Xoá `DashboardKpiRow`, `PendingConfirmationsBlock`, `StuckAssetsBlock`, `UpcomingAuctionsBlock`, `TargetProgressBlock` (+test). Khối Chỉ tiêu doanh thu đã khớp file thiết kế (đọc được qua DesignSync sau `/design-login`); màu map về token có sẵn (nền = primary phủ trên success, sọc chờ thu = accent, số lớn = primary-hover) vì CLAUDE.md cấm thêm màu. Các khối còn lại vẫn dựng từ đặc tả chữ, chưa rà theo file thiết kế.

## 2026-09-27 — Cổng chủ tài sản: nền xám, thẻ không viền mà đổ bóng

**Context:** §A8 cũ: nền trắng, thẻ `rounded-2xl border`, không bóng. **Người dùng chốt** theo bản thiết kế "Tổng Quan Chủ Tài Sản" (Claude Design): mọi trang cổng chủ tài sản nền xám, thẻ không viền mà có bóng. Nhiều khối trong cổng (số hoá, ký gửi, HĐ mua bán, tư vấn…) dùng chung với cổng khác nên không sửa từng component được.
**Decision:** `<main>` của `OwnerPortalLayout` = `owner-canvas bg-muted`; token mới `--shadow-card` (+ `shadow-card` trong Tailwind). Khối riêng của Trạm (`SectionCard`, `StatTile`, 2 `ActionCard` ở Báo cáo định kỳ, `CashFlowInfoNotes`) đổi thẳng class. Phần dùng chung: luật CSS thuần `.owner-canvas .bg-card.border:not(.bg-card *)` trong `index.css` — bỏ viền + đổ bóng cho thẻ nằm thẳng trên nền; giữ viền mang nghĩa (primary/success/warning/destructive, nét đứt) và viền hover; skeleton trên nền đổi sang màu thẻ. Không `@apply` trong luật này (Tailwind báo circular vì selector chứa `.bg-card`).
**Consequences:** Cổng khác không đổi. Khối mới đặt thẳng trên nền phải là `bg-card` (thiếu nền ⇒ lộ xám; `bg-background`/`bg-muted` không được luật bắt). Thẻ lồng trong thẻ giữ viền. Bản in thêm `print:border` vì bóng không in.

## 2026-09-27 — Cổng chủ tài sản: bỏ top bar, credit + hồ sơ xuống chân sidebar

**Context:** Top bar desktop chỉ còn breadcrumb (trùng tiêu đề `OwnerPageHeader` của từng trang) + số dư credit + avatar; sidebar lại có riêng nút "Quay lại Marketplace".
**Decision:** **Người dùng chốt:** bỏ hẳn top bar desktop. Chân sidebar = dòng credit (số dư, mở `/chu-tai-san/credits`) + hồ sơ (tên, vai trò); menu hồ sơ chứa Quay lại Marketplace / Mua thêm credit / Đăng xuất. Mobile giữ thanh mảnh `OwnerPortalMobileBar` (nút menu + tên cổng). Tab title chuyển sang `OwnerPortalLayout` + `owner-page-titles.ts`. Cổng tổ chức `/portal` giữ nguyên.
**Consequences:** Không còn breadcrumb "cha › con" — trang chi tiết tự lo nút quay lại. Route owner mới thêm tên tab ở `owner-page-titles.ts`.

## 2026-09-27 — Tách menu "Ký gửi đấu giá" khỏi "Số hoá tài sản"

**Context:** "Số hoá tài sản" ôm cả việc tìm tổ chức đấu giá: tab Báo giá trong chi tiết hồ sơ chứa gửi tổ chức, nhờ sàn, so sánh/chốt báo giá, hợp đồng dịch vụ; số đếm trên menu "Số hoá tài sản" lại chỉ đếm việc ký gửi (chọn báo giá, bổ sung địa chỉ, xác nhận hợp đồng). Chi nhánh nhiều hồ sơ phải mở từng hồ sơ để biết báo giá nào đang chờ. Bảng Giai đoạn vốn đã coi Số hoá / Chọn tổ chức / HĐ dịch vụ là ba cột khác nhau.
**Decision:** **Người dùng chốt:** menu mới tên "Ký gửi đấu giá" (`/chu-tai-san/ky-gui-dau-gia`, nhóm Tác nghiệp, giữa Số hoá và HĐ mua bán). Luồng TẠO vẫn liền một màn (wizard số hoá kết thúc bằng gửi tổ chức / nhờ sàn), không bắt chuyển menu. Màn CHI TIẾT tách: hồ sơ số hoá chỉ giữ thẻ tóm tắt; chi tiết đầy đủ ở trang ký gửi. Chỉ đổi giao diện — không migration, dữ liệu ký gửi vốn đã tách khỏi `asset_postings`.
**Consequences:** Badge `owner-consignment` chuyển sang menu mới. `?tab=bao-gia` cũ redirect. Thẻ Giai đoạn cột Chọn tổ chức / HĐ dịch vụ mở trang ký gửi. Màn hoàn tất wizard có nút "Theo dõi báo giá". Chưa làm: số đếm riêng cho "Số hoá tài sản" (vd. hồ sơ bị trả về); Sổ tay Chủ tài sản + `docs/owner-guide/capture.mjs` chưa chụp trang mới.

## 2026-09-27 — Cổng chủ tài sản: bỏ nhãn "Nhịp đập" / "Đường ống"

**Context:** P1 đổi "Tổng quan" → "Nhịp đập" và "Tài sản" → "Đường ống" — dịch từng chữ "Pulse" / "Pipeline"; người dùng thấy vô lý ("đường ống" là ống nước).
**Decision:** **Người dùng chốt:** trả về "Tổng quan" (`/chu-tai-san/dashboard`) và "Tài sản" (`/chu-tai-san/tai-san`) ở mọi chữ người dùng thấy (menu, breadcrumb, tab trình duyệt, tiêu đề trang, chữ trong kanban, hướng dẫn mẫu Excel). Tên cổng Trạm/Tháp Điều Hành, tên nhóm menu, route, tên code (`useOwnerPulse`, `PipelineView`, `ownerPipeline`…) và comment giữ nguyên.
**Consequences:** Comment / tài liệu cũ vẫn gọi "Nhịp đập" / "Đường ống" = khái niệm nội bộ, không phải nhãn giao diện. Nhãn mới phải dùng Tiếng Việt thường, không dịch từng chữ thuật ngữ tiếng Anh.

## 2026-09-26 — Trạm Điều Hành P15a: Dòng tiền + Tháp Điều Hành; tách Phase 15; D1 = ví chung

**Context:** Phase 15 ("Tháp Điều Hành" cho trụ sở) quá lớn cho một lượt; tiền của một kết quả phiên chỉ là 4 cột ghi đè, không có lịch sử, phí, hạn hay dự báo; ngân hàng không đọc được sổ tiền HĐMB của lô trên sàn (`org_on_behalf`).
**Decision:**
- **Người dùng chốt:** lượt này chỉ 15a; 15b (xếp hạng chi nhánh + chấm điểm tổ chức), 15c (chỉ tiêu từ trụ sở + duyệt giảm giá), **15d (ví credit chung — D1 = ví chung)** thành prompt riêng; dự báo = còn phải thu theo hạn + ước tính từ phiên sắp tới; khoản thu chi SỬA / XOÁ được (không bút toán đảo).
- Sổ `owner_cash_events`; 4 cột tiền cũ thành TỔNG do trigger `owner_asset_outcomes_money` tính (mọi chỗ đọc cũ giữ nguyên); `defaulted` là cờ tay duy nhất; client ghi thẳng ⇒ P0001. Mig `20260926223747` áp qua psql, SQL 63 PASS (ROLLBACK), trình duyệt 36 PASS.
- Tự quyết: không lưu `branch_id` trên khoản (lấy từ kết quả phiên); tiền đặt trước / phí / hoàn được ghi cho mọi kết quả, chỉ `payment` đòi "thành"; "Đã thu đủ" tính số còn lại ở server (`owner_cash_settle`); lô trên sàn không theo dõi ở đây; ước tính cần ≥ 3 kết quả 12 tháng, cửa sổ phiên +60 ngày.
- Sửa 1 dòng thân `owner_outcomes_overview_core`: `paid_amount` chỉ khi nguồn thắng là bản tự khai (trước đó lô trên sàn thắng vẫn kéo số tự khai vào Chỉ tiêu).
- Tên cổng "Tháp Điều Hành" khi Trạm đang chọn có Trạm con đọc được (`ownerPortalName`); trụ sở không thấy tên cán bộ chi nhánh trên sổ.
**Consequences:**
- Luật "phiên sắp tới" giờ có 2 bản (P10 payload + `owner_cash_flow`) — sửa cùng lúc.
- Một khoản đặt trước ⇒ `partial` ⇒ Đường ống xếp vào "HĐ mua bán".
- Tài sản ngoài sàn đã bán chưa có ở "Chờ thu tiền" của Nhịp đập (thu ở trang Dòng tiền); chưa có huy hiệu quá hạn, nút "bỏ cờ bỏ cọc", nhật ký sửa khoản.

## 2026-09-26 — Trạm Điều Hành P14: liên kết trụ sở ↔ chi nhánh, so sánh ẩn danh, tín hiệu bán hàng

**Context:** Phase 14 của `docs/owner-control-tower-plan.md`. Chi nhánh đã tự onboard (P13) và gửi báo cáo bằng link (P11); giờ cần nối trụ sở vào và báo cho sale khi một ngân hàng "chín".
**Decision:**
- Cây một cấp `asset_owner_workspaces.parent_workspace_id` + bảng `owner_workspace_link_requests` (trụ sở gửi, Trưởng đơn vị chi nhánh đồng ý). Mig `20260926185917` áp qua psql (phiên song song), SQL 77 PASS (ROLLBACK), trình duyệt 34 PASS.
- `owner_ws_can` mở `read` cho Trưởng đơn vị trụ sở. `owner_ws_role` GIỮ chỉ-thành-viên vì guard thành viên dựa vào nó.
- **Người dùng chốt:** trụ sở KHÔNG thấy danh sách thành viên chi nhánh; lead tách riêng mỗi công ty mẹ một cái kể cả khi đã có lead `market_data`; ngưỡng lượt xem N = 10.
- Tự quyết:
  - so sánh chỉ cho thành viên trực tiếp; chỉ số hiện từ 3 chi nhánh, số chi tiết từ 5 (3 giá trị + tứ phân vị giải ngược được);
  - tỷ lệ thành công theo định nghĩa "Kết quả phiên", không theo ô KPI;
  - cha `inferred` vẫn liên kết được (cần chi nhánh đồng ý);
  - liên kết giữ khi danh bạ đổi cha;
  - trụ sở xem cả hợp đồng + dữ liệu người mua của chi nhánh.
- Tách `owner_asset_outcomes_resolved_core` / `owner_outcomes_overview_core` (không kiểm quyền, không client gọi được). Hàm công khai thành vỏ mỏng, chữ ký giữ nguyên, trả đúng như cũ (so trên dữ liệu thật).
**Consequences:**
- Công thức "ngày đầu tiên biết tài sản" giờ có 3 bản (P10 payload, benchmark, TS) — sửa cùng lúc.
- Lượt xem link giờ đếm cả trụ sở đã liên kết.
- Nguồn lead hệ thống (`SYSTEM_SOURCES`) không chọn tay được; lead tín hiệu bị DB khoá nguồn.
- P15 (Tháp Điều Hành) đọc các Trạm con qua liên kết này.

## 2026-09-26 — Trạm Điều Hành P11: link chia sẻ báo cáo /r/:token

**Context:** Phase 11 của `docs/owner-control-tower-plan.md`. Cán bộ gửi báo cáo đã chốt lên trụ sở bằng link chỉ đọc, không cần tài khoản. Dữ liệu nợ xấu rất nhạy cảm (Rủi ro #2), và trang có CTA "Tháp Điều Hành".
**Decision:**
- Thêm cột chia sẻ trên `owner_report_snapshots` + 3 RPC `send_report` (`owner_share_report` / `owner_revoke_report_share` / `owner_report_share_link`) + RPC anon `get_shared_owner_report`. Mig `20260926181355` áp qua psql.
- **Chỉ Trưởng đơn vị thấy / sao chép được token (người dùng chốt).** Thực thi ở server bằng quyền SELECT theo CỘT (không có `share_token`). Thành viên khác chỉ thấy hạn và lượt xem.
- Tự quyết:
  - chỉ chia sẻ báo cáo đã chốt; hạn 1–90 ngày (UI cho chọn 7/30/90);
  - tạo khi link còn hạn = gia hạn, giữ token; hết hạn thì cấp token mới;
  - thu hồi giữ lịch sử lượt xem;
  - thành viên tự mở link không tính lượt xem.
- Payload công khai đi qua `owner_report_public_payload`: danh sách trắng cấp 1 + gỡ đệ quy `id` / `*_id(s)` / `winner*` / `*evidence*`.
- Nới guard cho cột chia sẻ, và cho `created_by` / `finalized_by` về NULL. Đây là vá lỗi P10: trước đó xoá tài khoản từng chốt báo cáo bị chặn, và ở bản nháp SET NULL bị đảo ngược.
**Consequences:**
- Không được `select('*')` trên bảng này.
- AnalyticsTracker che `/r/:token` thành `/r/:id`. `/loi-moi*/:token` vẫn lộ token vào analytics (việc cho sau).
- P14 dùng `view_count` làm tín hiệu mềm, vì anon mở lặp lại vẫn tăng số.

## 2026-09-26 — Trạm Điều Hành P10: Báo cáo định kỳ đóng băng ở server

**Context:** Phase 10 của `docs/owner-control-tower-plan.md`. Đây là "cái móc" để kéo trụ sở vào dùng. Rủi ro #1 của plan là cán bộ "làm đẹp" số trước khi gửi lên, nên số trong báo cáo không được do client gửi.
**Decision:**
- Bảng `owner_report_snapshots`, vòng đời `draft → final`. Nháp: RPC `owner_build_report_payload` tính lại số mỗi lần mở. Chốt: `owner_finalize_report` (`send_report`) để server tự dựng rồi đóng băng. Quyền cột chặn client ghi `status`/`payload`. Mig `20260926172328` áp qua psql, KHÔNG `db push`, vì P4/P12 chạy song song.
- Cán bộ được lập nháp (§A2 "draft reports"), nhưng chỉ cho chi nhánh trong phạm vi của mình.
- **Báo cáo đã chốt không sửa, không xoá (người dùng chốt).** Muốn đính chính thì lập bản mới cho cùng kỳ. Trigger guard chặn cả postgres; ngoại lệ duy nhất là FK chi nhánh SET NULL.
- **Tồn đọng > 90 ngày tính từ lần đầu được biết** (phiên giá / lượt tự khai / ngày tin lên sàn) — người dùng chốt. Dashboard vẫn giữ luật cũ (≥ 2 lượt).
- Phần theo kỳ lấy theo ngày phiên. Phần theo trạng thái (tồn đọng, chờ thu kỳ trước, lịch sắp tới) tính tới `as_of` = ngày lập.
- `owner_report_recovery()` là bản SQL của `recoveryOf()`. Đã so SQL ↔ TS 56/56.
- Trang in là route riêng ngoài `OwnerPortalLayout`, chân trang dùng ô lề `@page`. Excel có 5 sheet, tiền là số.
**Consequences:**
- P11 chỉ nới guard cho cột chia sẻ và dùng lại `ReportDocument`. Payload không có `workspace_id`, id tin, người trúng.
- Hai luật "Tồn đọng" đang khác nhau.
- `/chu-tai-san/ket-qua` chưa có tiêu đề ở TopBar (có từ P8).

## 2026-09-26 — Trạm Điều Hành P12: "Đường ống" kanban theo giai đoạn

**Context:** Phase 12 của `docs/owner-control-tower-plan.md`. Hai loại tài sản không nối với nhau: tin đã nhận (claims) và hồ sơ số hoá (postings). Ba cột đầu chỉ hồ sơ mới có. Dữ liệu không ghi lại lúc nào tài sản "chờ đấu lại". Người dùng chọn chờ P4 xong mới làm.
**Decision:**
- Luật thuần R1–R16 ở `src/lib/ownerPipeline.ts`, adapter ở `ownerPipelineFacts.ts`. Lượt hiện tại quyết định cột; các bước trước phiên chỉ xét khi chưa có lượt.
- **Người dùng chốt "theo lượt kế tiếp":** Không thành = lượt mới nhất không bán được (kể cả bỏ cọc) và chưa có lịch mới. Chờ đấu lại = đã công bố lượt mới sau một lượt trước, hoặc phiên hoãn/huỷ/rút. Tự quyết: "đã bán rồi lại công bố" cũng vào Chờ đấu lại.
- HĐ dịch vụ đã ký mà lô chưa vào phiên đã công bố ⇒ vẫn ở HĐ dịch vụ. Phiên nháp lọc ở client, vì quản lý tổ chức đọc được phiên nháp. Claim "Chờ xác nhận" không lên bảng.
- Không migration: một lượt đọc PostgREST lồng nhau theo tenant, key nằm dưới prefix `my-postings`.
**Consequences:** Lô đấu trực tiếp không bao giờ có kết quả trên sàn ⇒ nằm đỏ ở "Phiên · Chờ kết quả", mà chủ tài sản chưa tự khai được cho hồ sơ số hoá (cần theo sau P8). Chưa lọc theo phạm vi chi nhánh. Tin "đã bán" ước tính (cào) không có ngày ⇒ nằm ở Trúng, không có số ngày.

## 2026-09-26 — Trạm Điều Hành P4: hồ sơ số hoá thuộc không gian (mô hình tenant)

**Context:** Phase 4 của `docs/owner-control-tower-plan.md`. Có ~30 hàm/policy phía chủ tài sản khoá theo `user_id` / `owner_user_id` / `seller_user_id`: hồ sơ, yêu cầu tổ chức, nhờ sàn, hợp đồng ký gửi, bên bán HĐMB, 3D/VR/giám định/tư vấn, storage. Cán bộ nghỉ việc là đơn vị mất hồ sơ.
**Decision:**
- `asset_postings.workspace_id` (NULL = Cá nhân) + `branch_id` (FK kép tới chi nhánh cùng không gian). Mọi quyền đi qua `owner_posting_row_can` / `owner_posting_can`. Mig `20260926152759` áp qua psql; kiểm SQL 47 PASS + trình duyệt 26 PASS, dữ liệu thử đã xoá.
- **Người dùng chốt:** người tạo đã rời đơn vị MẤT quyền. Có cột chi nhánh (Cán bộ bị giới hạn chỉ ghi trong phạm vi). Multi-tenant: mỗi không gian + "Cá nhân", hồ sơ tạo trong tenant đang chọn.
- Backfill KHÔNG chuyển hết: ai vừa có KYC cá nhân vừa có không gian thì chỉ chuyển hồ sơ có hợp đồng mà Bên A là tổ chức. Nếu chuyển hết, CCCD của Bên A cá nhân (demo f10d) sẽ lộ cho cả ngân hàng. Kết quả: harleyngx 8 → "cơ quan", secsosoo 1 → "ngân hàng", 7 ở lại Cá nhân.
- Bên A suy theo HỒ SƠ (`consignment_posting_owner_party`): Cá nhân = CHỈ KYC cá nhân, không gian = KYC tổ chức của không gian. Hàm cũ ưu tiên KYC tổ chức ⇒ sai với người có cả hai.
- Đóng lỗ kèm theo: INSERT hồ sơ "đã duyệt"; UPDATE mọi cột của yêu cầu/nhờ sàn (nay đi qua RPC); người tạo sửa/xoá KYC tổ chức đã duyệt; xoá tệp asset-docs/media; dán đường dẫn tệp người ngoài để đọc (`owner_posting_file_owner_ok`).
- Thanh toán dịch vụ vẫn chỉ người gửi yêu cầu (`_settle_*` không đổi) ⇒ không có chuyện hai người trả cùng một báo giá.
**Consequences:** Mọi policy viết lại đều `TO authenticated` (policy `TO public` gọi hàm đã thu hồi quyền của anon sẽ làm hỏng mọi truy vấn đọc storage của anon). Lần áp đầu chết vì deadlock ⇒ migration khoá trước mọi bảng. P12 đọc `useMyPostings` theo tenant. Tồn: xoá TÀI KHOẢN người tạo vẫn cascade xoá hồ sơ; lead chốt báo giá mang tên cán bộ; chưa chuyển được hồ sơ giữa các tenant.

## 2026-09-26 — Trạm Điều Hành P8: Kết quả phiên, tài sản ngoài sàn, nhập Excel, xử lý lệch

**Context:** Phase 8 của `docs/owner-control-tower-plan.md`. Plan viết "khớp tin theo mã", nhưng `listings` không có cột mã (mâu thuẫn với code). Cờ "Lệch số liệu" chưa có cách nào gỡ. Phần sửa/xoá lượt, P6 để lại cho P8.
**Decision:**
- Mỗi tài sản một dòng (user chọn), đọc từ RPC mới `owner_outcomes_overview`. Server gộp nguồn, client chỉ lọc và cộng tổng. Mig `20260926145216`, áp qua psql. Kiểm bằng 38 kịch bản SQL (luôn ROLLBACK). Kết quả của 28 dòng thật không đổi.
- Mã tài sản = 8 ký tự hex đầu của `listings.id`, hiện trong danh sách; file Excel khớp theo mã này (user chọn thay cho mẫu điền sẵn). Mã không khớp thì báo lỗi, không đoán.
- Định danh tài sản ngoài sàn = cột sinh `title_key`, cộng unique theo lượt ⇒ nhập lại cùng file không nhân đôi dữ liệu.
- Nhập Excel qua RPC SECURITY INVOKER, mỗi dòng một savepoint (tối đa 500 dòng) ⇒ đạt tiêu chí "20 dòng, 2 lỗi ⇒ ghi 18".
- Xử lý lệch bằng dấu vân tay nguồn trong `conflict_resolution.dismissed`. Nguồn bị bỏ qua cũng rời khỏi cửa sổ lượt và khỏi phần chọn nguồn thắng: nếu chỉ tắt cờ thì tổ chức khai ngày mới hơn vẫn thắng. Quyết định bị huỷ khi nguồn đổi số hoặc đơn vị sửa số của mình.
- Vá lỗ của P6: trigger riêng `_guard_scope` luôn suy lại `branch_id` của dòng gắn tin. Không thay guard của P6 vì các phase chạy song song trên cùng DB (bên ghi sau cùng thắng).
**Consequences:** Nhịp đập (KPI P5/P7) chưa tính tài sản ngoài sàn. Chỉ tiêu P9 đã đọc overview. P16 phải loại dòng có `conflict_resolution.adopted` (dùng số tổ chức ⇒ "Đã đối chiếu" mà không có biên bản). P4 thêm guard cho `asset_posting_id`. Rule 44px chạm của `index.css` làm badge nguồn cao trên mobile — có từ trước P8.

## 2026-09-26 — Trạm Điều Hành P13: chi nhánh tự onboard (KYC rút gọn)

**Context:** Phase 13 của `docs/owner-control-tower-plan.md`. Spike trên dữ liệu thật: chi nhánh làm KYC tổ chức thì `run_workspace_match` khớp mờ theo tên, kéo luôn cả công ty mẹ, chi nhánh anh em và AMC. VD "VCB – CN Hà Nội": 24 tin, trong đó chỉ 4 là của chi nhánh. `linked_asset_owner_id` được lưu nhưng không nơi nào đọc.
**Decision:**
- `asset_owner_org_kyc.kyc_scope` (`organization|branch`) + `parent_asset_owner_id`. Không gian có thêm `asset_owner_id` + `match_scope` (`names|entity`), mỗi chi nhánh tối đa MỘT Trạm (unique từng phần).
- `match_scope='entity'` ⇒ `run_workspace_match` chỉ nhận tin đứng tên đúng `asset_owner_id` (`linked_entity`), bỏ qua mọi seed tên. Nhánh tổ chức giữ nguyên khớp mờ.
- **D3 (người dùng chốt):** email công vụ + giấy giao việc / uỷ quyền của GĐ chi nhánh + họ tên, số và 2 ảnh giấy tờ của cán bộ. Không bắt buộc QĐ thành lập, selfie, MST. Hộp thư miễn phí chỉ gắn cờ cho admin, không chặn.
- **Chi nhánh chưa có trong danh bạ (người dùng chốt):** tạo khi duyệt, dưới công ty mẹ đã khai, `parent_source='confirmed'`.
- Server ép phần quyết định phạm vi: trigger nộp hồ sơ `asset_owner_org_kyc_branch_guard` và trigger claim `owner_ws_claims_entity_guard` (chỉ nhận tin của chi nhánh, của trụ sở, hoặc chưa rõ chủ). Luật FE ở `src/lib/assetOwnerKyc/orgKycValidation.ts`.
- Mig `20260926145010` áp qua psql. Kiểm SQL 27 PASS (ROLLBACK) + chạy trình duyệt end-to-end, dữ liệu thử đã xoá.
**Consequences:** `asset_owner_org_kyc` giờ có 2 FK tới `asset_owners` ⇒ mọi embed phải chỉ đích danh FK (PGRST201). P14 dùng `asset_owner_workspaces.asset_owner_id` + `parent_owner_id` để nối HQ ↔ chi nhánh. Còn tồn: người tạo vẫn tự hạ hồ sơ đã duyệt về `draft` được (policy `own_rows` USING không xét status). Phòng giao dịch dưới chi nhánh không được gộp.

## 2026-09-26 — Trạm Điều Hành P9: Chỉ tiêu + luật "Đã thu" theo tiền thật

**Context:** Phase 9 của `docs/owner-control-tower-plan.md`. Plan viết "tổng paid_amount, không có thì lấy giá trúng". Đọc đúng chữ thì tài sản chưa thu tính đủ giá, còn ghi "Thu một phần" lại làm TỤT tiến độ.
**Decision:**
- **"Đã thu" tính theo tiền thật (người dùng chốt).** paid → `paid_amount ?? giá`; partial → `paid_amount`; pending → 0 (hiện riêng "Chờ thu"); defaulted → loại khỏi CẢ tiền lẫn số tài sản. Chỉ nguồn không theo dõi thu tiền (tổ chức tự khai / tin cào) mới tạm tính bằng giá trúng.
- Số liệu dựng từ các dòng `owner_outcomes_overview` của P8, tức CÙNG nguồn với trang "Kết quả phiên". Bỏ bản tự gom (bản ghi đã bán + gộp ngoài sàn theo tên) vì sẽ lệch với trang đó.
- Kỳ tính theo ngày phiên. Tính cả tài sản `pending_confirmation` để khớp KPI và trang Kết quả phiên. Bảng chỉ lưu chỉ tiêu; số đã thu luôn là số tính.
- Quyền ghi giữ `manage_members` đúng chữ plan (người dùng chốt), dù P3 đã tách `manage_workspace`. Hiện hai quyền trùng nghĩa.
- Mig `20260926145733` áp qua psql, KHÔNG dùng `db push`: file P8 lúc đó chưa áp và `db push` sẽ đẩy luôn.
**Consequences:** P10 phải chép `recoveryOf()` sang SQL. Số tài sản của chỉ tiêu = số "đã bán" của trang Kết quả phiên trừ các tài sản bỏ cọc. 11 tài sản bán không có ngày (tin cào) không thuộc kỳ nào. Có thể sau này chuyển sang tính theo ngày thu tiền (`paid_at`).

## 2026-09-26 — Trạm Điều Hành P7: "Nhịp đập" thành danh sách việc cần làm

**Context:** Phase 7 của `docs/owner-control-tower-plan.md`. Có bảng tự khai (P6) rồi thì dashboard phải hỏi cán bộ còn thiếu gì, thay vì chỉ bày số. Dữ liệu thật: 9 phiên đã qua mà chưa có kết quả, 1 tài sản đấu lại mà chỉ có kết quả lượt cũ.
**Decision:**
- Luật chọn việc thuần ở `src/lib/ownerPulse.ts`, dùng chung cho trang và huy hiệu qua `useOwnerPulse()`. **Không migration**: `ref_id` + `payment_status` vốn đã có trong `sources` của RPC.
- "Chờ khai kết quả": phiên đã qua, và chưa có kết quả HOẶC kết quả cũ hơn ngày phiên > 7 ngày (lượt cũ, cùng luật "cùng lượt" của RPC). Plan chỉ nói "chưa có kết quả" — tự thêm vì dữ liệu thật có ca đấu lại. Bỏ claim "Chờ xác nhận" (xác nhận trước rồi mới khai). Tin chỉ có ngày ⇒ tính từ hôm sau.
- "Chờ thu tiền": chỉ ghi được khi nguồn thắng là `owner_report`. Lô trên sàn hiện CHỈ XEM vì tiền ghi ở sổ hợp đồng mua bán phía bên bán, chủ tài sản không ghi được.
- Thao tác: "Đã thu đủ" bấm một lần, toast có "Hoàn tác"; "Thu một phần" ghi số TÍCH LUỸ; "Bỏ cọc" phải xác nhận và giữ nguyên `paid_amount`. Cập nhật đọc lại id, vì RLS lọc dòng mà không báo lỗi.
- Cán bộ bị giới hạn chi nhánh chỉ thấy việc của chi nhánh mình. Người xem thấy danh sách nhưng không có nút. Huy hiệu chỉ hiện với người có quyền ghi.
- "Xem tất cả" mở rộng tại chỗ (chưa có `/chu-tai-san/ket-qua`). KPI dashboard: "Giá trúng" thay ô "Tổng giá KĐ"; `PortfolioOverviewBlock` giữ nguyên.
**Consequences:** Phiên thành rồi bỏ cọc vẫn tính vào "Tỷ lệ thành công" — để P9/P10 quyết. Sidebar giờ tải truy vấn danh mục ở mọi trang của cổng (cache 2 phút, dùng chung với dashboard). P8 có thể trỏ "Xem tất cả" sang trang Kết quả phiên.

## 2026-09-26 — Trạm Điều Hành P3: mời thành viên + chuyển quyền ghi sang vai trò

**Context:** Phase 3 của `docs/owner-control-tower-plan.md`. P2 để thành viên chỉ ĐỌC, FE tìm workspace bằng `owner_user_id` ⇒ người được mời không vào được cổng; Trưởng đơn vị thứ hai bấm nút ghi sẽ lỗi RLS.
**Decision:**
- Mig `20260926140447` (áp qua psql): bảng `asset_owner_workspace_invites` + RPC `owner_ws_create_invite / invite_preview / accept_invite / update_member / remove_member / revoke_invite / list_members`, trả `{ok:false, reason}`. Mọi RPC ghi **khoá dòng workspace trước** (trigger owner cuối đếm không khoá ⇒ hai owner gỡ nhau cùng lúc sẽ cùng lọt).
- **Chuyển quyền ghi sang vai trò NGAY P3** (người dùng chốt): bỏ 3 policy `owner_user_id`; claims ⇐ `owner_ws_claim_write_ok` (write + phạm vi chi nhánh suy từ `asset_owner_id`); chi nhánh / seed / `run_workspace_match` ⇐ action mới `manage_workspace` (chỉ owner). Quyền cột: authenticated chỉ UPDATE được `primary_name/abbreviations/branch_names`.
- **Ghi bảng thành viên CHỈ qua RPC** — bỏ policy ghi trực tiếp của P2 (cho thêm người không cần đồng ý, tự đổi vai trò, né khoá).
- Lời mời chỉ `staff`/`viewer` (người dùng chốt); co-owner = đổi vai trò sau khi tham gia ⇒ guard P2 giữ nguyên.
- Khớp email **CỨNG** (khác lời mời tổ chức); cổng kích hoạt giống tổ chức. Xác thực email đang tắt ⇒ khớp email không chứng minh sở hữu hộp thư, **liên kết là bí mật**.
- Route riêng `/loi-moi-chu-tai-san/:token`: token không mang loại, `InviteAcceptPage` gắn chặt RPC/câu chữ/điều hướng tổ chức; chỉ tách `InviteShell` dùng chung.
- `useOwnerWorkspace()` thay mọi `.eq("owner_user_id")`; nhiều không gian ⇒ nhớ lựa chọn theo user ở localStorage + switcher ở TopBar; layout remount khi ĐỔI (không phải lúc tải xong).
**Consequences:** `run_workspace_match` hết gọi được bằng anon. Người tạo bị gỡ mất toàn quyền (đúng ý). Còn cá nhân tới P4: `OwnerKycGate` ("Số hoá tài sản"), hợp đồng mua bán; mở khoá báo cáo trừ ví riêng (D1). Tài khoản chỉ có SĐT (`…@phone.local`) phải được mời bằng đúng địa chỉ đó.

## 2026-09-26 — Trạm Điều Hành P6: đơn vị tự khai kết quả phiên

**Context:** Phase 6 của `docs/owner-control-tower-plan.md`: 10/28 tài sản của workspace thử không có nguồn kết quả nào; chủ tài sản chưa có cách nói "phiên hôm qua ra sao".
**Decision:**
- Bảng `owner_asset_outcomes` đúng §A4 + trigger guard (ép `reported_by`, suy `branch_id`/`auction_org_id` từ claim/tin, chặn tin ngoài danh mục, biên bản phải là tệp THẬT trong `{ws}/{id}/`). RLS `owner_ws_can` + `owner_ws_branch_ok`. Mig `20260926140659`, áp qua psql.
- `evidence_urls` chứa **đường dẫn** bucket private `owner-outcome-evidence`; ghi theo thứ tự tạo dòng → tải tệp → gắn đường dẫn (policy storage đòi bản ghi đã tồn tại).
- RPC hợp nhất: nguồn `owner_report` chỉ lấy **lượt mới nhất** của đơn vị; hạng 2 `reconciled` (khớp OAR thật cùng lượt, giá ≤ 1%) / 3 `owner_evidence` / 4 `self_reported`. Chọn nguồn thắng **theo lượt hiện tại trước** (≤ 7 ngày so với ngày mới nhất), rồi mới tới hạng — tự quyết, plan không nói; đo trên dữ liệu thật: 0 kết quả cũ đổi.
- Lượt mặc định = lượt lớn nhất đã khai + 1 (không đụng unique khi có lượt bỏ trống). Dialog chờ danh sách lượt TƯƠI rồi mới dựng form.
- Nút "Khai kết quả" gác bằng `canWriteClaim(claim)` của P3 (cùng cách suy chi nhánh với trigger) thay vì hook RPC riêng.
**Consequences:** Chưa có UI sửa/xoá lượt đã khai (P8). `reported_by` không ON DELETE (đúng §A4) ⇒ chặn xoá profile đã khai. `asset_posting_id` chưa kiểm thuộc workspace (P4).

## 2026-09-26 — Trạm Điều Hành P5: hợp nhất giá trúng từ các nguồn sẵn có

**Context:** Phase 5 của `docs/owner-control-tower-plan.md`: cổng chủ tài sản chỉ đọc giá trúng ở `listings.custom_attributes`, bỏ sót phiên trên sàn (`auction_lot_states`) và báo cáo tổ chức (`org_auction_records`). Hai bảng sau không đọc được bởi chủ tài sản dưới RLS.
**Decision:**
- MỘT RPC SECURITY DEFINER `owner_asset_outcomes_resolved(p_workspace_id)` (mig `20260926134757`, áp qua psql) gộp nguồn; client không tự gộp. Hạng: 1 `platform` · 4 `self_reported` (OAR; `source='CRAWLED'` ⇒ `estimated`) · 5 `estimated` (giá cào hoặc `SOLD_RENTED`). Hạng 2/3 để dành P6.
- **Giữ `SOLD_RENTED` làm nguồn "Ước tính"** — plan §A1 bỏ sót; bỏ đi thì KPI rơi 54% → ~18%.
- Kết quả/giá/ngày lấy trọn từ MỘT ứng viên thắng (con số luôn mang nhãn nguồn của nó). Lệch = cùng lượt (ngày ≤ 7 ngày hoặc thiếu ngày) mà khác kết quả hoặc giá > 1% — lượt 1 không thành, lượt 2 bán được KHÔNG là lệch.
- Chữ ký RETURNS TABLE đóng băng, đã có sẵn `resolved_date` + `payment_status` cho P7–P9.
- Bảng tài sản chưa từng hiện giá trúng ⇒ thêm cột "Kết quả" (`OutcomeResultCell` + `OutcomeSourceBadge`).
**Consequences:** Test workspace 4ca4be7b: tỷ lệ thành công 15/28 (54%) → 16/28 (57%) nhờ lô PDG000013. P6 thay thân hàm bằng CREATE OR REPLACE, đổi cột ⇒ DROP. `types.ts` đã regen thật (gen types chạy lại được cùng ngày; bản sinh ra là superset của các entry thêm tay trước đó, chỉ khác định dạng). Mọi mutation khai kết quả phải invalidate `qk.ownerAssetOutcomes`.

## 2026-09-26 — Trạm Điều Hành P2: thành viên không gian chủ tài sản (chỉ DB)

**Context:** Phase 2 của `docs/owner-control-tower-plan.md`: 1 workspace = 1 `owner_user_id` nên chi nhánh ngân hàng không thể có nhiều cán bộ; dữ liệu gắn với cá nhân.
**Decision:**
- Bảng `asset_owner_workspace_members` + 3 vai trò cố định (owner/staff/viewer), không ma trận quyền. Helper SECURITY DEFINER `owner_ws_role/can/branch_ok` (tránh RLS đệ quy, giống `org_has_permission`). Mig `20260926000001` áp qua psql (không `db push` vì migration dở của phiên khác).
- Bất biến ở trigger chứ không ở RLS: owner cuối (port `org_protect_last_owner`) + chỉ owner trao/thu hồi owner. Hai ngoại lệ bắt buộc: **bootstrap** (trigger tạo workspace chạy dưới JWT admin duyệt KYC — admin không phải owner) và **xoá dây chuyền** (không có thì ON DELETE CASCADE chặn luôn việc xoá user/workspace).
- Owner row tự sinh bằng AFTER INSERT trên workspaces ⇒ không phải sửa `create_workspace_on_org_approval`.
- Chỉ THÊM policy SELECT cho thành viên; policy ghi `owner_user_id` giữ nguyên để không đổi hành vi trong phase DB-only.
**Consequences:** Phase 3/4 phải chuyển quyền ghi (workspace/claims/branches, `run_workspace_match`) sang `owner_ws_can` — tới lúc đó người tạo bị gỡ khỏi thành viên vẫn còn toàn quyền qua `owner_user_id`. Bảng có 2 FK tới `profiles` (`user_id`, `invited_by`) ⇒ embed phải ghi tên FK (PGRST201). `types.ts` thêm tay (gen types 403).

## 2026-09-26 — Trạm Điều Hành P1: nav nhóm, khối UI dùng chung, định dạng tiền

**Context:** Phase 1 của `docs/owner-control-tower-plan.md` — cổng chủ tài sản chuyển sang "Trạm Điều Hành"; các phase sau cần MỘT bộ thẻ/tiêu đề/KPI/trạng thái trống thay vì mỗi trang tự vẽ. Plan §A8.3 ghi tiền kiểu vi-VN ("12,4 tỷ", "12.400.000.000 ₫"), trái với quy tắc dấu phẩy đã lưu.
**Decision:**
- Nav `OWNER_NAV_GROUPS` 4 nhóm (Điều hành / Tác nghiệp / Phân tích / Thiết lập); chỉ thêm mục khi route đã có. Nhãn: Nhịp đập, Đường ống, Phân tích danh mục. Tab title đặt ở `OwnerPortalTopBar`, rời cổng thì trả lại.
- Khối dùng chung ở `src/components/asset-owner-portal/ui/` (OwnerPageHeader, SectionCard, HeroFigure, StatTile, ActionCard, EmptyState, IconTile). Màu trạng thái chỉ trên icon/badge, không phủ cả thẻ.
- Tiền: `src/utils/money.ts` — user chọn **phẩy nhóm nghìn, chấm thập phân** ("12.4 tỷ", "12,400,000,000 ₫"), khớp `formatVnd`; đã sửa ví dụ §A8.3 trong plan.
- `PortfolioOverviewBlock` giữ nguyên vì `OwnerReportView` dùng chung; dashboard dùng `DashboardKpiRow` mới.
**Consequences:** Trang owner mới phải dùng khối `ui/` + `money.ts` (design-system.md → Owner portal). Các chỗ `formatPrice` cũ trong báo cáo owner chưa đổi. Badge cảnh báo chữ nhỏ dùng `bg-warning/15 text-foreground` (text-warning thiếu tương phản).

## 2026-09-14 — Gộp 4 menu dịch vụ thành "Yêu cầu dịch vụ"

**Context:** Tư vấn pháp lý, tư vấn đấu giá, giám định, VR tour mỗi loại một menu + danh sách + dialog huỷ/báo giá/hẹn lịch/thẻ hoa hồng chép lại gần y hệt; vận hành không có một chỗ nhìn mọi việc đang chờ. Sắp thêm thẩm định giá và cổng đối tác.
**Decision:**
- Một menu **Yêu cầu dịch vụ** (`/admin/yeu-cau-dich-vu`, nhóm Vận hành & Hỗ trợ): tab loại lọc theo quyền + 5 nhóm trạng thái chung (Chờ báo giá / Chờ thanh toán / Đang thực hiện / Hoàn tất / Đã huỷ; VR `delivered` = Đang thực hiện vì còn chờ gắn lô). Chi tiết `/:loai/:id`; 8 route cũ redirect.
- **Không migration, không gộp bảng**: gộp ở client từ 4 hook danh sách sẵn có (`enabled` theo quyền view). View SQL để dành cho cổng đối tác (khi đó đọc qua RPC che cột).
- **Mã quyền giữ nguyên** (`don-vr-tour`, `don-giam-dinh`, `tu-van-phap-ly`, `tu-van-dau-gia` nằm trong RLS/RPC); menu + route danh sách dùng `anyOf`.
- Registry `src/lib/serviceRequests/` + component `src/components/admin/service-requests/` (shell chi tiết, huỷ, báo giá, hẹn lịch, hoa hồng); phần riêng từng loại chỉ còn editor kết quả. 3D chưa vào (tự động, không báo giá).
**Consequences:** Dịch vụ mới = 1 dòng registry + 1 bộ chuẩn hoá trong `normalize.ts` + trang chi tiết dùng `ServiceDetailShell`. `useUrlFilterState` có thêm `setFilters` (đổi nhiều khóa một lần — gọi setFilter 2 lần liên tiếp thì lần sau đè lần trước). Chưa làm: số đếm trên sidebar, SLA thật (chỉ cảnh báo báo giá hết hạn / quá lịch hẹn), thử UI đăng nhập admin.

## 2026-09-15 — Tư vấn đấu giá (đề xuất phương án trước khi lập phiên)

**Context:** Người bán muốn chuyên gia đề xuất hình thức, giá khởi điểm / bảo lưu, bước giá, thời lượng, cọc trước khi tổ chức lập phiên. Đặc tả BR-CNS-04..06: đề xuất không tự đổi cấu hình phiên; mỗi phương án lưu phiên bản + người tư vấn; dùng được một phần khi lập phiên.
**Decision:**
- Người dùng chốt: **clone khuôn Tư vấn pháp lý** (báo giá riêng + VNPay mô phỏng, admin thay đối tác, hoa hồng lúc hoàn tất); **mỗi phiên bản = một yêu cầu mới**; Lập phiên dùng **panel gợi ý + nút Áp dụng từng trường** (không tự điền); **giá bảo lưu + phương thức khác trả giá lên chỉ tham khảo**, không sửa engine.
- Phương án ở BẢNG CON thay vì cột trên yêu cầu: RLS chủ đơn đọc `*` của yêu cầu nên cột nháp sẽ lộ khi `in_review`.
- RPC tổ chức theo PHIÊN (một lần gọi cho Sửa lô, Thêm lô, bảng lô, Mở lô) và dùng đúng cổng selected + signed của trigger gán lô; chấp nhận cả quyền điều hành để Mở lô đọc được.
- Không đụng `SessionFormCard` (296 dòng) / `BiddingControlRoom` (306): cảnh báo hình thức nằm ở bảng lô, `OpenLotDialog` tự gọi hook.
**Consequences:** Áp qua psql + ghi `schema_migrations`; `types.ts` thêm tay (bảng sinh từ information_schema). Nghiệm thu SQL rollback (scratchpad): nháp 0 dòng cho người bán; `reserve_invalid`/`duration_required`/`deposit_value_invalid`/`field_notes_invalid`; v1 + hoa hồng 20%; tổ chức 0 dòng khi pending, 1 khi accepted, 0 khi declined, org khác 0, anon denied; v2 ⇒ v1 superseded vẫn đọc, decide v1 `invalid_status`; sửa proposal đã chốt ⇒ exception; md5 posting/phiên/lô không đổi. Chưa làm: tài khoản chuyên gia thật, thông báo, lịch sử sự kiện quyết định, engine descending/sealed + enforce giá bảo lưu, extension/max_bid_steps trong đề xuất, thử UI trong trình duyệt.

## 2026-09-15 — Tư vấn pháp lý trong luồng số hoá tài sản

**Context:** Người bán muốn biết hồ sơ pháp lý đã đủ để đưa ra đấu giá chưa. Đặc tả BR-CNS-01..03: kết quả không tự chuyển tài sản sang đủ điều kiện; chỉ người bán + chuyên gia được phân công + admin xem; mỗi lần tư vấn lưu phiên bản + thời gian.
**Decision:**
- Người dùng chốt: **báo giá riêng + VNPay mô phỏng**; **admin thao tác thay đối tác** ("chuyên gia được phân công" = `supplier_id` + `expert_name` trên đơn, truy cập nội bộ bằng quyền module — KHÔNG lọc theo người được gán); **mẫu checklist theo nhóm tài sản ở TS + chuyên gia thêm mục**; khối ở **bước 3 + tab hồ sơ**.
- Clone khuôn Giám định nhưng đối tác gán lúc BÁO GIÁ (không phải người bán chọn) vì điều khoản hoa hồng phụ thuộc đối tác.
- `version` gán lúc hoàn tất chứ không lúc tạo — yêu cầu bị huỷ không đốt số phiên bản.
- Người bán không đọc được items khi chưa hoàn tất (RLS), để checklist nháp không lộ.
- Tệp nộp là bản chụp path trong `asset-docs`, tải thêm vào `legal-consult/` — không ghi ngược vào `asset_postings.doc_urls` (review guard + tránh lộ cho tổ chức có hợp đồng).
**Consequences:** Áp qua psql + ghi `schema_migrations`; `types.ts` thêm tay. Nghiệm thu SQL rollback: path người khác ⇒ `doc_invalid`; người bán 0 item khi `in_review`; thiếu `required_action` ⇒ `item_action_required`; 3 mục cần làm hiện cho người bán; v1→`superseded`, v2 `completed`; `asset_postings` không đổi; admin không quyền 0/0 dòng + `not_authorized`; 2 dòng hoa hồng. Chưa làm: tài khoản chuyên gia thật (lọc theo người được gán), hoàn tiền, thông báo, file ý kiến pháp lý PDF, thử UI trong trình duyệt.

## 2026-09-15 — Giám định tài sản (bước 4 wizard số hoá)

**Context:** Sàn cổ vật chuyên nghiệp giám định trước khi lên catalogue; người mua trả cao cho lô có chứng thư. Đặc tả BR-GD-01..03: chứng thư chỉ do đối tác tải, kết luận tiêu cực chặn nhóm Cổ vật + báo riêng người bán, admin đặt giám định bắt buộc (lô > 50 triệu / người bán bị hạn chế).
**Decision:**
- Người dùng chốt: **admin thao tác thay đối tác** (như VR — BR-GD-01 hiện được enforce bằng quyền `don-giam-dinh:update` + storage policy, chưa phải tài khoản đối tác); **báo giá riêng từng đơn**; bắt buộc = **chính sách tự động + cờ người bán + cờ lô**; khối giám định hiện ở **mọi nhóm**, luật chỉ cắn ở Cổ vật.
- Clone khuôn VR (bảng riêng, RPC `{ok,reason}`, VNPay mô phỏng, hoa hồng qua `resolve_contract_terms`). Khác VR: có kết luận + PDF private; KHÔNG bước "gắn lô" — chứng thư xác thực tự công khai khi hồ sơ được duyệt (AC "tải chứng thư xác thực ⇒ có huy hiệu").
- Cổng nộp hồ sơ là trigger RAISE (không nuốt): người bán phải thấy lỗi. Cổng đưa lô vào phiên là trigger RIÊNG, không sửa `auction_session_items_validate` (đã bị viết lại ở `20260912000005`, phiên song song còn đụng).
- Trả về nháp ghi thẳng `asset_postings.status` từ RPC: guard duyệt chỉ nuốt 5 cột duyệt; tự hạ `review_status` về pending cho caller có quyền approve (guard không làm hộ). Lý do nằm trên đơn, không ghi `rejection_reason` (bị guard nuốt).
- `inconclusive` chỉ trả về nháp khi ở nhóm Cổ vật; `suspected_fake` luôn trả về nháp (đúng AC).
- Mức xác minh là giá trị dẫn xuất 0–4 (chưa từng có khái niệm này trong repo).
**Consequences:** Migration áp qua psql + ghi `schema_migrations`; `types.ts` thêm tay. Nghiệm thu SQL rollback: chính sách chặn nộp, người bán không INSERT được bucket, pay idempotent, level 3, hoa hồng 20%, nghi giả ⇒ nháp + lý do chỉ chủ đọc, chặn nộp lại Cổ vật + chặn đưa vào phiên, cờ lô chặn + chủ không tự gỡ, hồ sơ approved bị `inconclusive` ⇒ draft/pending. Đối tác seed `Trung tâm Giám định Cổ vật & Nghệ thuật` + HĐ `02/2026/HĐHT-GD` 20% + giá gói là GIỮ CHỖ. Chưa làm: tài khoản/cổng đối tác thật, hoàn tiền, thông báo email, rút lô tự động khi đang trong phiên.

## 2026-09-15 — VR tour (đối tác Silver Sea) trong luồng số hoá tài sản

**Context:** Nhà xưởng / BĐS / bộ sưu tập lớn cần trải nghiệm không gian hơn ảnh hay model 3D. Đặc tả BR-VR-01..04: đơn dịch vụ theo trạng thái Báo giá → Đã thanh toán → Đã hẹn → Đã giao → Đã gắn lô, link gắn theo lot_id, chỉ công khai sau khi admin duyệt cùng lô, hoa hồng đối tác ghi trên mỗi đơn Đã giao theo hợp đồng.
**Decision:**
- Người dùng chốt: trả **VND qua VNPay mô phỏng** (không credit); **báo giá riêng** do admin nhập ⇒ thêm bước `requested` trước `quoted`; **admin thao tác thay đối tác** (không cổng đối tác); làm **chồng lên** tính năng 3D.
- Bảng riêng `asset_vr_tour_orders` (`20260915000010`), cùng lý do 3D: review guard nuốt ghi vào `asset_postings`. Mọi ghi qua RPC `{ok, reason}`.
- Dịch vụ `VR tour tài sản` kind commission, `supplier_scope='per_order'` (người bán chọn đối tác trên đơn). Seed supplier Silver Sea + hợp đồng `01/2026/HĐHT-VR` 20% — GIÁ TRỊ GIỮ CHỖ.
- Hoa hồng ghi LÚC GIAO, không lúc trả (đúng chữ BR-VR-03 + AC "Đã giao ⇒ 1 dòng"). Thiếu hợp đồng ⇒ chặn thay vì ghi 0%, vì người thao tác là admin gia hạn được.
- Gắn lô dùng quyền `tai-san-tu-nguyen:approve` (như duyệt model 3D) chứ không quyền của module đơn; KHÔNG tự gắn khi duyệt hồ sơ — "admin duyệt và gắn" là bước chủ động.
- Viewer: iframe sandbox cho mọi link https (link chỉ do admin nhập + duyệt), bỏ ý định allowlist host vì chưa biết domain trình xem của Silver Sea.
**Consequences:** Nghiệm thu trên DB thật trong giao dịch rollback: 3 AC + các mã lý do (`already_active`, `quote_changed`, `already_paid`, `txn_used`, `invalid_url`, `duplicate`, `posting_not_approved`, `no_contract_terms`), RLS user khác/anon 0 dòng, ghi thẳng bị chặn, ẩn/hiện theo review guard, supersede. `types.ts` thêm TAY theo định dạng generator (token CLI là account cũ → 403). Chưa làm: hoàn tiền/huỷ sau trả, sửa link sau giao, cổng/webhook đối tác thật, sổ công nợ sàn→đối tác, seed demo.

## 2026-09-14 — Model 3D cho hồ sơ số hoá ("Thêm 3D", tự quét bằng điện thoại)

**Context:** Ảnh phẳng không thể hiện bề mặt/vết nứt. Đặc tả BR-3D-01..03: model về qua SDK/webhook đối tác, gắn đúng lot_id, chỉ công khai sau khi admin duyệt cùng lô, lô có model mang nhãn "3D". Chưa có đối tác thật, chưa có webhook ngoài nào trong repo.
**Decision:**
- "lô nháp" = `asset_postings`; lot_id webhook = `asset_postings.id`. Bảng RIÊNG `asset_3d_scans` (`20260915000001`) — không cột trên `asset_postings` vì review guard nuốt ghi của service_role và đá hồ sơ đã duyệt về pending.
- Người dùng chốt: TRẢ credit (variant `scan_3d_owner`, 30 — sửa ở /admin/dich-vu). Trừ **atomic ở RPC** `start_asset_3d_scan`; hoàn ở server khi `scan.failed` / hết hạn 24h (lazy, không cron), chốt một lần bằng `refunded_at`.
- Webhook ngoài đầu tiên: edge fn `scan3d-webhook`, `verify_jwt=false`, HMAC `sha256(ts.body)` ±5 phút. Luật nghiệp vụ nằm ở hàm SQL chỉ `service_role` gọi được (attach/fail/mark_processing) — webhook chỉ xác thực chữ ký.
- Công khai = trigger AFTER UPDATE trên `review_status` (WHEN OLD≠NEW, KHÔNG dùng `UPDATE OF`). Model về SAU khi đã duyệt ⇒ ẩn tới khi admin bấm "Duyệt model 3D".
- Đối tác GIẢ LẬP: trang `/doi-tac-3d/quet` + RPC `mock_partner_deliver_asset_3d_scan` (`…0002`), chỉ partner='mock' + đúng token, model luôn là file mẫu CC0 trong bucket `asset-3d`. Viewer: GLB → `@google/model-viewer` (chunk lazy, loại khỏi PWA precache), embed → iframe.
- Người dùng chốt: trang lô công khai = dialog từ `SessionLotList` (không route mới).
**Consequences:** Edge fn CHƯA deploy + secret CHƯA đặt — token CLI trong keychain là account cũ (403); cần login `secsosoo@gmail.com` rồi `functions deploy scan3d-webhook --no-verify-jwt` + `secrets set SCAN3D_WEBHOOK_SECRET`. Thử sau deploy: `scripts/scan3d-send-webhook.mts`. Có đối tác thật: đổi `buildScanDeeplink` + `partner`, xoá RPC/trang giả lập. Báo cáo giao dịch credit đếm hoàn tiền là dòng "nạp" chứ không trừ vào tiêu dùng.

## 2026-09-12 — Giai đoạn sau đấu giá: hợp đồng mua bán, sổ tiền, bàn giao

**Context:** Sau `org_finalize_session`, sàn chỉ biết ai trúng, giá bao nhiêu, hạn 30 ngày và MỘT cờ một-lần `payment_status`. Không có hợp đồng mua bán, không biết đã trả bao nhiêu, không có bàn giao, không có phía bên bán. Công cụ duy nhất của tổ chức là hai cái nút không hoàn tác được.
**Decision:**
- **Sổ tiền thay cho một cái nút.** `auction_sale_payments` chỉ ghi thêm + lịch kỳ hạn; số dư về 0 thì chính RPC sổ tiền lật `auction_lot_states.payment_status='paid'` — giữ nguyên cột Bước 6 đọc thay vì đẻ cột mới. Hai người ghi cùng một cột ⇒ `org_confirm_winner_payment` được thêm cổng `sale_contract_exists` ở SERVER, không chỉ ẩn nút ở UI.
- **Hoàn bút toán là DÒNG MỚI** (`reversed_payment_id`), giữ `amount > 0`. Phân bổ FIFO **tính lại từ đầu** chứ không cộng dồn — nhờ vậy một lần hoàn tự mở lại đúng các kỳ đã đóng mà không cần logic đi ngược, và bản TS `allocateFifo` chỉ là một vòng lặp thay vì phát lại lịch sử.
- **Bên bán suy từ NGUỒN của lô, không thêm cột.** `auction_session_items` cố ý không có chủ sở hữu; lô ký gửi có chủ tài sản CÓ tài khoản, lô tin đăng chỉ có thực thể danh bạ KHÔNG tài khoản ⇒ hai `seller_kind`, và `seller_unresolved` là nhánh thật (hợp đồng ký gửi huỷ sau khi lô vào phiên; ~20% tin đăng không có `asset_owner_id`).
- **Người dùng chốt:** hỗ trợ lô tin đăng qua `org_on_behalf`; trang bên mua là route độc lập `/hop-dong-mua-ban/:id`; **hoãn** Bước 6b (trả góp qua VNPay mô phỏng); seed demo là phiên PDG000014 độc lập.
- **Một thân trang cho ba cổng.** `SaleContractBody` dùng chung cho cổng tổ chức, người trúng và chủ tài sản; vai người xem suy từ `can_act` của RPC chứ không từ route — nên người vừa là thành viên tổ chức vừa ký thay bên bán thấy đúng hai nút xác nhận, không cần nhánh giao diện riêng.
- **Bỏ ý định dùng GUC cho `auction_lot_states`.** Bảng đó không có guard trigger (chỉ `set_updated_at`), nên RPC ghi thẳng; ngược lại `_bidding_ctx` LÀ bắt buộc khi đụng `deposit_status` vì `auction_bidding_contracts_bidding_lock` chặn sau khi phiên đã chốt. Kế hoạch ban đầu ghi ngược cả hai.
**Consequences:** Nghiệm thu trên DB thật trong giao dịch rollback: toàn bộ vòng đời dự thảo → ký → thu đủ → bàn giao → `completed`, và mọi mã lý do (`already_exists`, `lot_defaulted`, `installments_mismatch`, `amount_exceeds_balance`, `invalid_path`, `already_confirmed`, `document_changed`, `already_completed`, `sale_contract_exists`) trả đúng như tài liệu; `buyer_refused` mất cọc + lô `defaulted`; RLS: người lạ và anon thấy 0 dòng trên cả bốn bảng. 133 test mới (702 pass; 4 lỗi cũ trong `auctionPriceAnalytics.test.ts` không đụng tới). Mẫu `HDMB-MAU-2026-09` CHƯA rà soát pháp lý và IN CCCD cả hai bên ⇒ bucket private, mục kiểm chứng của migration khẳng định không có policy anon. Chưa làm: Bước 6b, Điều 51/72, sổ thanh toán tổ chức→bên bán, trang admin cho hợp đồng mua bán.

## 2026-09-12 — Đấu giá trực tuyến Bước 6: chốt kết quả, thanh toán, biên bản

**Context:** Bước 1–5 chạy được từ lúc mở lô tới lúc `pg_cron` đóng lô rồi DỪNG: không chốt được kết quả, không xác nhận thanh toán, không hoàn tiền đặt trước, không biên bản, không công khai kết quả. Backend (4 RPC + bảng biên bản + sổ tiền đặt trước + bucket) và 4 mutation client đã có từ `20260913000001` nhưng chưa component nào gọi ⇒ Bước 6 KHÔNG cần migration.
**Decision:**
- **Tách "vào được phòng" khỏi "trả giá được".** `org_finalize_session` đẩy mọi tiền đặt trước đã nộp khỏi `received`, mà `useMyBidderStatus` coi mọi thứ khác là `no_deposit` ⇒ chốt phiên xong là cả phòng bị đuổi bằng câu SAI. Thêm mã `settled`/`refunded`, đổi nhánh `forfeited` thành `view_only { reason }`, đổi prop `canBid: boolean` thành `noBid: NoBidReason | null`. `view_only` đòi `bidderNo != null`, không thì `blocked("no_bidder_no")` — thiếu nó trang render `null` (màn trắng), lỗ vốn đã có sẵn cho `forfeited`.
- **Biên bản KHÔNG in số thứ tự phát hành, cũng không in hash của chính nó.** `sequence_no` do server cấp SAU khi tệp đã vào storage (`file_missing` chặn trước), tệp bất biến, `pdf_path` UNIQUE ⇒ không dựng lại được để in số. In số đoán = ký tờ giấy có thể mâu thuẫn với sổ. Giấy mang THỜI ĐIỂM LẬP; số thứ tự + SHA-256 hiện cạnh link tải.
- **Thử lại chỉ gọi lại RPC, không bao giờ tải lại tệp.** Chốt trùng đọc `auction_session_minutes.pdf_path` chứ không đọc `storage.objects`, nên gọi lại cùng đường dẫn: thành công nếu lần trước chết trước INSERT, `invalid_path` nếu đã ghi — cả hai đều là kết luận đúng.
- **Điều kiện chốt tính ở client theo `lotPhaseOf`, không theo `state.status`**, vì server chỉ trả `lots_not_closed` + một con số còn đấu giá viên cần biết LÔ NÀO; và vì dòng `open` quá `ends_at` vẫn ghi `open` trong DB đúng lúc `org_finalize_session` sắp tự đóng nó.
- **Kết quả công khai chỉ hiện sau `finalized_at`** (người dùng chọn) — cùng mốc RLS mở biên bản cho khách; không có chế độ "kết quả sơ bộ". **Số tiền in kèm chữ** (người dùng chọn) ⇒ `soThanhChu.ts`. **Đấu giá viên chọn từ `org_auctioneers`** (người dùng chọn).
**Consequences:** Nghiệm thu trên DB thật + Chrome headless: hash tệp tải về khớp `content_hash` tuyệt đối; ẩn danh đọc được biên bản + trạng thái lô nhưng events/contracts = 0. Kéo theo 4 vá nợ cũ: `DepositStatus` thiếu `applied`/`pending_refund` (5 màn hiện nhãn trống sau khi chốt), `finalized_at` được KHAI mà không select (3 truy vấn công khai), `SessionStateBadge` thiếu nhãn đã chốt, lời InfoBox "chỉ còn để tra cứu" thành sai. `src/test/setup.ts` phải bọc `window` vì `hash.test.ts` chạy môi trường node (jsdom 20 không có `SubtleCrypto`). Chưa làm: mẫu biên bản CHƯA rà soát pháp lý (`MINUTES_TEMPLATE_VERSION` = `BBDG-MAU-2026-09`); không có đường hoàn tác xác nhận thanh toán; tệp mồ côi trong bucket không xoá được.

## 2026-09-12 — Đấu giá trực tuyến Bước 4: phòng trả giá công khai

**Context:** Engine (Bước 1) + phiên demo (Bước 2) + hook/luật client (Bước 3) đã xong nhưng KHÔNG có màn hình nào dùng — người đã nộp tiền đặt trước chỉ trả giá được bằng `psql`. Kế hoạch: `docs/online-auction-plan.md` Bước 4.
**Decision:**
- `/sessions/:id/dau-gia` là route CÔNG KHAI, không bọc `ProtectedRoute` (nó `Navigate` sang `/auth`); ẩn danh thì mở `AuthDialog` tại chỗ như các trang phiên khác.
- **Chưa đủ điều kiện ⇒ chặn CẢ TRANG** (người dùng chọn), không cho xem giá/diễn biến dù RLS cho phép.
- Chuỗi cổng là HÀM THUẦN `roomGateOf()` (`src/lib/bidding/roomAccess.ts`), không phải nhánh trong JSX ⇒ test được; thêm 2 nhánh kế hoạch bỏ sót: `cancelled` (truy vấn công khai trả cả phiên huỷ) và `not_started` (trước `starts_at` mọi RPC trả `session_not_live`).
- **`forfeited` là nhánh RIÊNG:** rút giá xong `deposit_status='forfeited'` ⇒ `useMyBidderStatus` báo `no_deposit`, câu đó SAI với họ. Giữ trang, khoá ô trả giá.
- Đồng hồ tự đổi định dạng theo độ dài (người dùng chọn); lô TẠM DỪNG thì ẨN đồng hồ vì `org_resume_lot` cộng bù nên `ends_at` đang cũ.
- Tách `BiddingRoom` khỏi trang vì `useLotStates` mở socket trong effect vô điều kiện — để trong trang là mở kênh cho cả người bị chặn.
**Consequences:** Nghiệm thu trên DB thật: realtime 836 ms không reload, gia hạn đẩy đồng hồ, mọi câu từ chối trùng server (kèm số tiền). Đăng nhập tài khoản demo bằng magic link do service_role sinh — KHÔNG đổi mật khẩu ai. Bước 5 (phòng điều hành) sẽ thay việc mở lô bằng `psql`; chưa có: rút ngắn `ends_at` cho demo, kết quả công khai (Bước 6).

## 2026-09-12 — Đấu giá trực tuyến Bước 1: engine trả giá ở SQL

**Context:** Phiên đã công bố chỉ có hồ sơ + tiền đặt trước, không có trả giá/kết quả. Luật sửa đổi + NĐ 172/2024 đòi ghi nhận lượt trả giá chống sửa đổi, giờ server. Kế hoạch: `docs/online-auction-plan.md`.
**Decision:**
- Mig `20260913000001`: `auction_lot_states` + `auction_bids` / `auction_lot_events` / `auction_deposit_events` / `auction_session_minutes` CHỈ GHI THÊM (trigger chặn UPDATE/DELETE, FK RESTRICT, không policy ghi); RPC `{ok:false, reason}`; khoá `'lot:'||lot_id`; `clock_timestamp()` sau khi khoá.
- Rút giá chỉ ảnh hưởng LÔ đó (người dùng chọn): tịch thu tiền đặt trước ngay nhưng giữ dẫn đầu lô khác. Biên bản công khai SAU chốt (người dùng chọn) ⇒ PDF không CCCD/địa chỉ.
- Guard khoá quy tắc/giá lô/tiền đặt trước khi đã bắt đầu trả giá; RPC lách bằng GUC `app.bidding_rpc`. Sổ tiền đặt trước = trigger trên `deposit_status`.
- Module quyền `dieu-hanh-dau-gia` (view/operate/finalize); pg_cron `close_due_lots` mỗi 10s + đóng lười trong RPC.
**Consequences:** 55 check (rollback) pass trên DB thật. Bước 2 seed PDG000013 (teardown phải DISABLE TRIGGER) + test 2 client đồng thời; Bước 3–6 UI. Chưa: rate limit, rà soát pháp lý, trang đấu giá được phê duyệt.

## 2026-09-12 — Hỏi đáp theo tài liệu phiên + hộp thư đa kênh (sàn + Zalo giả lập)

**Context:** Người mua hỏi đi hỏi lại ~20 câu (tiền đặt trước, hạn, xem tài sản, bước giá) qua điện thoại/Zalo, câu hỏi 9 giờ tối thì mất khách. Sai một con số = mất khách + khiếu nại doanh nghiệp có giấy phép ⇒ từ chối được, đoán thì không.
**Decision:**
- Nguồn DUY NHẤT = điều khoản ĐÃ XÁC NHẬN của chính phiên (`case_documents` + `case_document_clauses`, mig `20260912000100`); loại thứ 5 `clarification` = giải đáp bổ sung sinh từ câu hỏi chuyển tiếp. Trích xuất PDF là GIẢ LẬP, thiếu dữ liệu ⇒ `[[CẦN NHẬP]]`, CHECK chặn xác nhận.
- Cổng trích dẫn ở SQL (`case_qa_apply_proposal`, mig `20260912000101`): engine chạy trên trình duyệt nên client chỉ gửi đề xuất `{clause_id, quote}`; server kiểm nguyên văn rồi TỰ dựng câu trả lời; CHECK `chat_messages_ai_must_cite` là lưới cuối.
- Tự gửi vs soạn nháp = cấu hình tổ chức theo từng kênh (`org_chat_settings`, mặc định nháp); module `hoi-dap` (trả lời) tách `hoi-dap-cai-dat` (bật tự gửi).
- Bảng chat chỉ có policy SELECT cho tổ chức; người mua đọc qua `my_case_questions` (không bao giờ thấy nháp).
**Consequences:** Edge Function `answer-case-question` / `extract-case-document` / `zalo-oa-webhook` thay mock ⇒ bỏ `_proposal`. `useDeleteAuctionSession` chưa dọn prefix storage `case-documents`. Chưa báo người mua khi chuyên viên trả lời muộn (trang tự hỏi lại mỗi 15s). Chồng lấn khái niệm với mẫu thông báo của "Tiếp thị phiên" — chưa hợp nhất.

## 2026-09-12 — Tiếp thị phiên: danh bạ khách của tổ chức + truy vấn chọn người nhận + gói tiếp thị có mẫu thông báo khoá

**Context:** Dựng xong phiên thì tổ chức phải chủ động bán — chủ tài sản chấm tổ chức theo số người trả giá thật và giá chốt. Cần biến hồ sơ vụ việc thành bản đăng từng kênh + danh sách gửi, trong khi thông báo đấu giá có phần câu chữ không được viết lại.
**Decision:**
- Sàn KHÔNG cấp dữ liệu người mua (người dùng chọn). Tổ chức tự nhập/import khách: `org_contacts` + `org_contact_interests` (nhiều dòng/khách) + `org_contact_groups` (mig `20260912000010`), module `khach-hang`, KHÔNG policy admin sàn, composite FK `(id, organization_id)` chặn gắn chéo tổ chức. Đồng ý nhận tin `notifications_enabled` mặc định FALSE (cùng ngữ nghĩa profiles).
- Chọn người nhận = RPC `org_session_audience` (mig `…12`) — nguồn DUY NHẤT của luật khớp, không bản TS, không chấm điểm. Phân khúc `lot:<item_uuid>` | `multi` (không theo `lot_no` vì trigger đánh lại số).
- Mẫu thông báo đấu giá sống trong CODE (`src/lib/outreach/noticeTemplate.ts`, khoá hash theo phiên bản); DB chỉ lưu version + ô `draft`. Ô chia fact (đọc từ phiên) / case (tổ chức nhập) / draft (trình soạn điền).
- Gói tiếp thị (mig `…13`): mọi ghi qua RPC `outreach_*`; `session_outreach_fields/edits/sends` chỉ có policy SELECT ⇒ không lách được nhật ký. Sinh lại không đè trường sửa tay (ghi `suggest`). "Gửi" = sao chép/xuất + đánh dấu; liên hệ từng khách phải nằm trong audience đủ điều kiện, chỉ trong hạn nhận hồ sơ.
- Trình soạn = engine mock tất định; seam đổi sang LLM ở `useOutreachGeneration` (người dùng chọn chưa gọi mô hình).
**Consequences:** Fixture SQL của matcher 0 dòng lệch; 23 kịch bản RPC/RLS (rollback, user không-admin) pass. Việc sau: pháp chế rà soát mẫu `2026-09-12`; Edge Function LLM; hợp nhất với `case_documents` doc_type `notice` (Hỏi đáp tài liệu phiên, làm song song) để không có hai bản thông báo; ánh xạ tỉnh sau sáp nhập 2025; gửi SMS/Zalo thật phải theo NĐ 91/2020.

## 2026-09-11 — Hồ sơ tham gia đấu giá bán qua sàn (VNPay mô phỏng) + VNeID mô phỏng

**Context:** Phiên đã công bố không có lối đăng ký; `max_registrants` chỉ là trần suông. Tiền hồ sơ về lý là của tổ chức đấu giá — ghi `direct` sẽ thổi phồng doanh thu sàn.
**Decision:**
- Mig `20260911000005`: `auction_bidding_contracts` (1 hồ sơ / phiên × người mua, private, KHÔNG policy ghi — mọi ghi qua RPC), `auction_sessions.dossier_fee`, `user_verified_identities`, module quyền `ho-so-tham-gia`.
- Mỗi lần bán = đơn **`commission`** (gross = tiền hồ sơ, amount = phần sàn theo hợp đồng). Chỉ bán khi tổ chức có supplier + hợp đồng phủ variant `auction_dossier_fee`; KHÔNG fallback direct (người dùng chọn).
- Giữ chỗ 15', trần = paid + hold còn hạn, khoá advisory `'bidding:'||session_id`. Số báo danh chỉ sau khi `deposit_status='received'`.
- `pay_bidding_contract` / `save_vneid_identity` MÔ PHỎNG (tin client) — hàm thật `_settle_bidding_contract` đã REVOKE; seam VNeID FE ở `useVneidLink`.
**Consequences:** 33 kịch bản SQL (rollback) pass. Việc sau: Edge Function IPN VNPay + OAuth VNeID rồi thu hồi 2 wrapper; sổ khoản phải trả cho tổ chức (gross − amount); hoàn tiền hồ sơ khi huỷ phiên. Tổ chức demo chưa có hợp đồng ⇒ nút mua ẩn cho tới khi admin tạo.

## 2026-09-11 — Ký gửi: dự thảo hợp đồng tự sinh + badge việc chờ hai bên (bước 3)

**Context:** Tổ chức soạn hợp đồng từ trang trắng trong khi điều khoản đã có cấu trúc sẵn trong báo giá đã chốt; và không bên nào biết mình đang bị chờ (không notification).
**Decision:**
- PDF dự thảo `src/lib/consignment/contract-pdf/` dựng CHỈ từ bản chiếu `org_consignment_contract` (không đọc bảng sống), palette FORMAL của hồ sơ ĐGV. Tiền theo `formatVnd` như màn so sánh báo giá; tổng phí in `terms.service_fee` — không nhân bản công thức phí lần thứ ba. Điều khoản mẫu tách `clauses.ts` + `CONTRACT_TEMPLATE_VERSION`, luôn in dấu "DỰ THẢO".
- Runtime pdfmake (dò vfs, addVirtualFileSystem, Lora) chuyển về `src/lib/pdf/pdfmakeRuntime.ts`, hồ sơ ĐGV dùng lại.
- Mig `20260912000007`: `org_service_request_counts.contracts_action`; RPC `owner_consignment_summary()` SECURITY INVOKER (RLS own-rows đủ) trả `owner_action` confirm_contract > add_address > choose_quote.
**Consequences:** Điều khoản mẫu CHƯA được rà soát pháp lý — cần người có chuyên môn duyệt trước khi quảng bá tính năng. Badge làm mới theo staleTime 60s + invalidate khi chính người dùng thao tác; bên kia thao tác thì chỉ thấy khi refetch (chưa realtime/email).

## 2026-09-11 — Ký gửi: hợp đồng dịch vụ đấu giá giữa chủ tài sản ↔ tổ chức trên sàn (bước 2)

**Context:** Sau khi chốt báo giá, hợp đồng nằm hoàn toàn ngoài sàn ("Sàn sẽ liên hệ"): không bên nào thấy tiến độ, tổ chức đã trúng không có danh tính / giấy tờ của chủ tài sản để soạn hợp đồng, và đưa được tài sản vào phiên khi chưa có hợp đồng.
**Decision:**
- Bảng `consignment_contracts` + `consignment_contract_events` (mig `20260912000003`), tạo trong `owner_select_service_quote`. Ký ngoài sàn: tổ chức chia sẻ dự thảo → một bên tải scan → CẢ HAI xác nhận. Không chữ ký số.
- 6 RPC (`20260912000004`, `{ok:false}`): share_draft · attach_signed · confirm (gửi kèm path) · cancel · `org_consignment_contract` · `org_service_requests` thêm cột hợp đồng. Tổ chức KHÔNG có policy đọc bảng (chứa CCCD).
- Huỷ trước khi ký ⇒ request `contract_cancelled`, mở lại đúng các báo giá bị đóng, cơ hội CRM `lost`.
- Thông tin Bên A/B lưu VĨNH VIỄN: địa chỉ trên KYC chủ tài sản (`20260912000002`, sửa sau duyệt qua RPC) + người đại diện từ `org_general_info`. Thiếu ⇒ `party_incomplete`.
- Phiên đấu giá (`20260912000005`): thêm lô ký gửi và công bố phiên đòi hợp đồng `signed`. Seed demo `…06` đánh dấu signed.
**Consequences:** ~45 kịch bản SQL rollback pass. Dữ liệu hiện tại KHÔNG tổ chức nào có `legal_rep_name` ⇒ tổ chức phải cập nhật Thông tin chung trước khi chia sẻ dự thảo. Còn P3: tự sinh PDF dự thảo (điều khoản cần pháp lý duyệt) + badge việc chờ.

## 2026-09-11 — Ký gửi: "chốt 1 báo giá / hồ sơ" enforce ở DB (bước 1 của luồng hợp đồng)

**Context:** Luật chỉ nằm trong `owner_select_service_quote` (kiểm status của chính dòng được chọn) ⇒ vẫn ra 2 dòng `selected`: tổ chức `declined` báo giá lại sau khi chủ chốt tổ chức khác; insert/dispatch sau khi chốt; race. Phiên đấu giá tra `selected LIMIT 1` nên hai tổ chức cùng đưa được một tài sản vào phiên. Là tiền đề cho hợp đồng dịch vụ owner↔tổ chức (plan `~/.claude/plans/on-asset-owner-site-atomic-neumann.md`).
**Decision:**
- Mig `20260912000001`: partial UNIQUE `(asset_posting_id) WHERE status IN ('selected','accepted')` + advisory lock `lock_asset_posting_consignment` (không `FOR UPDATE` asset_postings — review guard) + trigger `asr_guard_insert_after_selection`. Chặn báo giá theo HỒ SƠ (`asset_posting_selection_locked`), không theo dòng.
- Anh em bị đóng ghi `closed_by_request_id` + `status_before_close` ⇒ huỷ hợp đồng sau này mở lại chính xác, không đoán.
- `owner_select_service_quote` / `org_respond_service_request` trả `{ok:false, reason}` cho lỗi nghiệp vụ; FE `assertRpcOk` (`src/lib/consignment/errors.ts`), invalidate ở `onSettled`.
- FE: `AcceptQuoteDialog` trước khi chốt; chi tiết hồ sơ thành route `/chu-tai-san/dang-tai-san/:id`, cổng KYC chuyển lên layout `OwnerKycGate`; tách `SendToOrgsCard`.
**Consequences:** 10 kịch bản SQL (rollback) pass. Mọi RPC ký gửi mới phải theo cùng thứ tự khoá (advisory → FOR UPDATE dòng). Bước 2 (bảng hợp đồng, huỷ & chọn lại, gate phiên) còn chờ.

## 2026-09-11 — Báo giá ký gửi có phương án + khoản mục; phí & lead time là giá trị DẪN XUẤT ở server

**Context:** Báo giá chỉ có 4 con số rời + một ô ghi chú tự do, nên "phương án tổ chức đấu giá" (hình thức, bước giá, tiền đặt trước, kênh niêm yết, mốc thời gian, phạm vi dịch vụ) nằm trong văn xuôi hoặc trong PDF — chủ tài sản không đặt hai báo giá cạnh nhau mà so từng dòng được. Chi phí cũng chỉ là một số `quote_service_fee`, không tách được khoản bắt buộc với khoản tuỳ chọn.

**Decision:**
- Hai cột JSONB `quote_plan` + `quote_fee_items` trên `asset_service_requests` (migration `20260911000002`), **không bảng con**: báo giá vốn đã denormalize lên chính dòng yêu cầu, ghi đè nguyên khối, và các dòng phí không bao giờ truy vấn độc lập.
- **`quote_service_fee` và `quote_lead_time_days` thành giá trị DẪN XUẤT, tính trong `org_respond_service_request`** — tổng khoản **bắt buộc** (`optional=false`) và mốc `mo_phien`. Client không còn ô nhập cho hai số này.
- Danh mục kênh/mốc/phạm vi/preset phí là **hằng số trong code** (`src/constants/quote-plan.ts`), không master data — nhãn tự do thì mất luôn khả năng so sánh; có ô "khác" cho ngoại lệ.
- RPC `org_service_requests` phải **DROP rồi tạo lại** (đổi `RETURNS TABLE`). Thêm RPC đếm `org_service_request_counts` cho badge sidebar.
- `QuoteDetails` (`src/components/consignment/`) dùng chung cho cả hộp thư tổ chức lẫn màn so sánh của chủ tài sản.

**Consequences:**
- `owner_select_service_quote` lấy `quote_service_fee` làm `opportunities.gross_amount` ⇒ tính ở server là bắt buộc, không phải tuỳ chọn: con số CRM phải đúng bằng con số chủ tài sản nhìn thấy. `QuoteComparison`, báo cáo doanh thu, hoa hồng **không phải sửa**.
- Cặp nhân bản SQL ↔ TS thứ **ba**: `feeTotalRequired()` ↔ `SUM(...) WHERE NOT optional` — xem `common-pitfalls.md`.
- Báo giá cũ (`quote_plan IS NULL`) vẫn hiện đúng như trước; mọi khối mới bọc kiểm null.
- Badge chỉ gọi RPC khi user có quyền `yeu-cau-ky-gui.view` — không thì dính `insufficient_privilege`.

---

## 2026-09-11 — Chủ tài sản gửi yêu cầu báo giá tới NHIỀU tổ chức (RFQ fan-out)

**Context:** Lối "tự chọn" bắt chủ tài sản chọn **đúng một** tổ chức (`chosenOrg: string | null`) rồi gửi một dòng `asset_service_requests` — trong khi sàn ở luồng môi giới đã fan-out N tổ chức từ `DispatchOrgsDialog`. Chủ tài sản muốn so sánh báo giá thì buộc phải "nhờ sàn chọn giúp", và card gửi ở trang chi tiết **đóng vĩnh viễn** sau lần gửi đầu (`requests.length === 0`) nên một lời từ chối là hết đường.

**Decision:**
- `WizardValues.chosenOrg` → **`chosenOrgs: string[]`**; `OrgPicker` thành multi-select (`role="checkbox"`, `selectedIds`/`onToggle`), trần `MAX_RFQ_ORGS = 5` (`constants/asset-posting-rules.ts`). Hook `useSendServiceRequest` → **`useSendServiceRequests`** (một insert nhiều dòng).
- **KHÔNG migration.** `UNIQUE(asset_posting_id, auction_org_id)` + RLS `asr_owner_insert` (`status='sent'`, `origin='owner'`) đã hỗ trợ fan-out sẵn; `ConsignmentPanel`/`QuoteComparison` vốn đã render N báo giá.
- **Trần đếm theo yêu cầu còn sống** (`isLiveServiceRequest`, `types/asset-posting.ts`), tách khỏi tập tổ chức không gửi lại được (`alreadySentIds` = mọi dòng) — xem `business-rules.md`.
- Bỏ luật nhảy-trang-theo-tổ-chức-đang-chọn trong `OrgPicker`: 5 tổ chức có thể nằm 5 trang, không còn "một trang" để nhảy tới. Thay bằng **hàng chip cố định** (bỏ chọn ngay tại đó).
- Một bản brief dùng chung (`AssetBriefEditor.orgName` → `recipientLabel`).

**Consequences:**
- `postingToWizardValues` chỉ dựng lại được 1 tổ chức từ `chosen_org_id` (quan hệ nhiều-tổ-chức nằm ở `asset_service_requests`, cố ý không đọc vào nháp).
- Client phải **tự lọc tổ chức đã gửi trước khi insert** — một dòng trùng làm đổ CẢ lệnh, nên `useSendServiceRequests` query `auction_org_id` hiện có rồi mới insert (UI làm mờ thẻ chỉ là ảnh chụp lúc mở danh sách).
- Trần 5 là **quyết định sản phẩm**, không phải giới hạn kỹ thuật — đổi một hằng số. Chưa enforce phía server: RLS không đếm được số dòng, muốn chặn cứng thì phải bọc RPC.

---

## 2026-09-10 — Chuyển DB sang project + tài khoản Supabase mới (dump/restore, không replay migration)

**Context:** Project cũ `dvdpfjprncvkhfwcvqmp` nằm trong org **Vercel-managed** (`vercel_icfg_…`, tài khoản `harley.ngx@gmail.com`) và đã tự pause (DNS bị gỡ → NXDOMAIN, pooler báo `tenant not found`). Cần sang tài khoản khác (`secsosoo@gmail.com`). 180 migration CHƯA BAO GIỜ replay from scratch (nhiều cái áp lệch thứ tự / áp tay bằng psql) nên replay là canh bạc.

**Decision:**
- **Clone vật lý bằng `pg_dump`, KHÔNG replay migration.** Dump = trạng thái thật; migration chain = giả thiết. Chỉ dump `public` (86 bảng) + data `auth.users`/`auth.identities` + `storage.buckets`/`objects`; `auth`/`storage` DDL là schema Supabase quản lý, project mới đã có sẵn.
- **Nạp data BẮT BUỘC dưới `SET session_replication_role = replica`.** 85 trigger sẽ phá dữ liệu nếu bật: `credit_transactions_create_order` nhân đôi `orders`, `on_auth_user_created` tự đẻ `profiles` chọi với data dump, `asset_postings_review_guard` nuốt row. `pg_dump --disable-triggers` KHÔNG dùng được (cần superuser, role `postgres` của Supabase không có).
- **35 policy trên `storage.objects` + trigger `on_auth_user_created` phải sinh riêng** — chúng nằm NGOÀI schema `public` nên dump `--schema=public` bỏ sót. Sinh DDL bằng `pg_policy`/`pg_get_triggerdef` với `PGOPTIONS="-c search_path="` để mọi tên được qualify đầy đủ.
- **File Storage phải copy riêng** (`scripts/migrate-storage.py`) — `pg_dump` chỉ chuyển ROW, không chuyển byte. Upload bằng service_role làm `owner = NULL`, mà **23/35 policy dựa vào `owner`** → phải chạy `08_storage_objects_fixup.sql` khôi phục `owner`/timestamp ngay sau upload.
- **Diễn tập trên cluster Postgres tạm trước khi đụng project thật.** Bắt được 2 lỗi chí mạng: (1) policy render `'ADMIN'::app_role` không qualify trong khi dump đặt `search_path=''`; (2) generator nuốt mất 31/35 policy vì policy `TO PUBLIC` có `polroles={0}` làm NULL cả câu — nếu lọt thì hồ sơ KYC/tài liệu tổ chức sẽ hở hoặc không ai đọc được.

**Consequences:**
- Project mới **`vewtnkewyawmkpeymdot`** (org `xdehonmlfyobmkxmwfmo`, `ap-southeast-1`, PG 17.6). **Pooler đổi prefix `aws-1` → `aws-0`** — đã sửa trong `.claude/skills/migration/SKILL.md`.
- Đối chiếu xong: 86 bảng / 110 function / 186+35 policy / 312 index / 175 FK / 11 sequence / 180 dòng migration history khớp tuyệt đối; `types.ts` regen ra **y hệt** bản cũ. `orders` vẫn 633 (trigger không nhân đôi).
- **KHÔNG chuyển:** `auth.sessions`/`refresh_tokens`/`mfa_amr_claims`/`one_time_tokens` (41 dòng) → **mọi người phải đăng nhập lại** (JWT secret khác); mật khẩu giữ nguyên (hash bcrypt portable).
- **Nợ ops:** Vercel integration của project CŨ vẫn có thể tự inject `SUPABASE_*` đè `.env` khi deploy — phải gỡ/ghi đè trên Vercel. `site_url` vẫn là `http://localhost:3000` và `uri_allow_list` rỗng (bê nguyên từ project cũ). Chưa có SMTP. Backup dump nằm ở `~/taisandaugia-migration-2026-09-10/` (có email + hash mật khẩu — xoá sau khi yên tâm).

---

## 2026-09-07 — Hợp đồng hợp tác & hoa hồng theo hợp đồng với tổ chức đấu giá

**Context:** Sàn chốt hoa hồng với CTĐG bằng hợp đồng ký NGOÀI nền tảng, nhưng không có thực thể hợp đồng nào trong 175 migration. Mức hoa hồng nằm ở `service_variants.commission_*` — **không có thời hạn**, nên tái ký = ghi đè, đơn cũ mất lời giải thích. `suppliers` cũng không có FK nào tới `auction_organizations` nên không tra ngược được từ "tổ chức nào thắng ký gửi" sang hợp đồng của họ.
**Decision:**
- **`supplier_contracts` (đầu) + `supplier_contract_lines` (mức theo từng dịch vụ)** — `20260907000001`. Một đối tác → nhiều hợp đồng (tái ký) → nhiều dòng dịch vụ. **"Hết hạn" là trạng thái DẪN XUẤT** (`status='active'` + `effective_to < today`), không lưu cờ — lưu cờ thì phải nuôi cron. Logic ở `src/lib/supplierContracts.ts`.
- **Trigger chống trùng gắn ở CẢ HAI bảng**: hai HĐ `active` cùng supplier + cùng service + giao kỳ ⇒ RAISE. Chỉ gác ở bảng dòng là hở cửa sau — sửa `effective_from` của HĐ cũ tạo ra trùng y hệt.
- **`services.supplier_scope` `fixed|per_order`** (`20260907000003`) nới `services_commission_requires_supplier`: "Môi giới ký gửi" là MỘT dịch vụ dùng cho MỌI tổ chức, đối tác nằm trên ĐƠN. Tạo dịch vụ **mới** `Hoa hồng môi giới ký gửi` chứ KHÔNG đổi `kind` dịch vụ ký gửi cũ — đổi tại chỗ sẽ ép mọi cơ hội thành commission kể cả khi chưa có hợp đồng, khoá cứng nghiệp vụ.
- **Resolver hai tầng quyền**: `resolve_contract_terms` (SECURITY DEFINER, `REVOKE` khỏi anon/authenticated — chỉ RPC definer khác gọi) + `admin_resolve_contract_terms` (gác `admin_has_permission('nha-cung-cap','view')`). PostgREST phơi mọi hàm `authenticated` gọi được, mà biên hoa hồng là bí mật thương mại.
- **Đơn vẫn CHỤP ẢNH điều khoản của nó**; `orders/opportunities.contract_id`/`contract_line_id` chỉ để truy vết, báo cáo KHÔNG đọc.
**Consequences:**
- **Bẫy đã dẫm & đã vá (`20260907000004`)**: guard "cơ hội commission phải có `supplier_id`" khoá oan 8 cơ hội đang mở của luồng **công cụ đấu giá** — `request_tool_service` không bao giờ set cột đó vì dịch vụ của chúng là `fixed` (đối tác nằm trên `services.supplier_id`, trigger tự điền). Đối tác hiệu lực phải là `COALESCE(opportunities.supplier_id, services.supplier_id)`; chỉ chặn khi CẢ HAI rỗng.
- Bucket **`contract-documents` PRIVATE** (khác `partner-logos` public): lưu ĐƯỜNG DẪN, mở bằng `createSignedUrl`. `getPublicUrl` trả link trông hợp lệ nhưng luôn 400.
- Trang chi tiết đối tác mới `/admin/doi-tac/:id` dùng lại module quyền `nha-cung-cap` — không đẻ mã module mới nên không phải đụng ma trận quyền đã lưu trong DB.
- Gate tiền: tổng `amount`/`gross_amount`/số đơn bảo toàn tuyệt đối qua cả 5 migration (6,400,728,000₫ / 32,151,598,000₫ / 617).

## 2026-09-06 — Ký gửi tài sản: tự chọn tổ chức HOẶC nhờ sàn chọn giúp

**Context:** `asset_service_requests` là ngõ cụt ghi-một-chiều — chủ tài sản insert một dòng rồi thôi: không màn admin, không màn tổ chức, 4 trạng thái `seen/accepted/declined/withdrawn` không có ai ghi. Và gửi xong chủ tài sản **không thấy gì**: `usePostingDetail` chỉ nạp tổ chức khi `chosen_org_id` có giá trị, mà không đường ghi nào set cột đó.
**Decision:**
- **Hai lối, một bảng.** `asset_broker_requests` (yêu cầu nhờ sàn, 1 dòng mở/hồ sơ) + `asset_service_requests` mở rộng `origin owner|platform` · `broker_request_id` · 7 cột báo giá. `UNIQUE (asset_posting_id, auction_org_id)` SẴN CÓ chính là thứ cho phép fan-out nhiều tổ chức và làm dispatch idempotent.
- **KHÔNG ghi gì vào `asset_postings`** (bỏ ý định set `chosen_org_id`/`status='matched'`): trigger `asset_postings_review_guard` đá hồ sơ đã duyệt về `pending` với mọi caller không có quyền `approve` — kể cả RPC SECURITY DEFINER, vì `auth.uid()` bên trong vẫn là uid người gọi. Tổ chức đã chốt suy ra từ yêu cầu `status='selected'`; đây cũng là cách sửa bug thẻ tổ chức không bao giờ hiện.
- **4 RPC, tổ chức KHÔNG có UPDATE qua RLS**: `admin_dispatch_service_requests` (gate `tai-san-tu-nguyen.update`, chặn org chưa có tài khoản, đòi `review_status='approved'`) · `org_service_requests` (bản chiếu — RLS lọc dòng không giấu được cột, nên KHÔNG trả danh tính chủ / số nhà / giấy tờ sở hữu) · `org_respond_service_request` · `owner_select_service_quote` (đóng anh em thành `not_selected` + tạo lead `asset_brokerage` & cơ hội).
- **Chỉ gửi tới tổ chức ĐÃ CÓ TÀI KHOẢN** — áp cho cả lối tự chọn (`useMatchedOrgs` mặc định `onlyAccounted`). Gửi cho tổ chức không có tài khoản là đẻ lại đúng cái ngõ cụt đang dẹp.
- **`organizations.auction_org_id`** (cột + FK, backfill từ `license_info`) thay cho cast JSONB trong policy: chuỗi rác làm cả query lỗi chứ không trả `false`.
**Consequences:**
- Policy owner `FOR ALL` cũ bị tách thành read/insert/withdraw — chủ tài sản không còn tự đặt được `status='selected'`.
- Hộp thư `/portal/yeu-cau-ky-gui` đi qua `OrgContext` (membership) chứ KHÔNG phải `usePortalOrg` (`owner_id`), khớp `user_in_auction_org()`; nếu không thì chỉ chủ sở hữu tổ chức dùng được.
- Điểm khớp % trong dialog fan-out **vẫn là số bịa** từ băm `org.id` (`deriveOrgAttributes`). Cột `auction_org_id` mới chính là mảnh còn thiếu để nối `org_capacity_profile` — việc riêng, chưa làm.
- Migrations `20260906100001`, `20260906100002` ĐÃ PUSH; types regenerate. `20260906200001` (phiên song song) đổi mã quyền `duyet-tai-san`→`tai-san-tu-nguyen` và đã viết lại RPC của luồng này qua `pg_get_functiondef` — replay từ đầu vẫn đúng vì nó chạy sau.

## 2026-09-06 — Ảnh bắt buộc mọi nhóm; chứng minh sở hữu rẽ theo nhóm cấp 1 (giấy tờ vs cam kết ký điện tử)

**Context:** Wizard số hoá cho tạo hồ sơ **không có ảnh nào** (`imageUrls` không hề nằm trong `requirements()`), trong khi bắt **mọi** nhóm phải tải giấy tờ chứng minh sở hữu. Chỉ bất động sản và xe cộ mới có sổ đỏ / cà-vẹt — máy móc, hàng hoá, đồ dùng thì không, nên cửa chặn đó chỉ tạo ra rác: người dùng tải bừa một tệp để đi tiếp.
**Decision:**
- **`requirements()` là cổng DUY NHẤT** — thêm `imageUrls` (bước 2, `MIN_IMAGES = 1`) và rẽ nhánh `ownershipProofUrls` / `ownershipDeclaration` ở bước 3. **KHÔNG** đụng zod: `zodResolver` có gắn nhưng `next()`/`finish()` không bao giờ gọi `form.trigger()` và `formState.errors` không được render, nên thêm `.min()`/`superRefine` sẽ tạo bản sao thứ hai của một luật pháp lý, không có đường chạy và không có test. Đã xoá `STEP_FIELDS` + `missingRequiredDelta` (0 importer) và sửa comment đầu file vốn mô tả sai cơ chế.
- **`getProofMode(parentSlug)`** trong `constants/asset-posting-rules.ts`, `Record<AssetParentSlug, ProofMode>` khai đủ 6 nhóm ⇒ thêm nhóm cấp 1 mới là typecheck đỏ cho tới khi có người quyết định. Fallback runtime là **`"documents"`** (cố ý lệch với `getDeltaFields(slug) ?? []`): đoán sai theo hướng chặt thành lỗi người dùng báo ngay, đoán sai theo hướng lỏng thì âm thầm giảm tuân thủ.
- **Chữ ký điện tử cấp HÀNG đầu tiên của repo.** `ownership_declaration JSONB {name, accepted_at, version}` + CHECK hình dạng. JSONB chứ không phải cột phẳng như `profiles.terms_accepted_at/terms_version` vì đây là consent theo **từng tài sản**, không phải một dấu trên hàng singleton. Nội dung cam kết (`ASSET_DECLARATION_CLAUSES`) để **cạnh** `ASSET_DECLARATION_VERSION` trong `constants/terms.ts` — tách ra thì version đã lưu chẳng trỏ tới văn bản nào. Chữ ký đòi **≥ 2 từ**, không phải ≥ 3 ký tự: "abc" qua min-length nhưng không phải họ tên.
- **Video 10MB, chung bucket `asset-media`, GIỮ NGUYÊN `file_size_limit`.** `file_size_limit` áp theo bucket và là chốt chặn **cứng duy nhất** (`allowed_mime_types` chỉ soi Content-Type do client tự khai) ⇒ nâng trần cho video là mất trần 10MB của ảnh vĩnh viễn. Mảng `video_urls` tách riêng khỏi `image_urls` để giữ bất biến `image_urls[0] = ảnh bìa`. Không nhận `video/quicktime`: `.mov` iPhone thường là HEVC, trình duyệt không giải mã ⇒ upload "thành công" nhưng khung đen.
**Consequences:**
- **Ba khiếm khuyết sẵn có buộc phải sửa cùng lúc** vì thay đổi này biến chúng thành lỗi chặn đường: (1) khối ảnh nằm trong `{wantsAuction === "yes"}` ở bước 4 nên luồng "chỉ số hoá" không bao giờ thấy — đã chuyển sang bước 2; (2) `saveDraft` không truyền `postingId` nên mỗi lần lưu đẻ một hàng mới và **không có đường mở lại nháp** — đã nối `postingId` + `postingToWizardValues()`, hàng nháp ở landing bấm vào là mở lại wizard; (3) uploader "Tài liệu bổ sung" kẹt trong cùng nhánh chết — đã đưa về bước 3, cũng là chỗ cho nhóm ký cam kết tự nguyện đính kèm hoá đơn / hợp đồng.
- Đổi nhóm cấp 1 ⇒ **phải reset `declarationAccepted`/`declarationName`** (`Step1AssetType`), nếu không mang chữ ký sang nhóm dùng giấy tờ. `accepted_at` sinh trong `buildPostingPayload` lúc lưu, KHÔNG nằm trong form state (nếu không phải nhớ xoá ở 3 chỗ).
- Màn admin duyệt hiện bản cam kết **trên** khối giấy tờ: với nhóm không có sổ đỏ thì đây là căn cứ pháp lý duy nhất để duyệt.
- `useStorageUpload` gom vòng lặp upload của cả 3 uploader (trước đó chép 3 lần).
- **Rác storage sẽ tăng**: trước đây ảnh tuỳ chọn nên phiên bỏ dở thường không để lại gì; giờ mọi phiên qua bước 2 đều để lại ≥ 1 tệp vĩnh viễn trong bucket public. Chưa có job dọn.
- `accepted_at` do client gửi nên vẫn lệch giờ / giả mạo được (`stampConsent` cũng vậy). Bản chặt chẽ là trigger `BEFORE INSERT/UPDATE` ghi đè `now()` — chưa làm.

## 2026-09-06 — Duyệt tài sản: `review_status` tách khỏi `status`, enforce `approve` bằng trigger

**Context:** Chủ tài sản số hoá tài sản vào `asset_postings`, nhưng bảng chỉ có đúng policy own-rows ⇒ **admin query ra 0 dòng**, không có màn nào đọc, không có trạng thái kiểm duyệt, và hồ sơ vừa số hoá xong là gửi ngay cho tổ chức đấu giá được.
**Decision:**
- **Cột `review_status` RIÊNG** (pending/approved/rejected) + `reviewed_at/by`, `rejection_reason`, `review_notes` — KHÔNG trộn vào `status` (vòng đời của chủ tài sản: draft→active→matched→contracted). Migration `20260906000001`.
- **Trigger `asset_postings_review_guard` là chỗ enforce action `approve`** — đây là màn ĐẦU TIÊN thực sự dùng `approve` (action có trong `adminPermissions.ts` từ lâu nhưng 2 màn KYC cũ không enforce ở đâu cả). Không dùng RPC: RLS + trigger đã đủ.
- RLS UPDATE phải là `update OR approve` — chỉ cấp `approve` mà thiếu `update` thì RLS chặn nguyên dòng, nút bấm không ăn và **không báo lỗi**.
- Chủ tài sản sửa hồ sơ ĐÃ DUYỆT ⇒ tự rơi về `pending` (duyệt một lần rồi viết lại toàn bộ tài sản là lỗ hổng).
- Cổng chặn ở `AssetPostingDetail.tsx`: chỉ `status==='active' && review_status==='approved'` mới hiện CTA gửi tổ chức đấu giá. **Chưa public** — không đụng `listings`.
**Consequences:**
- Guard nuốt thay đổi của **mọi** caller thiếu quyền `approve`, kể cả **migration và service_role**. Backfill trong chính `20260906000001` đã bị nuốt trong im lặng, phải sửa bằng `20260906000002` với `DISABLE TRIGGER`. Mọi migration sau đụng 5 cột duyệt phải làm vậy.
- Tên trigger `asset_postings_review_guard` phải giữ: nó chạy trước `asset_postings_updated_at` nhờ thứ tự chữ cái, nếu không `NEW.* IS DISTINCT FROM OLD.*` luôn đúng vì `updated_at` đã đổi.
- Client phải tự kiểm `review_status` trả về sau update — trigger nuốt chứ không RAISE, nên toast vẫn xanh trong khi DB không đổi (`useAdminAssetPostings.ts`).

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
