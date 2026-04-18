

## Plan: Bonus credit thay vì giảm giá

Hiển thị mỗi gói (trừ Starter) dưới dạng `base credit + bonus credit`. Anchor giá tiền giữ nguyên, anchor credit được "thổi phồng" để khuyến khích gói lớn.

### Quy tắc quy đổi
1k VND = 1 base credit. Bonus = `credits` hiện tại − `priceVnd/1000`.

| Gói | Giá | Base | Bonus | Tổng |
|---|---|---|---|---|
| Starter | 69k | 69 | 0 | 69 |
| Popular | 179k | 179 | +11 | 190 |
| Value | 299k | 299 | +31 | 330 |
| Pro | 499k | 499 | +101 | 600 |
| Max | 1.999k | 1.999 | +601 | 2.600 |

### Thay đổi file

**`src/lib/mockCredits.ts`**
- Thêm field `baseCredits` vào `CREDIT_PACKAGES` (= `priceVnd/1000`). `credits` giữ nguyên = tổng nhận được.
- Logic `addCredits` giữ nguyên (cộng tổng `credits`).

**`src/components/profile/tabs/CreditsTab.tsx`** — phần giá trong card:
```
[Ảnh gói]
Tên gói
179k                              ← giá tiền (giữ nguyên size lớn)
🪙 179 credit + 11 tặng thêm      ← dòng credit có bonus inline
[Badge: +11 credit bonus] (xanh)  ← chỉ hiện khi bonus > 0
[Mua ngay]
```

- Starter: chỉ hiện `🪙 69 credit`, không badge.
- Các gói khác: 
  - Dòng credit: `<span>{base} credit</span> <span class="text-green-600 font-semibold">+ {bonus} tặng</span>`
  - Badge nhỏ phía trên hoặc dưới giá: `+{bonus} credit bonus` (bg-green-500/10, text-green-700)
- Card "Max" có thể thêm dòng phụ: `Tặng nhiều nhất` dưới badge bonus để nhấn mạnh.

### UI visual
- Bonus highlight màu xanh lá (success): `text-green-600 dark:text-green-400`, `bg-green-500/10`.
- Icon `Gift` (lucide) đứng trước số bonus thay vì `Coins` để phân biệt.
- Giữ nguyên badge "Phổ biến" / "Tốt nhất" hiện có.

### Không đổi
- `addCreditsImpl` vẫn cộng đúng tổng `credits` → flow thanh toán mock + auto-unlock không bị ảnh hưởng.
- Dialog VNPay vẫn hiển thị `priceVnd` và mô tả gói. Có thể bổ sung dòng `Bạn sẽ nhận: 179 + 11 credit tặng = 190 credit`.

