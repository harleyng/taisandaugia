

## Plan: Đổi tên trang "Mua credit" cho phù hợp

Vì tab giờ chứa cả mua credit + lịch sử giao dịch (cộng/trừ), tên "Mua credit" không còn phản ánh đúng nội dung.

### Đề xuất tên mới: **"Credit"** (hoặc **"Ví credit"**)

Lý do: ngắn gọn, bao quát cả việc mua, số dư và lịch sử giao dịch.

### Thay đổi

**`src/components/profile/ProfileSidebar.tsx`**
- Đổi label tab từ "Mua credit" → "Credit" (hoặc "Ví credit").

**`src/components/profile/tabs/CreditsTab.tsx`**
- Đổi tiêu đề `Card` đầu tiên từ "Mua credit" → "Mua thêm credit" để phân biệt với tên tab tổng quát, giữ subtitle "Mở khóa thông tin để hiểu rõ thị trường và đấu giá thông minh".

**`src/pages/ProfilePage.tsx`** (nếu có set document title / breadcrumb riêng cho tab)
- Cập nhật tương ứng nếu có.

### Cần xác nhận

Chọn 1 trong 2 phương án tên tab:
- **A. "Credit"** — ngắn gọn, đủ ý
- **B. "Ví credit"** — gợi cảm giác "nơi quản lý credit" rõ hơn

Mặc định chọn **A** nếu không có phản hồi.

