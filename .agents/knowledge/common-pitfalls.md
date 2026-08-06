# Common Pitfalls — Tài Sản Đấu Giá (taisandaugia)

> Living document. Things that have gone wrong or are easy to get wrong. **Newest first**, dated. Add an entry whenever a non-obvious bug bites. This is a current-truth doc — when the code moves, update the entry (don't leave a stale warning).

---

## 2026-08-06 — Đừng đổ đoạn văn hướng dẫn ra UI: dùng `HelpHint` (dấu "?" + tooltip)

Tab "Chi nhánh / AMC" từng có một đoạn 4 dòng dưới bảng giải thích "Hệ thống suy ra" nghĩa là gì, cách kéo thả, xóa cụm có mất chi nhánh không. **Chữ giải thích chiếm chỗ vĩnh viễn nhưng chỉ hữu ích ở lần đầu** — đọc vài lần là thành nhiễu, và tệ hơn: người dùng học được thói quen bỏ qua khối chữ mờ đó, nên sau này có cảnh báo THẬT ở cùng vị trí cũng không ai đọc.

**Luật:** nội dung chỉ cần khi người dùng thắc mắc thì đặt sau dấu `?`, không render thẳng.

```tsx
import { HelpHint } from "@/components/admin/HelpHint";

<span>{n} đơn vị thành viên
  <HelpHint side="bottom" label="Cách hoạt động của tab">
    <p>Quan hệ <strong>Hệ thống suy ra</strong> dựng từ tên đơn vị…</p>
    <p>Kéo tay nắm ở đầu dòng, thả vào cụm khác.</p>
  </HelpHint>
</span>
```

- Tách ý thành nhiều `<p>` — nhồi một khối dài vào tooltip chỉ là đổi chỗ cùng một vấn đề.
- `TooltipProvider` đã bọc toàn app ở `App.tsx`, **không bọc lại** ở component con.
- Cái được giữ lại trên màn hình phải là **trạng thái**, không phải hướng dẫn: "Số liệu gồm cả 3 chi nhánh / AMC trực thuộc" ở lại (nó nói số đang xem là gì), còn "vì sao con số này khác cột ngoài danh sách" đi vào tooltip.
- Nhãn hành động phải tự giải thích được thay vì cần chú thích: nếu phải viết một dòng dạy cách bấm, thường là nút/nhãn đang đặt tên sai.

## 2026-08-06 — Một từ mang hai nghĩa trong cùng màn hình

"Cụm" từng vừa là *cả nhà* (mẹ + chi nhánh, nhãn bộ lọc "Toàn cụm") vừa là *nhóm do admin tự đặt tên* ("Cụm miền Bắc") — hai nghĩa nằm trong **cùng một dropdown**. Người dùng báo lại là không hiểu nổi.

Nay: "cụm" **chỉ còn** nghĩa nhóm do người tự đặt tên. Cả nhà gọi là "chi nhánh / AMC" hoặc "trụ sở chính và các đơn vị trực thuộc" (`allLabel` = **"Toàn bộ chi nhánh"**).

**Trước khi đặt nhãn mới, grep xem từ đó đã mang nghĩa gì trong module** — chữ đúng về mặt kỹ thuật vẫn sai nếu nó đã được dùng cho khái niệm khác ở màn hình bên cạnh. Kiểm nhanh: `grep -rn "<từ>" src/components/<module>/ src/lib/<module>/`.

## 2026-08-06 — `customers.user_id` trỏ `auth.users`, KHÔNG embed được `profiles`

`customers.user_id` là `REFERENCES auth.users(id)`. PostgREST chỉ thấy schema `public`, nên `.select("*, profiles(id,name,email)")` từ `customers` trả *"Could not find a relationship"* — không có FK nào tới `public.profiles` để đi theo. Ai "tối ưu" hai query thành một embed sẽ làm vỡ cả trang chi tiết khách hàng.

**Phải truy vấn rời:** `useProfileBrief(userId)` trong `src/hooks/useProfiles.ts` (key `["profile-brief", userId]`). Comment đã cắm ở cả hook và `types/customers.ts` — đừng bóc ra.

Cùng họ với bẫy dưới đây nhưng ngược chiều: ở đó là *quá nhiều* đường FK, ở đây là *không có* đường nào.

---

## 2026-08-05 — Embed PostgREST nhập nhằng khi bảng có 2 FK cùng trỏ 1 bảng ⇒ danh sách "rỗng" giả

`organization_memberships` có **hai** khóa ngoại trỏ `profiles`: `user_id` và `invited_by`. Viết `.select("…, profiles(id,email,name)")` khiến PostgREST trả **PGRST201** *"more than one relationship was found"* — và vì lỗi làm hỏng CẢ query, `data` thành `undefined`, UI render "chưa có thành viên nào". Triệu chứng là **danh sách trống**, không phải thông báo lỗi ⇒ rất dễ đi lạc sang nghi ngờ RLS.

**Luôn chỉ đích danh FK khi bảng có nhiều đường tới cùng một bảng đích:**
```ts
.select("…, profiles!organization_memberships_user_id_fkey(id,email,name)")
```
Kiểm nhanh bằng `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.<bang>'::regclass AND contype='f';` — thấy ≥2 FK cùng `REFERENCES <bang_dich>` là phải chỉ tên constraint.

**Bài học UI đi kèm:** đừng render empty-state khi query lỗi. `useQuery` trả `error` — hãy phân biệt *rỗng thật* với *tải hỏng*, nếu không mọi lỗi đọc đều trông như "chưa có dữ liệu" (xem `MembersTable` nhận prop `error`).

---

## 2026-08-05 — `gen_random_bytes()` chết trong hàm `SET search_path = public`

`create_org_invite` sinh token bằng `encode(gen_random_bytes(24),'hex')` → chạy thật là nổ **`function gen_random_bytes(integer) does not exist`**. Lý do: hàm đó thuộc extension **pgcrypto**, ở Supabase cài trong schema `extensions`, trong khi mọi hàm SECURITY DEFINER của ta bắt buộc khai báo `SET search_path = public` (để an toàn) nên không nhìn thấy nó. Migration vẫn `CREATE FUNCTION` thành công vì thân plpgsql không được phân giải lúc tạo — **lỗi chỉ lộ khi gọi**.
**Dùng `gen_random_uuid()`** — hàm LÕI của PostgreSQL 13+ (`pg_catalog`), luôn gọi được bất kể `search_path`. Cần chuỗi ngẫu nhiên dài thì ghép 2 UUID bỏ dấu gạch = 64 hex (256 bit): xem `org_new_invite_token()`. Cùng bẫy này áp cho `digest()`, `crypt()`, `gen_salt()` — hoặc gọi kèm schema (`extensions.digest(...)`).
**Bài học rộng hơn:** migration `db push` xanh KHÔNG chứng minh RPC chạy được. Hãy gọi thật từng RPC trong một transaction `BEGIN … ROLLBACK` (giả lập user bằng `set_config('request.jwt.claims', json_build_object('sub', <uid>)::text, true)`) trước khi coi là xong.

---

## 2026-07-13 — Admin bị KHÓA đăng nhập ở /auth (catch-22)

`Auth.tsx` (trang login DUY NHẤT) từng `signOut` MỌI tài khoản `ADMIN` kèm lỗi *"Tài khoản admin không thể đăng nhập vào marketplace"* — nhưng `AdminRoute` lại đẩy khách chưa đăng nhập ở `/admin` về `/auth` ⇒ admin không bao giờ vào được panel (vòng khóa cứng). **Đừng chặn admin đăng nhập — hãy ĐIỀU HƯỚNG** họ về `/admin` (helper `redirectByRole` trong `useEffect`, dùng cho cả `getSession()` và `onAuthStateChange`). Muốn "admin không lang thang marketplace" thì redirect chứ đừng `signOut`.

---

## 2026-07-05 — Baseline pitfalls (seeded with the knowledge base)

### Button + Link — silent disappearance
`<Button asChild><Link>…</Link></Button>` makes the button vanish from the DOM with **no console error**. Use `useNavigate()`:
```tsx
// ❌ DON'T
<Button asChild><Link to="/listings/123">Xem</Link></Button>
// ✅ DO
const navigate = useNavigate();
<Button onClick={() => navigate('/listings/123')}>Xem</Button>
```
(shadcn's own `asChild` compositions — `SidebarMenuButton asChild` + `NavLink`, `DropdownMenuItem asChild` — are fine. The footgun is specifically `Button` wrapping `Link`.)

### One auth source — never re-fetch session or `profiles`
`AuthProvider` (`src/contexts/AuthContext.tsx`) is the **single** auth source. It runs `getSession()` + `onAuthStateChange` **once** and broadcasts via context. Consume with `useAuth()` → `{ session, userId, loading }`. Before commit `4fd8a42` ~7 components (Header, useCredits, useOnboardingTasks, ProtectedRoute, useAssetActions, useAuthState…) each subscribed independently → duplicate API calls on every load.
- ❌ Never add a new `supabase.auth.getSession()` / `supabase.auth.onAuthStateChange` subscription in a hook or component.
- ❌ Never fetch the `profiles` row ad-hoc. Use `useProfile(userId)` (`src/hooks/useProfile.ts`) — shared queryKey `["profile", userId]` dedupes every consumer and caches (`staleTime: 5m`).
- After writing `profiles`, either `invalidateQueries(["profile", userId])` or dispatch the global `window` event `"onboarding:profile-updated"` (AuthProvider listens and invalidates all `["profile"]` queries via `notifyProfileUpdated()`).

### Mutations must invalidate the exact query key — or the UI goes stale
React Query caches by key; a write is invisible until the read key is invalidated. Key names must match **byte-for-byte** (including `userId` in the tuple).
| Write | Must invalidate |
|-------|-----------------|
| `unlockAsset` / `unlockCompany` / `unlockOwner` / `unlockDeepReportPeriod` / `addCredits` | `["user-credits", userId]` (via `invalidate()` in `useCredits`, only on `result.ok`) |
| `useSubmitPostingWithOrg` | `["my-postings", userId]` |
| profile writes | `["profile", userId]` |
Two live traps:
- **`unlock*` returns `{ ok, reason }`** — invalidation only fires when `ok`. If you branch on the result yourself, don't also assume the cache refreshed on a failed/insufficient unlock.
- **`usePostingDetail` (`["posting-detail", id]`) is NOT invalidated by `useSubmitPostingWithOrg`** — only `["my-postings", userId]` is. After creating/updating a posting, invalidate `["posting-detail", id]` too or the detail view shows pre-submit data. Same class of bug for any detail-by-id key a list mutation doesn't touch.

### Logic nhân bản SQL ↔ TS — hai cặp, sửa một bên phải sửa bên kia
Báo cáo admin phải `GROUP BY` trên toàn bộ tin nên không thể suy sau khi đã tổng hợp ⇒ hai đoạn logic buộc phải tồn tại ở cả hai nơi. Không có test nào bắt được lệch — chỉ có comment chéo ở đầu mỗi bên.
- **Trạng thái phiên**: nhà chính thức TS là `sessionStatusOf()` trong `src/lib/listings/sessionStatus.ts`; bản sao SQL là `public.listing_session_status()` (migration `20260805000003`). `getSessionStatus()` trong `useAuctionListings.tsx` giờ chỉ là delegate — **đừng viết lại logic tại chỗ gọi**.
- **Rollup slug → nhóm cha**: `PARENT_OF` / `parentOf()` trong `src/lib/reports/listingsReport.ts` ↔ `public.asset_parent_slug()`. `listings.property_type_slug` chứa **hai thế hệ taxonomy** (bộ mới `ASSET_CATEGORIES` + bộ cũ chỉ-BĐS từ `property_types`), và `property_types` **không có** cột parent nên phải hardcode cả hai bộ. Slug lạ rơi vào `khac` — section `byCategoryChild` của RPC tồn tại chính là để lộ slug nào đang rơi vào đó (đã bắt được `kho-xuong`, `dat-nen`). Thêm slug mới ⇒ sửa **cả hai**.
- Đừng import `ASSET_CATEGORIES` vào `listingsReport.ts` — nó kéo theo `lucide-react`, phá tính thuần của module formatter (test sẽ phải mock thêm).

### Client-side org matching is a STOPGAP
`src/lib/orgMatching.ts` scores auction orgs client-side because `auction_organizations` only carries `name/province/org_type/…` and lacks real matching signals. `deriveOrgAttributes(org)` **fabricates** specialties, online-platform flag, experience tier, session count, commission rate — deterministically seeded from `org.id` (FNV-1a) so the UI is stable across renders, but the numbers are **not real data**.
- Do **not** persist derived attrs, show them as verified facts, or build billing/ranking-of-record on them.
- When the schema gains real columns, replace `deriveOrgAttributes()` only — `scoreOrg` / `rankOrgs` weights stay. The whole pool is fetched once (`["matched-orgs-pool"]`, `staleTime: 5m`) and ranked in `useMemo`; matching runs in the browser, not the DB.

### Migrations: push, THEN regenerate types — never hand-edit `types.ts`
Schema changes are two steps, both run by **you** (never ask the user):
```bash
npx supabase db push            # or --include-all for out-of-order files
npx supabase gen types typescript --project-id bcusbpkfnydqcvxxjvew > src/integrations/supabase/types.ts
```
- `src/integrations/supabase/types.ts` is **auto-generated** — any hand-edit is overwritten on the next `gen types`. If creds are unavailable and you hand-patch types to unblock the build (as done for `asset_postings` in `20260621000001`), treat it as temporary debt: the migration file is the source of truth, and the hand-edit must be reconciled once the migration is actually pushed.
- Migration `20260621000001_asset_postings.sql` is **NOT yet pushed** (no Supabase creds in the sandbox). Any code reading `asset_postings` / `asset_service_requests` will 404 against the live DB until it is. Check `npx supabase migration list` before assuming a table exists remotely.
- Every new table needs the `"own rows"` RLS policy (`USING (auth.uid() = user_id)`) in the same migration — a table without RLS is either fully open or fully closed, both wrong.

### RLS "own rows" — reads must be user-scoped, writes must set `user_id`
Credit/unlock/posting tables all carry a single `"own rows"` policy (`auth.uid() = user_id`).
- Reads: gate the query on `userId` and `enabled: !!userId` (see `useMyPostings`, `useCredits`) — an unauthenticated read returns `[]`/`null`, not an error, so a missing `enabled` guard silently shows empty state instead of the login prompt.
- Writes: always stamp `user_id: userId` on insert (`useSubmitPostingWithOrg` throws `"Bạn cần đăng nhập…"` when `userId` is null). An insert without `user_id` is rejected by RLS, not by a friendly validation message.
- Never widen a policy to read another user's credits/unlocks. Credit data is per-user by design.

### Unlock semantics are not uniform — don't treat them the same
From `src/lib/credits.ts` / `useCredits`:
- `unlockAsset` is **permanent** (`user_asset_unlocks`, cost `ASSET_COST` = 59). `assetUnlocked(id)` is a plain membership check.
- `unlockCompany` / `unlockOwner` are **time-limited AND stacking** — a new purchase extends from the existing expiry, it does not reset it. Check access via `companyAccess(orgId)` / `ownerAccess(ownerId)`, never by asking "did they ever buy it".
- `unlockDeepReportPeriod` key is `"{slug}:{periodId}"` (e.g. `"bds:2025-Q1"`). Buying a **year** unlocks every quarter/month inside it via `expandUnlock()` — so `isReportPeriodUnlocked` can be true for a period the user never bought directly. Don't reverse-engineer entitlements from the transaction ledger; ask the derive helpers.
- `credit_transactions` is **append-only** — never UPDATE/DELETE a ledger row to "fix" a balance; write a compensating entry.

### Provider order in `App.tsx` is load-bearing
`PaywallProvider` must sit **inside** `BrowserRouter` (it calls `useNavigate`). `AuthDialog` is a global singleton rendered next to `Toaster`/`Sonner`, above the router. Reordering — e.g. moving `PaywallProvider` outside Router, or nesting a second `AuthDialog` — breaks navigation-on-unlock or spawns duplicate auth modals. Trigger the login modal from anywhere via `useAuthDialog().openAuthDialog(cb?)`; don't mount your own `<AuthDialog>`.

### Vietnamese UI, hardcoded — no i18n layer
All strings are inline Vietnamese; there is no i18next / `t('…')`. Match the existing tone (e.g. "Đã tạo hồ sơ tài sản và gửi yêu cầu dịch vụ tới tổ chức đấu giá."). Don't introduce a translation layer or English fallbacks.

### Design tokens are fixed — never coin colors
Colors are HSL CSS variables in `src/index.css` (`--primary` navy, `--accent` amber, `--success`, `--warning`, `--muted-foreground`, `--radius`). Use token classes (`bg-primary`, `text-muted-foreground`). **Never** add a new color value, change a token, or hardcode a hex. Cards are `rounded-2xl`; inputs/buttons use `--radius` (0.5rem).

### KYC status is a fixed set — don't invent labels
`organizations.kyc_status` moves `PENDING_KYC → APPROVED | REJECTED` (admin review). Don't coin intermediate statuses. Org roles are **per-organization and user-creatable** (`org_roles`) — the old fixed Owner/Manager/Agent table is gone, so never hardcode a role-name comparison: use `org_has_permission()` / `org_is_owner()`. A new org gets its roles from `org_seed_default_roles()` inside the `create_owner_membership` trigger. Phone requires OTP verification; CCCD is 9–12 digits, passport ≥ 6 chars — enforce via the Zod schema, not ad-hoc checks.

### Never import a "versioned" Supabase client
There is exactly one client: `import { supabase } from "@/integrations/supabase/client"`. This project has **no** versioned/alternate client (unlike some sibling repos). Any other import path is wrong.

## Bồi dưỡng ĐGV: đừng kết luận chỉ bằng số giờ

`trainingCompliance()` trong `src/lib/personnel/completeness.ts` nay là **wrapper mỏng** quanh `evaluateCpd()`. Nó nhận tham số thứ ba là **diện miễn** — quên truyền thì người đang được miễn theo Điều 26.3 bị in "CÒN THIẾU 8 giờ" ngay trên bản hồ sơ nộp thầu.

```ts
// SAI — mất diện miễn, kết luận sai luật
const comp = trainingCompliance(events)

// ĐÚNG
const ex = exemptions.find((x) => x.year === year)
const comp = trainingCompliance(events, year, ex ? { reason: ex.reason } : undefined)
```

Ba nơi phải nạp `cpdExemptions` cùng với `events`: `usePersonnelDossier`, `useDossierExports` (bundle kết xuất), và bất kỳ chỗ nào mới. Tương tự, đừng tự cộng `hours` để suy "đạt/chưa đạt" — hoạt động cho hoàn thành cả năm (Điều 26.2) đạt với **0 giờ**.

Từ `20260806000040` còn một thứ BẮT BUỘC nạp kèm: **danh mục bồi dưỡng** (`useCpdCatalog` ở phía React, `DossierBundle.cpdCatalog` ở phía kết xuất). Không có nó, `makeCpdResolver` trả `undefined` cho mọi bản ghi ⇒ cả đội tụt về "chưa đủ giờ". Vì vậy `useOrgCpd.isLoading` **gộp cả `catalogLoading`** — nhấp nháy một kết luận pháp lý sai còn tệ hơn chờ thêm một nhịp.

`events.hours` KHÔNG phải số giờ được tính. Giờ được tính = `creditedHoursOf(e, rule)` (quy đổi cố định thắng số khai, và bằng 0 khi hình thức cho đạt cả năm). Còn số hiện trên thanh tiến độ là thứ THỨ BA: `progressHours(ev)` quy đạt-cả-năm về 8/8. Ba con số, ba mục đích — dùng nhầm là hiện "0/8 giờ" cạnh badge "Đạt".

## Tailwind không nội suy được tên màu vào chuỗi class

`` className={`border-${tone}/40`} `` biên dịch ra rỗng — Tailwind quét class TĨNH trong mã nguồn, không chạy chuỗi template. Viết đủ cả hai nhánh:

```tsx
className={urgent ? 'border-destructive/40 bg-destructive/5' : 'border-warning/40 bg-warning/5'}
```

