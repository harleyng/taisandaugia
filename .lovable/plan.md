
## Mục tiêu

Tại trang `/report`, khi người dùng **chưa đăng nhập**:
- Vẫn hiển thị các phần "miễn phí" phía trên: `ReportTopNav`, `ReportHero`, `ReportTOC`, `ReportHighlights` (3 điểm nổi bật).
- **Khoá toàn bộ các section dữ liệu chi tiết** phía dưới: `SectionOverview`, `SectionCompetition`, `SectionOutcomes`, `SectionPriceTrend`, `ReportSubscribeForm`.
- Thay vào đó hiển thị 1 **lock card** với CTA "Đăng nhập để xem báo cáo đầy đủ" → click sẽ mở popup đăng ký/đăng nhập có sẵn (`AuthDialog`).
- Khi user đăng nhập xong, popup đóng → nội dung tự hiển thị (do session state cập nhật qua `onAuthStateChange`).

## Cơ chế đã có sẵn (tái sử dụng)

- `AuthDialogProvider` + `useAuthDialog().openAuthDialog()` đã được wrap toàn app → chỉ cần gọi để mở popup.
- `AuthDialog` đã render ở root → không cần mount thêm.
- Pattern session check: copy từ `ProtectedRoute.tsx` (`supabase.auth.getSession()` + `onAuthStateChange`).

## Thay đổi

### 1. `src/pages/MarketReport.tsx`
- Thêm `useState<Session | null>` + `useEffect` lắng nghe session (giống `ProtectedRoute`).
- Trong cột nội dung phải, render có điều kiện:
  - Luôn hiển thị: `<ReportHighlights />`
  - Nếu `session` tồn tại: render đủ 4 sections + `<ReportSubscribeForm />`.
  - Nếu chưa: render `<ReportLockedCTA />` (component mới) thay cho khối còn lại.
- Trong khi `loading` (lần đầu), render skeleton nhẹ ở khối khoá (tránh flicker).

### 2. `src/components/report/ReportLockedCTA.tsx` (mới)
- Card lớn `rounded-2xl` với:
  - Icon `Lock` + tiêu đề "Đăng nhập để xem báo cáo đầy đủ"
  - Mô tả ngắn: liệt kê những gì user sẽ unlock (Tổng quan thị trường, Cạnh tranh & chênh lệch, Kết quả & không thành, Xu hướng giá).
  - Nút primary "Đăng nhập / Đăng ký" → gọi `openAuthDialog()`.
  - Phần preview mờ phía sau (background blur) để gợi ý có nội dung bị khoá — sử dụng `LockedBlur` đã có (`src/components/paywall/LockedBlur.tsx`) hoặc style tương tự `bg-gradient-to-b` + `blur-sm` mock content lines.
- Dùng semantic tokens: `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-primary text-primary-foreground` cho CTA.

### 3. Không thay đổi
- Không đổi `ReportTOC` (vẫn hiển thị, nhưng các anchor chỉ scroll được sau khi login — chấp nhận được vì các target không tồn tại trong DOM khi chưa login). Nếu muốn tinh tế hơn có thể disable visually nhưng không cần thiết cho yêu cầu này.
- Không thay đổi block `MarketReportTeaser` ở homepage — vẫn cho phép mọi người vào trang `/report` để xem teaser + lock card.

## Implementation Notes

- Import `Session` từ `@supabase/supabase-js` và `supabase` từ `@/integrations/supabase/client`.
- Import `useAuthDialog` từ `@/contexts/AuthDialogContext`.
- Reuse `LockedBlur` nếu API đơn giản; nếu phức tạp thì tự render mock blur content.
- Không cần edit App.tsx (route vẫn public).
