

## Plan: Lịch sử giao dịch tổng hợp (mua + tiêu)

Gộp lịch sử mua credit và lịch sử tiêu credit (mở khóa tài sản, theo dõi công ty) thành một bảng duy nhất, với cột credit hiển thị +/- rõ ràng.

### Thay đổi data model (`src/lib/mockCredits.ts`)

Thay `purchases[]` bằng `transactions[]` tổng quát:

```ts
type TransactionType = "purchase" | "unlock_asset" | "unlock_company";

interface Transaction {
  id: string;
  type: TransactionType;
  description: string;   // "Mua gói Popular", "Mở khóa tài sản Nhà phố Q1", ...
  creditDelta: number;   // +190, -59, -299
  at: number;
}
```

- `addCredits(...)` → push transaction `purchase` với `creditDelta = +credits`, description `"Mua gói {name}"`.
- `unlockAsset(id, label?)` → push `unlock_asset`, `creditDelta = -ASSET_COST`, description `"Mở khóa tài sản {label ?? id}"`.
- `unlockCompany(orgId, tier, label?)` → push `unlock_company`, `creditDelta = -tier.cost`, description `"Theo dõi công ty {label ?? orgId} {tier.label}"`.
- Migration nhẹ: nếu localStorage còn `purchases`, map sang `transactions` khi load lần đầu.

### Cập nhật callsite

Tìm và truyền thêm `label` (tên tài sản/công ty) khi gọi `unlockAsset` / `unlockCompany`:
- `src/contexts/PaywallContext.tsx` (chính)
- `src/components/paywall/AssetPaywallDialog.tsx`, `CompanyPaywallDialog.tsx`
- `src/pages/PaymentResult.tsx` (auto-unlock sau thanh toán)

Nếu chưa có sẵn label trong scope → fallback dùng id; ưu tiên truyền title đã có.

### Hook (`src/hooks/useCredits.tsx`)

Expose `transactions` thay cho `purchases`.

### UI block "Lịch sử giao dịch" (`CreditsTab.tsx`)

Bảng 3 cột:

| Thời gian | Giao dịch | Credit |
|---|---|---|
| 18/04/2026 14:32 | Mua gói Popular | <span class="text-green-600">+190</span> |
| 18/04/2026 14:35 | Mở khóa tài sản Nhà phố Q1 | <span class="text-red-600">−59</span> |
| 18/04/2026 15:10 | Theo dõi công ty ABC 30 ngày | <span class="text-red-600">−299</span> |

- Cột "Giao dịch": text + icon nhỏ phía trước theo type (`ShoppingCart` / `Unlock` / `Building2`).
- Cột "Credit": format `+N` xanh hoặc `−N` đỏ, font-semibold, có icon `Coins` nhỏ.
- Bỏ cột "Gói", "Số tiền", "Trạng thái".
- Empty state giữ nguyên (icon `Receipt` + "Chưa có giao dịch nào").
- Sort mới nhất trước. Mobile: `overflow-x-auto`.

### Không đổi

- Logic tính balance, paywall flow, payment mock.
- `useSyncExternalStore` tự re-render khi có giao dịch mới.

