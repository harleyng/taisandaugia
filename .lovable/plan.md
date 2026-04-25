# OTP Verification cho Số điện thoại trong Hồ sơ cá nhân

## Mục tiêu
Trong section **Thông tin cơ bản** của trang Hồ sơ, người dùng phải xác thực OTP số điện thoại trước khi lưu được. Số điện thoại đã xác thực sẽ hiển thị badge "Đã xác thực". Khi đổi sang số mới phải xác thực lại.

## UX flow

```text
[Input số điện thoại]  +  [Nút "Xác thực"]
         │
         │ (nhấn Xác thực)
         ▼
[Dialog OTP] — nhập mã 6 số (mock: 123456)
         │
         │ (đúng OTP)
         ▼
[Input số đt]  ✓ Đã xác thực   (badge xanh, input read-only)
                [Đổi số khác] (xoá verified → nhập lại + xác thực lại)
```

- Nút **Lưu thông tin** bị disable nếu số điện thoại đã nhập nhưng chưa xác thực.
- Nếu user xoá hoặc sửa số sau khi đã verified → tự động reset trạng thái verified.
- Số điện thoại đã verified trước đó (load từ DB) hiển thị badge sẵn, không cần xác thực lại.

## Triển khai

### 1. Component mới: `PhoneOtpDialog.tsx`
Dialog xác thực OTP, dùng `InputOTP` (đã có), validate mã `123456` (mock — đồng nhất với AuthDialog), countdown 60s cho nút "Gửi lại".
Props: `open`, `phone`, `onOpenChange`, `onVerified()`.

### 2. `ProfileBasicSection.tsx` — cập nhật
- State mới: `phoneVerified` (init từ `basic.phone_verified`), `otpDialogOpen`.
- Đổi field phone:
  - Khi đã verified: input disabled + badge "Đã xác thực" + nút "Đổi số khác".
  - Khi chưa verified: input + nút "Xác thực" (disabled khi số chưa hợp lệ).
- Khi user chỉnh sửa số → `setPhoneVerified(false)`.
- Trong `handleSave`: nếu có `phone` mà `!phoneVerified` → toast cảnh báo + return.
- Lưu vào `agent_info.basic.phone_verified = true` cùng với `phone`.
- Cập nhật `isBasicComplete` (`src/lib/onboardingTasks.ts`) để yêu cầu `phone_verified === true` (hoặc tương đương) — đảm bảo reward Tier-1 chỉ được tính khi phone đã xác thực.

### 3. Validation
- Số điện thoại Việt Nam: regex `/^(0|\+84)[0-9]{9,10}$/`. Hiển thị lỗi inline nếu không hợp lệ.

## Files thay đổi
- `src/components/profile/sections/PhoneOtpDialog.tsx` (mới)
- `src/components/profile/sections/ProfileBasicSection.tsx`
- `src/lib/onboardingTasks.ts` (thêm `phone_verified` vào điều kiện `isBasicComplete`)

## Lưu ý
- Hệ thống đang dùng OTP **mock** (`123456`) — không gọi SMS thật. Khi cần OTP thật, có thể bật connector Twilio, tạo edge function `send-phone-otp` + `verify-phone-otp`. Phần này nằm ngoài scope hiện tại để giữ nhất quán với AuthDialog.