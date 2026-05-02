## Mục tiêu

Trang hồ sơ cá nhân (`/profile` tab "Hồ sơ cá nhân") hiện đang hiển thị form chỉnh sửa luôn. Cần tách thành 2 chế độ cho từng section ("Thông tin cơ bản" và "Nhu cầu đấu giá"):

- **Chế độ Xem (mặc định)**: hiển thị thông tin dạng read-only kèm nút **Chỉnh sửa** ở góc trên phải.
- **Chế độ Sửa**: chỉ bật khi bấm **Chỉnh sửa** — hiện form như hiện tại, kèm nút **Lưu** và **Hủy**. Sau khi lưu thành công (hoặc bấm Hủy) thì quay lại chế độ Xem.

## Phạm vi

Áp dụng cho 2 component:
1. `src/components/profile/sections/ProfileBasicSection.tsx`
2. `src/components/profile/sections/ProfileIntentSection.tsx`

Các phần khác (avatar header, các tab Credit/Mật khẩu/Thông báo/Saved) giữ nguyên.

## Thiết kế chế độ Xem

### Section "Thông tin cơ bản"
Hiển thị grid 2 cột các cặp **Nhãn → Giá trị**:
- Họ tên
- Số điện thoại (kèm badge "Đã xác thực" màu xanh nếu đã verify)
- Vai trò (map từ `ROLE_OPTIONS` ra label tiếng Việt)
- Tỉnh/Thành phố
- Ngày sinh (format `dd/MM/yyyy`)
- Giới tính (map từ `GENDER_OPTIONS`)

Trường nào chưa có giá trị → hiển thị "Chưa cập nhật" màu muted.

### Section "Nhu cầu đấu giá"
- Loại tài sản quan tâm: chip read-only (badge) liệt kê tên các category đã chọn
- Khu vực quan tâm: badge liệt kê các tỉnh
- Ngân sách / Kinh nghiệm / Mục tiêu / Nguồn biết đến: cặp Nhãn → Giá trị

Giữ nguyên `matchBanner` (banner số lượng tài sản phù hợp) ở chế độ Xem để user vẫn thấy kết quả sau khi vừa lưu.

## Header section (cả 2 section)

Bên phải tiêu đề, ngoài badge trạng thái thưởng hiện có, thêm nút **Chỉnh sửa** (`variant="outline"`, icon `Pencil`) khi đang ở chế độ Xem. Khi vào chế độ Sửa, nút này ẩn đi.

## Footer chế độ Sửa

Thay block footer hiện tại bằng:
- Bên trái: giữ text "Đã đủ thông tin" / "Điền đầy đủ để mở khóa thưởng".
- Bên phải: nút **Hủy** (`variant="ghost"`, reset state về giá trị server snapshot) + nút **Lưu** (giữ logic hiện tại). Sau khi `handleSave` thành công → tự chuyển về chế độ Xem.

## Chi tiết kỹ thuật

- Thêm state `mode: "view" | "edit"` (mặc định `"view"`) vào mỗi section.
- Khi `agentInfo` thay đổi (load lần đầu) — giữ ở chế độ Xem.
- Hàm `handleCancel`: reset toàn bộ state form về giá trị từ `basic`/`intent` snapshot, rồi `setMode("view")`.
- `handleSave`: ở cuối nhánh thành công, gọi `setMode("view")` (sau khi setShowClaim).
- Nếu user mới (chưa có dữ liệu nào) → vẫn vào chế độ Xem, hiển thị placeholder "Chưa cập nhật" để CTA Chỉnh sửa rõ ràng. (Không auto vào edit mode để giữ hành vi nhất quán.)
- Map hiển thị: tạo helper `labelOf(options, value)` để lấy `label` từ các array `ROLE_OPTIONS`/`GENDER_OPTIONS`/`BUDGET_OPTIONS`/`EXPERIENCE_OPTIONS`/`GOAL_OPTIONS`/`SOURCE_OPTIONS`, và `categoryNameOf(slug)` từ `ASSET_CATEGORIES`.
- Không thay đổi schema DB, không đụng `useOnboardingTasks`, `RewardClaimDialog`, `PhoneOtpDialog`.

## Không thay đổi
- Logic trigger reward / matchBanner.
- Tab Credit, Mật khẩu, Thông báo, Saved Assets.
- Avatar upload (vẫn ở `ProfileInfoTab`, luôn editable qua icon camera).
