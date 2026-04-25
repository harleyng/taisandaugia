## Mục tiêu

Khóa các báo cáo chuyên sâu (BĐS, Outcomes, …) phía sau paywall **theo từng kỳ**. Người dùng chọn Tháng / Quý / Năm trên bộ lọc, mua kỳ nào → mở kỳ đó **vĩnh viễn** cho riêng báo cáo đang xem.

Phạm vi: `/report/bds`, `/report/deep/outcomes`, và mọi trang chuyên sâu sau này.
KHÔNG khóa: `/report` (trang tổng — vẫn chỉ yêu cầu đăng nhập).

## Mô hình tính phí

| Loại kỳ | Giá / báo cáo | Quyền lợi |
|---|---|---|
| Tháng (vd 09/2025) | **990 credit** | Mở vĩnh viễn snapshot Tháng đó của báo cáo |
| Quý (vd Q3/2025) | **2.490 credit** | Mở vĩnh viễn snapshot Quý đó **+ tự động unlock 3 tháng bên trong** |
| Năm (vd 2025) | **8.900 credit** | Mở vĩnh viễn snapshot Năm đó **+ tự động unlock 4 quý + 12 tháng bên trong** |

Mỗi unlock chỉ áp cho **1 báo cáo** (slug). Mua "Tháng 09/2025 — BĐS" không mở "Tháng 09/2025 — Outcomes".

## Cấu trúc dữ liệu kỳ

Khóa unlock dạng string: `"{slug}:{periodId}"`, ví dụ:
- `bds:m-2025-09` (tháng)
- `bds:q-2025-3` (quý)
- `outcomes:y-2025` (năm)

Helpers (`src/lib/reportPeriods.ts` mới):
- `getMonthsInQuarter(year, q)` → `["m-2025-07","m-2025-08","m-2025-09"]`
- `getQuartersInYear(year)` → 4 IDs
- `getMonthsInYear(year)` → 12 IDs
- `expandUnlock(periodId)` → tất cả periodId con cần auto-unlock
- `formatPeriodLabel(periodId)` → "Tháng 09/2025", "Quý 3/2025", "Năm 2025"
- `availablePeriods()` → 12 tháng gần nhất, 4 quý, 2 năm — config cứng cho từng báo cáo (sau này có thể đẩy vào mock data riêng)

## Mock credit system (`src/lib/mockCredits.ts`)

Thêm:
- `DEEP_REPORT_PERIOD_PRICES = { month: 990, quarter: 2490, year: 8900 }`
- `state.deepReportPeriodUnlocks: string[]` — danh sách `"{slug}:{periodId}"` đã mở
- `isDeepReportPeriodUnlocked(slug, periodId)` → `boolean`
- `unlockDeepReportPeriod(slug, periodId, label?)`:
  - check không trùng
  - check đủ credit theo loại kỳ (parse từ periodId)
  - trừ credit, push tất cả unlock IDs (chính nó + con cháu qua `expandUnlock`) vào state — dedupe
  - push transaction `unlock_deep_report` với mô tả "Mở khóa {label báo cáo} — {label kỳ}"
- Migration trong `read()`: khởi tạo mảng nếu state cũ không có
- Thêm `"unlock_deep_report"` vào `TransactionType` + icon mapping trong `CreditsTab.tsx`

Expose từ `useCredits.tsx`:
- `isDeepReportPeriodUnlocked(slug, periodId)`
- `unlockDeepReportPeriod(slug, periodId, label?)`
- `DEEP_REPORT_PERIOD_PRICES`

## Component mới

### `src/components/report/PeriodFilterTabs.tsx`
Bộ lọc trên cùng mỗi báo cáo chuyên sâu:
- Tabs: **Tháng | Quý | Năm**
- Bên dưới: grid các kỳ khả dụng (chip-button)
  - Mỗi chip: label kỳ + badge nhỏ ở góc:
    - "Đã mở" (xanh) nếu unlocked
    - "Mới" (cam) nếu là kỳ mới nhất
    - icon Lock + giá nếu chưa mở
- Click chip:
  - Đã mở → set period đang xem (cập nhật URL `?period=...`)
  - Chưa mở → mở `DeepReportPaywallDialog` với period đó
- Default: kỳ Tháng mới nhất

### `src/components/paywall/DeepReportPaywallDialog.tsx`
Dialog xác nhận mua 1 kỳ cụ thể:
- Header: "🔒 Mở khóa báo cáo: {label báo cáo}"
- Body:
  - Tên kỳ to: "Tháng 09/2025" + badge loại (Tháng/Quý/Năm)
  - Highlight quyền lợi: "Mở vĩnh viễn — không hết hạn"
  - Nếu Quý/Năm: liệt kê thêm "Bonus: tự động mở 3 tháng (Q3) hoặc 4 quý + 12 tháng (Năm)"
  - Giá theo loại kỳ (lấy từ `DEEP_REPORT_PERIOD_PRICES`)
  - Số dư + trạng thái đủ/không đủ credit
- Nếu đủ credit → button "Dùng credit để mở" → call `unlockDeepReportPeriod` → toast → close
- Nếu thiếu → button "Mua credit" → navigate `/profile?tab=credits&unlock=deep:{slug}:{periodId}&return={returnPath}`

### `src/components/report/DeepReportGate.tsx`
Wrapper layout chuẩn cho mọi trang chuyên sâu:

```tsx
<DeepReportGate
  slug="bds"
  label="Bất động sản"
  availableMonths={[...]} availableQuarters={[...]} availableYears={[...]}
  renderContent={(periodId) => <BdsReportContent periodId={periodId} />}
/>
```

Hành vi:
1. Chưa login → render `<ReportLockedCTA />` như cũ.
2. Đã login:
   - Render `<PeriodFilterTabs />` (luôn hiện, kể cả khi chưa mua kỳ nào)
   - Render badge trạng thái kỳ đang chọn ("✓ Đã mở khóa vĩnh viễn" hoặc "🔒 Bản preview")
   - Nếu kỳ đang chọn unlocked → render `renderContent(periodId)`
   - Nếu chưa unlocked → render `<DeepReportPreview />` blur + nút mở dialog
3. URL state: `?period=m-2025-09` để share / persist.

### `src/components/report/DeepReportPreview.tsx`
Preview khi chưa mua: hero + 5 highlights + danh sách section rút gọn (chỉ tiêu đề + 1 dòng insight) — phần còn lại blur bằng `LockedBlur` có sẵn.

## Sửa file hiện có

### `src/pages/PaymentResult.tsx`
Thêm nhánh xử lý:
```ts
if (type === "deep") {
  // unlockParam = "deep:{slug}:{periodId}"
  unlockDeepReportPeriod(id, periodId);
}
```
(Lưu ý parse: `["deep", slug, periodId]` — `periodId` có dấu `-`, cần `split` cẩn thận hoặc dùng pattern `unlock=deep:{slug}:{periodId}` parse bằng index 0/1/rest.)

### `src/components/profile/tabs/CreditsTab.tsx`
- Thêm `unlock_deep_report` vào icon map (icon `FileText` hoặc `BookOpen`).

### `src/pages/MarketReportCategory.tsx` (BĐS)
Bọc nội dung BĐS bằng `<DeepReportGate slug="bds" label="Bất động sản" ... />`. Truyền `periodId` vào `BdsReportContent` (chấp nhận prop optional — content mock không thay đổi theo kỳ ở giai đoạn này, chỉ hiển thị label kỳ ở đầu).

### `src/pages/MarketReportOutcomes.tsx`
Bọc bằng `<DeepReportGate slug="outcomes" label="Kết quả & không thành" ... />`.

### `src/components/report/bds/BdsReportContent.tsx` & `outcomes/OutcomesContent.tsx`
- Nhận prop `periodId?: string`.
- Hiển thị thẻ nhỏ ở đầu Hero: "Đang xem: {periodLabel}" — chỉ visual, data vẫn từ mock cũ (sẽ swap khi có data thật).

### `src/components/report/SectionOutcomes.tsx` (trên trang `/report`)
Thêm icon `Lock` nhỏ + tooltip "Báo cáo chuyên sâu — mất phí" cạnh nút "Đào sâu Kết quả & không thành" (UX hint, không chặn click).

## Files

**Mới:**
- `src/lib/reportPeriods.ts`
- `src/components/report/PeriodFilterTabs.tsx`
- `src/components/report/DeepReportGate.tsx`
- `src/components/report/DeepReportPreview.tsx`
- `src/components/paywall/DeepReportPaywallDialog.tsx`

**Sửa:**
- `src/lib/mockCredits.ts`
- `src/hooks/useCredits.tsx`
- `src/pages/PaymentResult.tsx`
- `src/components/profile/tabs/CreditsTab.tsx`
- `src/pages/MarketReportCategory.tsx`
- `src/pages/MarketReportOutcomes.tsx`
- `src/components/report/bds/BdsReportContent.tsx`
- `src/components/report/outcomes/OutcomesContent.tsx`
- `src/components/report/SectionOutcomes.tsx` (icon Lock)

## Ghi chú kỹ thuật

- Toàn bộ persist trong `localStorage` (đồng bộ kiến trúc mock hiện tại). Khi chuyển sang backend, chỉ thay impl của `unlockDeepReportPeriod` / `isDeepReportPeriodUnlocked`.
- Auto-unlock con cháu xử lý ngay tại thời điểm mua (snapshot) — không tính lại lúc đọc, đảm bảo logic đơn giản.
- Không tạo bảng DB / edge function mới.
- Màu / spacing / typography lấy từ design tokens — không hardcode.
