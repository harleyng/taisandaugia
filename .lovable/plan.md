

## Plan: Ẩn giá sau đăng nhập cho Hồ sơ, Bước giá, Giá trúng

### Mô tả
Trong `AuctionPriceRow`, 3 field **Hồ sơ**, **Bước giá**, **Giá trúng** sẽ bị ẩn khi chưa đăng nhập — hiện icon Eye thay vì số liệu. Click vào Eye mở popup đăng nhập (dùng `useAuthDialog`). Sau khi đăng nhập, hiện số liệu thật. Nếu field không có dữ liệu (null/undefined) thì luôn hiện "–" bất kể trạng thái đăng nhập.

### Thay đổi

**File: `src/components/auction/AuctionPriceRow.tsx`**

1. Import `useAuthDialog` từ `AuthDialogContext`, `supabase` client, `useState`/`useEffect` từ React, icon `Eye` từ lucide-react.
2. Thêm state `session` — lắng nghe `onAuthStateChange` để biết user đã đăng nhập chưa.
3. Mỗi cell trong mảng `cells` thêm thuộc tính `gated: boolean` và `rawValue` (giá trị gốc trước format):
   - Khởi điểm: `gated: false`
   - Đặt trước: `gated: false`
   - Hồ sơ: `gated: true`, rawValue = `ca.document_fee`
   - Bước giá: `gated: true`, rawValue = `bidStep`
   - Giá trúng: `gated: true`, rawValue = `winPrice`
4. Logic hiển thị cho mỗi cell:
   - Nếu `rawValue == null` → luôn hiện "–"
   - Nếu `gated && !session` → hiện icon `Eye` (clickable, gọi `openAuthDialog()`)
   - Còn lại → hiện giá trị đã format
5. `PriceCell` nhận thêm prop `onClick` và `isHidden` để render Eye icon hoặc giá trị.

### Không thay đổi
- Không thay đổi DB, không thay đổi file khác.
- Layout, responsive grid, border giữ nguyên.

