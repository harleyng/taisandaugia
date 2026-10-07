# Common Pitfalls — Tài Sản Đấu Giá (taisandaugia)

> Living document. Things that have gone wrong or are easy to get wrong. **Newest first**, dated. Add an entry whenever a non-obvious bug bites. This is a current-truth doc — when the code moves, update the entry (don't leave a stale warning).

---

## 2026-10-01 — Hồ sơ online (M0): 3 cái bẫy

- **Trình duyệt trong app Zalo có chữ "Zalo" trong User-Agent** — y như bot xem trước link của Zalo. Middleware OG mà trả trang rút gọn chỉ có thẻ meta thì người thật mở trong Zalo sẽ thấy trang trắng. `middleware.ts` trả index.html đã chèn thẻ, nên nhận nhầm vẫn chạy SPA.
- **`posting_share_links.code` không có quyền SELECT** (giống `share_token` của báo cáo) ⇒ `select('*')` báo `permission denied`. Đọc mã qua RPC `owner_posting_share_links`.
- **Ghi đè catalog quyền từ file migration cũ làm rơi quyền của phiên khác.** M1 tạo lại `owner_ws_permission_catalog()` từ bản 41 quyền ⇒ mất `so-hoa:share` (đã vá ở `20261001230000`). Sửa catalog / `owner_ws_default_role_permissions` thì luôn bắt đầu từ `pg_get_functiondef` của bản LIVE.

## 2026-09-26 — Dòng tiền (P15a): 4 cái bẫy

- **Đừng ghi `paid_amount` / `paid_at` / `auction_fee` của `owner_asset_outcomes`.** Từ Phase 15a đó là tổng do trigger `owner_asset_outcomes_money` dựng từ sổ `owner_cash_events`; client ghi thẳng ⇒ P0001. Muốn đổi số đã thu: thêm / sửa / xoá một khoản thu chi (hoặc `owner_cash_settle`). Chỉ `payment_status = 'defaulted'` là cờ ghi tay.
- **Insert sổ thu chi chỉ được gửi đúng các cột có GRANT** (`outcome_id, kind, amount, occurred_on, note`). Kiểu Insert sinh tự động đòi `workspace_id` (NOT NULL, trigger điền) ⇒ ép kiểu `as unknown as TablesInsert<…>` trong hook; gửi thêm `workspace_id` / `created_by` là `permission denied for table`. Dựng payload bằng `toCashEventInsert` / `toCashEventUpdate`.
- **Radix Dialog làm phần còn lại của trang `aria-hidden`.** Test Playwright bằng `getByRole` sẽ "không thấy" nút phía sau khi hộp thoại còn mở — đóng hộp thoại trước. Và `getByRole('button', { name: 'Ghi thu' })` khớp cả "Ghi thu chi" ⇒ dùng `exact: true`.
- **Trang cổng cuộn trong `<main>`, không phải document.** `page.screenshot({ fullPage: true })` chỉ ra màn đầu; muốn chụp trọn thì đặt `height:auto; overflow:visible` cho `main` và các tổ tiên trước khi chụp.

## 2026-09-26 — Link chia sẻ báo cáo (P11): 3 cái bẫy

- **`select('*')` trên `owner_report_snapshots` bị từ chối.** `authenticated` chỉ có quyền SELECT theo CỘT, trừ `share_token`, nên `*` sẽ báo `permission denied`. Luôn liệt kê cột (`BASE_COLUMNS` trong `useOwnerPeriodicReports`). Muốn đọc token thì qua RPC `owner_report_share_link`. PostgREST 14 chỉ `RETURNING` các cột được select ⇒ `.insert/.update/.delete(...).select("id")` vẫn chạy.
- **Trigger BEFORE đảo ngược `ON DELETE SET NULL` = FK treo.** Guard viết `NEW.created_by := OLD.created_by` sẽ âm thầm giữ id của tài khoản đã bị xoá: PostgreSQL không kiểm lại FK khi khoá không đổi. Còn nếu guard `RAISE` với mọi thay đổi (báo cáo đã chốt) thì xoá tài khoản bị chặn luôn. Guard phải cho phép cột FK đổi về NULL.
- **RPC công khai có tăng bộ đếm thì phải gọi đúng MỘT lần.** Mặc định React Query refetch khi focus / reconnect và retry ⇒ lượt xem bị thổi phồng. Xem các option trong `useSharedOwnerReport`. Và nhớ thêm route có token vào `normalizePath` của `AnalyticsTracker`: `analytics_events.path` do admin đọc, token nằm trong path là lộ link.

## 2026-09-26 — Báo cáo định kỳ (P10): 3 cái bẫy

- **Select đường dẫn JSON làm tsc sập (TS2589).** Ví dụ `.select("…, scope:payload->meta->scope")` báo "Type instantiation is excessively deep". Cách chữa: khai chuỗi select là `string` (không phải literal), tự khai kiểu dòng rồi ép `as unknown as Row[]` — xem `useOwnerReports`. Nhờ vậy danh sách lấy được vài trường tóm tắt mà khỏi tải cả payload.
- **Quyền CỘT + client gửi thừa cột = `permission denied for table`.** Bảng chỉ GRANT INSERT/UPDATE theo cột (như `owner_report_snapshots`): client gửi thêm bất kỳ cột nào ngoài danh sách (kể cả `created_by: null`) là hỏng cả câu. Thông báo lỗi nhắc tới BẢNG, không nhắc cột ⇒ dễ tưởng là lỗi RLS.
- **Màu chữ và ô chỉ số trong bản in.** `text-warning` (vàng hổ phách) trên nền trắng không đủ tương phản. Trạng thái bỏ cọc / tồn đọng: dùng icon mang màu cạnh chữ `text-foreground`. Ô `StatTile` có `truncate` ⇒ bản in 4 cột bị cắt chữ; thêm `print:[&_p]:whitespace-normal` vào lưới.

## 2026-09-26 — `sr-only` bên trong vùng cuộn ngang làm cả trang cuộn ngang

`.sr-only` là `position: absolute`. Nếu không tổ tiên nào `relative`, khối chứa của nó là cả trang ⇒ nó **thoát khỏi** `overflow-x-auto` của vùng cuộn và cả `overflow-hidden` của layout. Đường ống (P12) ở 390px: `documentElement.scrollWidth` = 1513, trong khi `main` và `body` vẫn 390. Cách sửa: đặt `relative` cho vùng cuộn (và cho thẻ). Kiểm tràn ngang phải đo `document.documentElement.scrollWidth`, không chỉ `main`.

## 2026-09-26 — Hồ sơ số hoá theo không gian (P4): 6 cái bẫy

- **Policy `TO public` + hàm đã thu hồi quyền của anon = mọi truy vấn đọc của anon đều hỏng.** Postgres kiểm quyền EXECUTE ngay lúc khởi tạo biểu thức, TRƯỚC khi short-circuit. Chỉ một policy storage `TO public` gọi `owner_posting_can` (đã REVOKE anon) là mọi SELECT `storage.objects` của anon báo "permission denied", kể cả biên bản đấu giá công khai. Policy viết lại phải `TO authenticated`, và hàm gọi thẳng trong policy phải giữ EXECUTE cho authenticated.
- **DDL trên bảng nóng dễ deadlock với truy vấn đang chạy.** Lần áp đầu của `20260926152759` chết giữa chừng: tx của mình giữ `asset_postings`, đợi `asset_owner_org_kyc`; truy vấn của app đi chiều ngược lại. Migration đụng nhiều bảng thì `LOCK TABLE … IN ACCESS EXCLUSIVE MODE` MỌI bảng trong một câu ở đầu file, và chạy với `PGOPTIONS='-c lock_timeout=30s'`. Áp thất bại thì XOÁ dòng `schema_migrations` vừa ghi.
- **Bộ lọc thư mục gốc = uid là CHỐT chống đọc trộm, không phải tiện ích.** Bỏ `c.owner_user_id = folder[1]` đi là ai có quyền ghi hồ sơ cũng dán được đường dẫn tệp của người khác vào `doc_urls`, rồi đọc qua policy. Luật thay thế: `owner_posting_file_owner_ok` — thư mục gốc phải là người tạo (Cá nhân) hoặc một thành viên của không gian.
- **`consignment_owner_party(user)` ưu tiên KYC TỔ CHỨC.** Người vừa có KYC cá nhân vừa làm ở ngân hàng sẽ ký hợp đồng cá nhân dưới tên ngân hàng. Bên A phải suy từ hồ sơ: `consignment_posting_owner_party`.
- **Đổi / xoá chi nhánh không được hạ hồ sơ đã duyệt.** `ON DELETE SET NULL` là một UPDATE ⇒ review guard thấy `NEW.* ≠ OLD.*` ⇒ đẩy về `pending`. Guard nay so sánh `to_jsonb(NEW) - 'branch_id'`. Thêm cột "tổ chức nội bộ" nào khác thì loại cột đó ra khỏi phép so sánh theo cùng cách.
- **Hook gọi trong `&&` là hook có điều kiện.** `mode === "owner" && usePostingCanWrite()` vi phạm rules-of-hooks. Gọi hook trước, rồi mới `&&`.

## 2026-09-26 — Chi nhánh tự onboard (P13): embed tự tham chiếu + 2 FK tới `asset_owners`

- **Embed công ty mẹ của `asset_owners`** phải viết `parent:parent_owner_id(id, name)`, tức lấy tên cột làm quan hệ, ra đúng một object.
  - `asset_owners!asset_owners_parent_owner_id_fkey(...)` ⇒ PGRST200.
  - `asset_owners!parent_owner_id(...)` ⇒ trả mảng **con** (chiều một-nhiều), nên luôn `[]` với chi nhánh.
  - Chuỗi dùng chung: `REGISTRY_OWNER_SELECT` trong `src/types/asset-owner.ts`.
- **`asset_owner_org_kyc` giờ có 2 FK tới `asset_owners`** (`linked_asset_owner_id` + `parent_asset_owner_id`). Mọi embed kiểu `asset_owners(...)` từ bảng này phải chỉ đích danh FK (xem mục PGRST201 bên dưới). Không thì trang duyệt KYC admin hiện rỗng mà không báo lỗi.
- **Chuỗi select ghép bằng `+` làm hỏng suy kiểu** của supabase-js (`GenericStringError[]`). Dù dài, phải viết thành một literal.
- **Trigger chặn nghiệp vụ trên bảng ghi trực tiếp từ client** (KYC nộp bằng `.update({status})`): PostgREST trả `message` = mã RAISE. Map sang tiếng Việt ở một chỗ (`mapOrgKycError`), đừng để toast chung chung.

## 2026-09-26 — Thành viên không gian chủ tài sản (P3): 5 cái bẫy

- **Trigger "giữ owner cuối" đếm KHÔNG khoá.** Owner A gỡ B và B gỡ A trong cùng thời điểm: mỗi giao dịch vẫn thấy người kia còn active ⇒ cả hai lọt ⇒ không còn owner. RPC ghi thành viên phải `SELECT … FROM asset_owner_workspaces WHERE id = … FOR UPDATE` TRƯỚC khi kiểm quyền. Đây cũng là lý do bỏ policy ghi trực tiếp: đi thẳng PostgREST thì né được khoá.
- **UPDATE một dòng từng là owner (status `removed`) sẽ bị guard coi là "thu hồi vai trò owner".** Khi người đó chấp nhận lời mời mới, `owner_ws_accept_invite` phải DELETE dòng cũ rồi INSERT dòng mới, chứ không UPDATE.
- **Cặp nhân bản SQL↔TS:** `owner_ws_can` / `owner_ws_branch_ok` / `owner_ws_claim_write_ok` ↔ `src/lib/ownerWorkspace/roles.ts`. Chi nhánh của một claim được suy từ `asset_owner_id` ở CẢ ba nơi: `owner_ws_claim_write_ok`, `useClaimWriteAccess` và trigger của P6. `roles.test.ts` ghim ma trận quyền.
- **Node ≥ 22 có `localStorage` riêng** (rỗng khi thiếu `--localstorage-file`) và nó che mất bản của jsdom. Trong test, `window.localStorage` là `undefined`. Tự cắm Storage trong bộ nhớ bằng `Object.defineProperty(window, "localStorage", …)`, xem `selection.test.ts`.
- **tsconfig không strict ⇒ `!result.ok` KHÔNG thu hẹp union `{ok:true}|{ok:false}`.** Phải viết `result?.ok === false`.

## 2026-09-26 — Biên bản kết quả phiên: xoá TỆP trước, xoá DÒNG sau

Policy của bucket `owner-outcome-evidence` (`owner_outcome_evidence_ok`) đòi bản ghi `owner_asset_outcomes` ở segment 2 **còn tồn tại**, vì đó là cách nó biết tệp thuộc không gian nào và chi nhánh nào. Nếu xoá dòng trước, tệp thành mồ côi: không thành viên nào xoá được nữa, chỉ còn service_role. Chiều ghi cũng ngược lại vì cùng lý do: tạo dòng → tải tệp → gắn `evidence_urls`. Trigger guard từ chối đường dẫn không có thật trong `storage.objects`, nên không thể gắn trước rồi tải sau.

## 2026-09-26 — Trigger "giữ owner cuối" + ON DELETE CASCADE = không xoá được cha

- `asset_owner_workspace_members` có FK CASCADE tới cả `asset_owner_workspaces` và `profiles`. Một trigger BEFORE DELETE ném lỗi khi xoá owner cuối sẽ **chặn luôn việc xoá workspace hoặc xoá user**, vì cascade đi qua đúng trigger đó. `owner_ws_protect_last_owner` cho qua khi dòng cha đã biến mất (`NOT EXISTS` workspace/profile — trong cascade, dòng cha đã xoá là thấy được). Viết trigger bảo vệ kiểu này cho bảng khác thì phải chép cả nhánh đó. `org_protect_last_owner` KHÔNG có nhánh này.
- **Trigger chạy dưới JWT của người kích hoạt.** Dòng owner đầu tiên sinh trong trigger duyệt KYC mang `auth.uid()` = admin, mà admin không phải owner ⇒ guard "chỉ owner trao owner" phải có ngoại lệ bootstrap. Trong guard, nhớ `COALESCE(điều_kiện, false)`: `IF NOT NULL` không raise, nên có lỗ hổng im lặng.

## 2026-09-12 — Chốt phiên đấu giá làm lộ 3 lớp bẫy im lặng

- **Union hẹp hơn CHECK của DB = nhãn trống, không phải lỗi biên dịch.** `DepositStatus` thiếu `applied`/`pending_refund` suốt từ `20260913000001`; `DEPOSIT_STATUS_LABELS[x]` trả `undefined` và React render ra ô rỗng. Chỉ lộ ra khi chốt phiên vì đó là lúc hai trạng thái kia sinh ra. Nới CHECK ở migration thì phải nới union NGAY trong cùng lần đó.
- **`PublicSession = Omit<AuctionSession, 4 cột nội bộ>` KHAI mọi cột còn lại là có.** Quên một cột trong chuỗi `select(...)` viết tay ⇒ `undefined` lúc chạy, typecheck vẫn xanh, và mọi cổng `if (session.cot_do)` im lặng sai mãi mãi. Đã cắn hai lần: `max_bid_steps` (Bước 4), `finalized_at` (Bước 6). Thêm cột là phải sửa CẢ BA select trong `usePublicAuctionSessions.ts`.
- **`deposit_status !== 'received'` KHÔNG có nghĩa là "chưa nộp tiền".** Sau `org_finalize_session` nó là `applied` (trúng) hoặc `pending_refund` (không trúng). Bất cứ chỗ nào suy ra câu chữ từ phép so sánh này đều nói sai với người đã nộp tiền — xem `useMyBidderStatus`.
- **Badge `rounded-full` mà cho xuống dòng sẽ thành cục tròn.** Nhãn dài ("Chuyển vào tiền mua tài sản" ~200px) trong cột hẹp: hoặc `whitespace-nowrap` + nhường chỗ, hoặc đưa xuống dòng phụ. Kèm theo: nút thao tác nằm sau một cột quá rộng sẽ trôi ra ngoài vùng `overflow-x-auto` — vẫn trong DOM, người dùng không thấy. Đo bằng `getBoundingClientRect().right` so với thẻ, đừng tin ảnh chụp đã cắt.
- **jsdom 20 không có `crypto.subtle`** (node có). Test cần SHA-256 phải mở đầu bằng `// @vitest-environment node`, và `src/test/setup.ts` phải bọc `typeof window !== "undefined"` nếu không nó đổ trước khi test chạy.

## 2026-09-12 — `asset_parent_slug(NULL)` = 'khac'; ba cặp nhân bản SQL↔TS mới của tiếp thị phiên

- **`asset_parent_slug(NULL)` trả `'khac'`** (CASE … ELSE 'khac'). Truy vấn nào so slug cha phải kiểm `category_slug IS NOT NULL` trước, nếu không lô chưa phân loại sẽ khớp mọi khách quan tâm "Khác". Xem `org_session_audience`.
- **Cặp nhân bản — sửa một bên phải sửa bên kia:**
  - `outreach_send_window_open` (SQL) ↔ `canMarkSent` (`src/lib/outreach/sendWindow.ts`) — `sendWindow.test.ts` ghim mốc biên.
  - Cột generated `org_contacts.phone_digits` ↔ `phoneDigits()` (`src/lib/orgContacts/phone.ts`).
  - CHECK `session_outreach_fields.field_key` ↔ `FIELD_KEY_PATTERN` — `fieldKeys.test.ts` đọc thẳng file migration.
- **Mẫu thông báo đã phát hành không sửa câu chữ.** Thêm phiên bản mới vào `NOTICE_TEMPLATES` + hash mới; sửa bản cũ ⇒ `noticeTemplate.test.ts` đỏ (có chủ đích — gói đã tạo trỏ tới version cũ).
- **`normalize_province` nằm trong generated column `province_keys`.** Sửa hàm không tự tính lại giá trị đã lưu — phải `UPDATE org_contact_interests SET provinces = provinces`.
- **Kiểm kết quả RPC bằng câu SELECT riêng.** Subquery trong CÙNG câu với lời gọi RPC đọc snapshot trước khi RPC ghi ⇒ trông như RPC không có tác dụng.

## 2026-09-06 — Trigger "nuốt thay đổi" chặn cả migration và service_role

`asset_postings_review_guard` gán trả 5 cột duyệt về `OLD` khi caller không có quyền `tai-san-tu-nguyen`.`approve`. Nó **không RAISE** — đó là chủ ý (chủ tài sản sửa hồ sơ là việc hợp lệ, chỉ phần kết luận duyệt là không được đụng). Hệ quả gài bẫy:

- **Migration chạy với `auth.uid()` NULL** ⇒ `admin_has_permission()` false ⇒ mọi `UPDATE ... SET review_status` trong migration **bị nuốt trong im lặng**. Đúng chuyện đã xảy ra ở `20260906000001` (câu backfill đặt sau `CREATE TRIGGER`), phải sửa bằng `20260906000002`:
  ```sql
  ALTER TABLE public.asset_postings DISABLE TRIGGER asset_postings_review_guard;
  UPDATE ...;
  ALTER TABLE public.asset_postings ENABLE  TRIGGER asset_postings_review_guard;
  ```
  Hoặc đơn giản hơn: **đặt backfill TRƯỚC `CREATE TRIGGER`**.
- **Client cũng phải tự kiểm.** `.update()` trả về dòng đã đổi *nội dung* nhưng `review_status` giữ nguyên ⇒ không có `error`, toast vẫn xanh. `useReviewAssetPosting` so `review_status` trả về với giá trị mong đợi rồi mới báo thành công.
- **Tên trigger là load-bearing:** phải sắp trước `asset_postings_updated_at` theo thứ tự chữ cái (Postgres chạy trigger cùng loại theo tên). Đổi tên ⇒ `updated_at` đã bị đổi khi so `NEW.* IS DISTINCT FROM OLD.*` ⇒ hồ sơ đã duyệt rơi về `pending` sau *mọi* UPDATE.

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
- **RPC ký gửi trả `{ ok:false, reason }` với `error = null`** (`owner_select_service_quote`, `org_respond_service_request`, từ `20260912000001`). Chỉ `if (error) throw` là toast xanh cho một lần chốt/báo giá THẤT BẠI. Luôn `assertRpcOk(data)` (`src/lib/consignment/errors.ts`) và invalidate ở `onSettled` — thất bại vì "hồ sơ đã chốt" thì màn hình càng phải refetch để hiện tổ chức thật sự đã được chốt.
- **`usePostingDetail` (`["posting-detail", id]`) is NOT invalidated by `useSubmitPostingWithOrg`** — only `["my-postings", userId]` is. After creating/updating a posting, invalidate `["posting-detail", id]` too or the detail view shows pre-submit data. Same class of bug for any detail-by-id key a list mutation doesn't touch.

### Logic nhân bản SQL ↔ TS — ba cặp, sửa một bên phải sửa bên kia
Báo cáo admin phải `GROUP BY` trên toàn bộ tin nên không thể suy sau khi đã tổng hợp ⇒ hai đoạn logic buộc phải tồn tại ở cả hai nơi. Không có test nào bắt được lệch — chỉ có comment chéo ở đầu mỗi bên.
- **Trạng thái phiên**: nhà chính thức TS là `sessionStatusOf()` trong `src/lib/listings/sessionStatus.ts`; bản sao SQL là `public.listing_session_status()` (migration `20260805000003`). `getSessionStatus()` trong `useAuctionListings.tsx` giờ chỉ là delegate — **đừng viết lại logic tại chỗ gọi**.
- **Rollup slug → nhóm cha**: `PARENT_OF` / `parentOf()` trong `src/lib/reports/listingsReport.ts` ↔ `public.asset_parent_slug()`. `listings.property_type_slug` chứa **hai thế hệ taxonomy** (bộ mới `ASSET_CATEGORIES` + bộ cũ chỉ-BĐS từ `property_types`), và `property_types` **không có** cột parent nên phải hardcode cả hai bộ. Slug lạ rơi vào `khac` — section `byCategoryChild` của RPC tồn tại chính là để lộ slug nào đang rơi vào đó (đã bắt được `kho-xuong`, `dat-nen`). Thêm slug mới ⇒ sửa **cả hai**.
- **"Đã bán" của cổng chủ tài sản — KHÔNG còn là cặp nhân bản** (2026-09-26, P5): chỉ RPC `owner_asset_outcomes_resolved` quyết định (xem business-rules.md → Giá trúng hợp nhất). TS chỉ đọc `resolvedOutcome` qua `isSoldRow()`, đừng viết lại `status === "SOLD_RENTED" || winPrice` ở chỗ gọi. Bản cũ còn sót ở admin: `listing_auction_bucket()` (dùng bởi `admin_prospect_detail`) vẫn theo luật chỉ-dữ-liệu-cào.
- **Hợp đồng ký gửi**: `MissingParty` (`src/types/consignment-contract.ts`) ↔ `consignment_missing_parties()`; nút hiện/ẩn trong `src/lib/consignment/contractState.ts` ↔ guard trạng thái trong các RPC `consignment_contract_*` (migration `20260912000004`). Server quyết định — lệch thì nút hiện mà RPC trả `invalid_status`. Tổ chức **không có policy SELECT** trên `consignment_contracts`: `.from("consignment_contracts")` phía portal trả MẢNG RỖNG chứ không báo lỗi — phải đi qua RPC `org_consignment_contract`. Đổi cột trả về của `org_service_requests` lần nữa ⇒ DROP FUNCTION trước.
- **Ai đang phải làm (badge ký gửi)**: `awaitingSides()` trong `contractState.ts` ↔ `contracts_action` của `org_service_request_counts`; nhãn `postingBadge.ts` ↔ `owner_action` của `owner_consignment_summary` (migration `20260912000007`). Thêm trạng thái / loại việc ⇒ sửa cả SQL lẫn TS. Dự thảo PDF KHÔNG được tự cộng phí — in `terms.service_fee` (xem cặp "Tổng phí báo giá ký gửi" bên dưới).
- **Tổng phí báo giá ký gửi**: `feeTotalRequired()` trong `src/lib/quotePlan.ts` ↔ `SUM((i->>'amount')::numeric) WHERE NOT optional` trong nhánh `quote` của `org_respond_service_request` (migration `20260911000002`). **Server là bên quyết định** — hàm TS chỉ để hiện tổng ngay khi đang gõ. Lệch nhau thì chủ tài sản chọn theo một con số rồi ký hợp đồng theo con số khác, mà con số server còn đi thẳng vào `opportunities.gross_amount`.
- Đừng import `ASSET_CATEGORIES` vào `listingsReport.ts` — nó kéo theo `lucide-react`, phá tính thuần của module formatter (test sẽ phải mock thêm).

### Client-side org matching is a STOPGAP
`src/lib/orgMatching.ts` scores auction orgs client-side because `auction_organizations` only carries `name/province/org_type/…` and lacks real matching signals. `deriveOrgAttributes(org)` **fabricates** specialties, online-platform flag, experience tier, session count, commission rate — deterministically seeded from `org.id` (FNV-1a) so the UI is stable across renders, but the numbers are **not real data**.
- Do **not** persist derived attrs, show them as verified facts, or build billing/ranking-of-record on them.
- When the schema gains real columns, replace `deriveOrgAttributes()` only — `scoreOrg` / `rankOrgs` weights stay. The whole pool is fetched once (`["matched-orgs-pool"]`, `staleTime: 5m`) and ranked in `useMemo`; matching runs in the browser, not the DB.

### Migrations: push, THEN regenerate types — never hand-edit `types.ts`
Schema changes are two steps, both run by **you** (never ask the user):
```bash
npx supabase db push            # or --include-all for out-of-order files
npx supabase gen types typescript --project-id vewtnkewyawmkpeymdot > src/integrations/supabase/types.ts
```
- `src/integrations/supabase/types.ts` is **auto-generated** — any hand-edit is overwritten on the next `gen types`. If creds are unavailable and you hand-patch types to unblock the build, treat it as temporary debt: the migration file is the source of truth, and the hand-edit must be reconciled once the migration is actually pushed.
- ~~Migration `20260621000001_asset_postings.sql` is NOT yet pushed~~ — **stale, corrected 2026-09-06.** `npx supabase migration list` shows it local+remote; `asset_postings` exists in the live DB. Don't trust a "not pushed" note in this file over `migration list` — run the command.
- Đọc số liệu ra `npx supabase db query --linked --file <f>` (KHÔNG có `db execute`; thiếu `--linked` là nó nối vào Postgres **local** rồi báo ECONNREFUSED).
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


## `asset_postings`: trigger duyệt NUỐT thay đổi của mọi caller không có quyền `approve`

`guard_asset_posting_review()` (`20260906000001`) là `BEFORE UPDATE`. Với caller không có `admin_has_permission('tai-san-tu-nguyen','approve')` nó gán trả 5 cột duyệt về giá trị cũ, **và** nếu hồ sơ đang `approved` thì đá luôn về `pending`:

```sql
IF OLD.review_status = 'approved' AND NEW.* IS DISTINCT FROM OLD.* THEN
  NEW.review_status := 'pending'; ...
```

Ba điều dễ mất máu:

1. **`SECURITY DEFINER` KHÔNG cứu được.** `auth.uid()` bên trong hàm definer vẫn là uid của **người gọi**, nên RPC chạy dưới danh nghĩa chủ tài sản vẫn bị guard. Vì vậy luồng ký gửi **không ghi gì vào `asset_postings`** — quan hệ với tổ chức nằm hoàn toàn trong `asset_service_requests`, và "tổ chức đã chốt" suy ra từ yêu cầu `status='selected'`.
2. **Migration và `service_role` cũng bị nuốt** (`auth.uid()` là NULL). Muốn ghi 5 cột duyệt từ phía server thì phải `ALTER TABLE ... DISABLE TRIGGER` tường minh rồi bật lại — `20260906000002` sinh ra chỉ vì bài học này.
3. **Đổi tên trigger là đổi hành vi.** Postgres chạy trigger cùng loại theo THỨ TỰ TÊN; `asset_postings_review_guard` < `asset_postings_updated_at` nên guard chạy trước, lúc `updated_at` chưa bị đụng. Đổi tên cho nó chạy sau ⇒ `NEW.* IS DISTINCT FROM OLD.*` luôn đúng ⇒ mọi UPDATE đá hồ sơ đã duyệt về `pending`.

Không có lỗi nào nổ ra trong cả ba trường hợp — UPDATE báo thành công, dữ liệu lặng lẽ không đổi.

## RLS lọc theo DÒNG, không giấu được CỘT

Lặp lại lần thứ ba trong repo (`public_org_auctioneers`, `list_tool_showcases`, và nay `org_service_requests`): khi một bên được xem *một phần* của hàng, đừng nới policy — chiếu qua RPC `SECURITY DEFINER` và liệt kê tay các cột trả về. Tổ chức đấu giá cần xem tài sản để định giá nhưng **không** được thấy danh tính chủ tài sản, địa chỉ số nhà (`address`/`ward`) hay `ownership_proof_urls`. Thêm cột vào màn tổ chức = phải mở tương ứng trong RPC, và đó chính là chỗ để dừng lại tự hỏi có nên mở không.

## Cơ hội hoa hồng: đối tác có thể nằm ở DỊCH VỤ chứ không ở CƠ HỘI

`opportunities.supplier_id` (thêm ở `20260907000003`) chỉ được set bởi luồng **ký gửi**. Luồng **công cụ đấu giá** (`request_tool_service`) không bao giờ set nó: dịch vụ của nó là `supplier_scope='fixed'`, đối tác nằm trên `services.supplier_id` và trigger `orders_sync_kind_and_commission` tự điền xuống đơn.

Vì vậy trong bất kỳ chỗ nào cần "đối tác của cơ hội này", phải dùng:

```sql
COALESCE(opportunities.supplier_id, services.supplier_id)
```

`20260907000003` đã chặn cứng `supplier_id IS NULL` và **khoá oan 8 cơ hội đang mở** của luồng công cụ; `20260907000004` sửa lại. Chỉ chặn khi CẢ HAI đều rỗng — đó mới thật sự là dịch vụ `per_order` chưa chọn đối tác.

## Bucket private: `getPublicUrl` trả link trông hợp lệ nhưng luôn 400

`contract-documents` là bucket đầu tiên trong repo có `public = false` (mọi bucket trước — `partner-logos`, `asset-media` — đều public-read). Với bucket private:

- Lưu **đường dẫn** trong DB (`supplier_contracts.doc_path`), không lưu URL.
- Mở file bằng `createSignedUrl(path, ttl)`; `getPublicUrl` **không báo lỗi**, nó trả về một URL đúng cú pháp mà mọi request tới đó đều 400.
- Policy `SELECT` cũng phải gác `has_role(...,'ADMIN')` — `public = false` chặn đường CDN ẩn danh, nhưng client đã đăng nhập vẫn đi qua RLS của `storage.objects`.

## Engine AI chạy trên trình duyệt KHÔNG phải ranh giới tin cậy

Hỏi đáp tài liệu phiên (`20260912000101`): engine mock chạy trên máy người mua. Nếu client gửi *văn bản câu trả lời*, người mua sửa thành gì cũng được mà vẫn kèm "trích dẫn" hợp lệ. Luật: client chỉ gửi đề xuất `{clause_id, quote}`; server kiểm quote là chuỗi con nguyên văn của điều khoản citable **cùng phiên** rồi tự dựng câu trả lời (`case_qa_compose_answer`, song sinh `src/lib/caseQa/compose.ts` — sửa định dạng thì sửa cả hai). Khi có Edge Function AI thật: bỏ tham số `_proposal`, đừng mở rộng nó.

Bẫy đi kèm:
- Supabase **tự GRANT EXECUTE hàm mới cho `anon` + `authenticated`** ⇒ hàm nội bộ (`case_qa_apply_proposal`, `case_qa_validate_citations`…) phải `REVOKE … FROM PUBLIC, anon, authenticated` tường minh; khối kiểm chứng cuối migration nên assert điều đó.
- plpgsql `RETURNS TABLE (status …)` + truy vấn có cột `status` ⇒ lỗi "ambiguous column" — thêm `#variable_conflict use_column` hoặc qualify mọi cột.
- Trên UI "hồ sơ" đã là hồ sơ tham gia đấu giá của người mua ⇒ tài liệu của phiên gọi là **"Tài liệu phiên"**.

## Phòng đấu giá (Bước 4): 4 cái bẫy ở lớp giao diện

- **Truy vấn công khai liệt kê cột BẰNG TAY, type thì không.** `usePublicAuctionSession` thiếu `bidding_method` / `extension_seconds` / `max_bid_steps` trong khi `PublicSession` khai báo có ⇒ TypeScript im lặng, `max_bid_steps` là `undefined`, `maxBid()` ra `NaN`, mọi lượt bị chặn oan bằng `bid_too_many_steps`. Thêm cột mới vào `auction_sessions` thì phải sửa cả 3 chuỗi `.select()` trong `usePublicAuctionSessions.ts`.
- **`biddingReasonMessage(reason)` thiếu tham số thứ hai là ra câu KHÁC server.** Server trả kèm `min_amount` / `max_amount` và ghép vào câu; client không truyền `{ min_amount, max_amount }` sẽ hiện câu chung chung trong khi server nói rõ số tiền.
- **Lô TẠM DỪNG: `ends_at` là số cũ.** `org_resume_lot` mới cộng bù `(now − paused_at)`. Chạy đồng hồ lúc đang dừng = nói dối. Ẩn đồng hồ khi `phase === 'paused'`.
- **Rút giá xong thì `useMyBidderStatus` báo `no_deposit`** ("tổ chức chưa ghi nhận tiền đặt trước") — SAI: tiền đã nhận rồi bị tịch thu. Phải có nhánh `forfeited` riêng, và nhớ họ vẫn có thể đang dẫn đầu lô khác (`_recompute_lot_leader` chỉ chạy cho ĐÚNG lô vừa rút).
- Phụ: `useLotBids` không có kênh riêng — màn nào hiện nó cũng phải đang mount `useLotStates` cùng phiên. Nonce phải đóng băng CÙNG số tiền, đổi tiền mà giữ nonce thì server trả về đúng lượt CŨ.

## Đấu giá trực tuyến: bảng CHỈ GHI THÊM chặn cả migration, seed và xoá tài khoản

`auction_bids`, `auction_lot_events`, `auction_deposit_events`, `auction_session_minutes` (`20260913000001`) có trigger ném lỗi với MỌI UPDATE/DELETE — kể cả `postgres`/`service_role` — và FK `ON DELETE RESTRICT` sang lô/phiên/hồ sơ.

- **Gỡ seed demo** (bước 2 dựng PDG000013): `ALTER TABLE … DISABLE TRIGGER` trên các bảng này, DELETE theo thứ tự con → cha (`auction_lot_states.current_bid_id` trỏ `auction_bids` nên xoá/NULL trạng thái lô trước), rồi ENABLE lại. Xoá phiên/lô/hồ sơ đã có lượt trả giá bằng tay sẽ vỡ FK.
- **Đừng thêm FK `actor_id → auth.users ON DELETE SET NULL`** vào bảng chỉ ghi thêm: SET NULL là một UPDATE ⇒ guard chặn ⇒ không xoá được tài khoản.
- **Sổ tiền đặt trước ghi bằng trigger** trên `auction_bidding_contracts.deposit_status`. RPC mới chỉ cần UPDATE cờ (sau `_bidding_ctx(lý do, lô)`); INSERT tay vào sổ = ghi đôi.
- **Seed hồ sơ tham gia phải tự đặt `review_status='approved'` + `checked_in_at`** (từ 2026-10-08). Insert thẳng `status='paid'` KHÔNG qua trigger ghi sự kiện `submitted` ⇒ tự ghi `auction_contract_review_events`. Chạy lại migration seed cũ (PDG000012/13/14) bằng `psql -f` ⇒ phải kèm `scripts/demo-bidding-backfill.sql` **trong cùng giao dịch** (`psql -1 -f seed -f backfill`): phiên đã qua giờ bắt đầu bị cron `close_due_rosters` chốt trong 1 phút ⇒ hồ sơ có số mà chưa điểm danh bị đánh VẮNG + tịch thu cọc. Gỡ hồ sơ: xoá `auction_contract_review_events` trước (chỉ ghi thêm + FK RESTRICT, tắt trigger `auction_contract_review_events_append_only`).
- **GUC `app.bidding_rpc` sống tới hết transaction.** RPC đã bật phải `_bidding_ctx_clear()` trước khi trả về, nếu không lệnh sau trong cùng transaction (script kiểm chứng, migration) lách được guard mà không biết. Supabase cũng tự GRANT EXECUTE hàm mới ⇒ `_bidding_ctx*` phải REVOKE (khối kiểm chứng cuối migration đã assert).

## `auction_lot_states.payment_status` có HAI người ghi

`org_confirm_winner_payment` (nút "Đã thanh toán" của Bước 6) và sổ tiền hợp đồng
mua bán (`_sale_settle`) ghi **cùng một cột**. Luật:

- Lô **đã có hợp đồng còn sống** ⇒ sổ tiền là sự thật. `WinnerPaymentCard` giấu
  nút "Đã thanh toán", **và** `org_confirm_winner_payment` trả `sale_contract_exists`.
  Giấu nút không phải là bảo vệ — cổng thật nằm ở RPC (`20260914000001` mục 8b).
- Tổ chức **không dùng hợp đồng** vẫn bấm nút cũ như trước.
- `_sale_settle` chỉ đụng vào lô đang `pending`/`paid`, **không bao giờ** lật một
  lô đã `defaulted` — người trúng bỏ cọc là quyết định khác, không phải hệ quả
  của một bút toán thu tiền.

## Hai chuỗi bên bán, một bảng hợp đồng

`auction_session_items` **cố ý không có** cột chủ sở hữu. Lô ký gửi truy ra chủ
tài sản qua `service_request_id → consignment_contracts.owner_user_id`; lô tin
đăng chỉ có `listings.asset_owner_id → asset_owners`, một thực thể danh bạ
**không có tài khoản, không có CCCD, không có điện thoại**.

Hệ quả hay quên:
- `seller_unresolved` là nhánh THẬT, không phải phòng xa: hợp đồng ký gửi bị huỷ
  sau khi lô đã vào phiên (không có gì kiểm lại), hoặc `listings.asset_owner_id`
  NULL (~20% tin đăng trong DB hiện tại).
- Với lô `org_on_behalf`, `sale_can_act(contract,'seller')` đúng cho **thành viên
  tổ chức**; với lô `owner_user` thì tổ chức **không** ký thay được (RPC trả
  `not_found`). Đừng giả định tổ chức luôn thao tác được cả hai vai.
- Dự thảo PDF cho bên bán danh bạ chỉ in tên + địa chỉ, **không bịa CCCD**.

## Sổ tiền hợp đồng mua bán: hoàn là DÒNG MỚI

`auction_sale_payments` mang `auction_append_only_guard` ⇒ **mọi** UPDATE/DELETE
bị chặn, kể cả từ migration và seed (phải `DISABLE TRIGGER`). Vì thế:
- `installment_id` là `ON DELETE RESTRICT`, **không phải** `SET NULL` — `SET NULL`
  là một UPDATE và sẽ bị guard chặn khi `set_terms` xoá kỳ hạn. Đó là lý do
  `set_terms` từ chối bằng `payments_exist` khi sổ đã có tiền.
- `recorded_by` **không có FK** tới `auth.users`: `ON DELETE SET NULL` cũng là
  UPDATE (cùng bài học với `auction_lot_events.actor_id`).
- Hoàn bút toán = INSERT một dòng có `reversed_payment_id`; `sale_net_paid` cộng
  dòng đó với **dấu trừ**. Đừng đi tìm cột `amount` âm — CHECK ép `amount > 0`.

## `AFTER UPDATE OF <cột>` KHÔNG bắn khi cột bị đổi trong BEFORE trigger

`UPDATE OF col` xét danh sách `SET` của CÂU LỆNH, không xét giá trị cuối. `guard_asset_posting_review` tự đổi `review_status` approved→pending khi chủ tài sản sửa hồ sơ mà không SET cột đó ⇒ trigger `AFTER UPDATE OF review_status` im lặng và model 3D vẫn công khai. Dùng `AFTER UPDATE ... WHEN (OLD.col IS DISTINCT FROM NEW.col)` (xem `asset_postings_3d_sync_publish`, `20260915000001`).

## Hàm chỉ dành cho webhook phải REVOKE khỏi `authenticated`

Supabase mặc định cấp EXECUTE hàm mới trong `public` cho `anon` + `authenticated`, và PostgREST phơi mọi hàm gọi được. `attach_asset_3d_model` mà quên `REVOKE ALL … FROM PUBLIC, anon, authenticated` ⇒ chủ tài sản tự gắn model bất kỳ vào hồ sơ, bỏ qua đối tác và chữ ký HMAC. Sau migration, kiểm bằng `has_function_privilege('authenticated', '<fn>(…)', 'execute')`.

## Dịch vụ `commission` vô hình với người dùng thường
`services_public_read` loại `kind='commission'` ⇒ `useServiceCatalog` / `services!inner` trả RỖNG cho mọi dịch vụ thu hộ (hồ sơ tham gia, VR tour). Màn cho người bán/người mua phải đọc gói qua RPC riêng (`public_vr_tour_packages`) hoặc snapshot trên bản ghi. Và ĐỪNG chép `commission_type/value` lên bảng mà khách đọc được (vd. `asset_vr_tour_orders`) — RLS lọc dòng, không che cột; điều khoản chỉ nằm ở `orders` (admin-only).

## Test SQL giả danh user: `request.jwt.claims` sống qua `RESET ROLE`
`set_config('request.jwt.claims', …, true)` là theo GIAO DỊCH, không theo role. Chạy `UPDATE asset_postings` "với tư cách postgres" sau khi đã giả danh chủ tài sản ⇒ review guard vẫn thấy `auth.uid()` = chủ (không có quyền approve) và NUỐT thay đổi — trông như trigger công khai hỏng. Đặt lại claims sang admin trước mỗi lần ghi quản trị trong script nghiệm thu.

## Radix `Select` gọi `onValueChange("")` khi danh sách lựa chọn đổi
Select được điều khiển (RHF `Controller`) mà các `SelectItem` đổi theo trường khác, ví dụ "Kỳ cụ thể" đổi theo Tháng/Quý/Năm, thì Radix bắn `onValueChange("")` ngay sau khi setValue giá trị mới. Hậu quả: trường bị xoá trắng, form không tìm ra bản ghi đã có, hiện placeholder "Chọn kỳ". Truyền `onValueChange={(v) => v && field.onChange(v)}` (xem `targets/TargetDialog.tsx`). Test jsdom bắt được lỗi này.

## Link VR/3D chặn nhúng iframe (claude.ai, …)
Trang gửi `X-Frame-Options: SAMEORIGIN` / `frame-ancestors` ⇒ iframe chỉ hiện "từ chối kết nối", không có lỗi console bên mình. Kiểm `curl -sI <url>` trước khi giao link; host đã biết chặn liệt ở `lib/vrTour/embed.ts` để `VrTourViewer` hiện thẻ mở tab mới.

## Hotlink ảnh Wikimedia trả 429
`upload.wikimedia.org` (nhất là thumbnail cỡ lớn chưa cache) giới hạn tốc độ và chặn client "robot". Seed/ảnh công khai phải CHÉP về Storage (`asset-media`), không hotlink — xem `scripts/seed-craft-villages.py` (`fetch` có backoff).

## Hàm danh mục dùng chung bị 2 migration song song ghi đè nhau
`owner_ws_permission_catalog()` / `owner_ws_default_role_permissions()` là MỘT hàm `CREATE OR REPLACE`: hai phiên cùng thêm quyền từ bản cũ ⇒ bản áp sau làm rơi quyền của bản kia (01/10: M1 làm mất `so-hoa:share`, vá bằng `20261001230000`). Self-check đếm số dòng của chính migration vẫn qua. Trước khi thay hàm dùng chung: đọc bản ĐANG CHẠY (`pg_get_functiondef`) ngay lúc áp, và self-check "không còn dòng quyền ngoài danh mục". Cùng bẫy với file mới: kiểm file chưa tồn tại trước khi Write (phiên khác có thể vừa tạo — `src/lib/brand.ts`).

