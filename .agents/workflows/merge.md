---
description: Hướng dẫn branch / PR / merge cho taisandaugia (Supabase thật, migrations, RLS, deploy Vercel).
---

# Quy trình Merge

taisandaugia là **sản phẩm thật** nối **Supabase** (Postgres có RLS + migrations, project
`bcusbpkfnydqcvxxjvew`) và deploy trên **Vercel**. Vì có database thật, merge KHÔNG chỉ là gộp code — phải
đảm bảo **migration đã áp lên remote** và **types đã regenerate** trước khi code phụ thuộc chúng vào `main`.

> **Chính sách branch & PR.** KHÔNG BAO GIỜ push/commit thẳng vào `main` (hook `guard-main-push.sh` chặn).
> Contributor và agent làm trên feature branch rồi mở PR:
> `git checkout -b <type>/<mô-tả>` → `git push -u origin <branch>` → `gh pr create --base main --fill`.
> **Chỉ chủ repo (@harleyng) merge vào `main`** bằng **squash** — đừng tự merge PR của mình trừ khi bạn là
> owner. Một commit mỗi feature, message tiếng Việt `type(scope): mô tả`.

---

## Checklist trước merge

Chạy từ feature branch, trước khi mở hoặc hoàn tất PR — **cả 6 phải xanh:**

1. **Rebase lên `main`** — `git fetch origin && git rebase origin/main`. Giải quyết conflict (xem dưới).
2. **Lint xanh** — `npm run lint`.
3. **Build xanh** — `npm run build`.
4. **Migration đã push** — nếu branch thêm/sửa `supabase/migrations/**`:
   `npx supabase db push` (hoặc `--include-all` nếu lệch thứ tự) và `npx supabase migration list` cho thấy
   **đã áp lên remote**. Migration phải lên remote **trước** khi PR merge, nếu không app deploy trên Vercel
   sẽ chạy trên schema thiếu bảng/cột → vỡ.
5. **Types đã regenerate** — sau migration, chạy
   `npx supabase gen types typescript --project-id bcusbpkfnydqcvxxjvew > src/integrations/supabase/types.ts`
   và **commit** file này. Không sửa tay `types.ts`.
6. **Không lộ secret** — không commit `.env` hay service-role key. Chỉ `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_PUBLISHABLE_KEY` (anon, public-safe) / `VITE_SUPABASE_PROJECT_ID` được dùng; các biến này
   nằm ở env của Vercel, không trong repo. `git diff --stat` để soát; đảm bảo `.env*` trong `.gitignore`.
7. **Knowledge/CLAUDE.md cập nhật nếu luật đổi** — nếu branch đổi luật nghiệp vụ (credit tier/cost, luật
   KYC, quy ước RLS, org roles, pattern kiến trúc), cập nhật `CLAUDE.md` và file knowledge liên quan qua
   **`/log-decision`** trước khi merge.

---

## Giải quyết conflict

Conflict hay gặp ở **migrations**, **types.ts**, **routes/nav**, **credits.ts** — xử tay, đừng "take
theirs/mine":

| Vị trí conflict | Cách xử lý |
|-----------------|------------|
| `supabase/migrations/*.sql` | Giữ **cả hai** migration; timestamp phải **unique** (đổi tên file của branch mình nếu trùng/lệch để đứng sau); đừng bỏ migration của branch kia. Sau merge chạy lại `npx supabase db push --include-all`. |
| `src/integrations/supabase/types.ts` | **Đừng merge tay.** Sau khi cả hai migration đã áp lên remote, **regenerate lại từ đầu** bằng `npx supabase gen types` rồi commit. |
| `src/App.tsx` routes / `src/components/owner-portal/owner-nav-config.ts` | Giữ **cả hai** route/nav entry; kiểm tra không trùng path và redirect vẫn resolve. Nhớ thứ tự provider trong `App.tsx` (xem `CLAUDE.md`) — không reorder. |
| `src/lib/credits.ts` + `src/hooks/useCredits.tsx` | Union các tier/cost/loại unlock; giữ ledger `credit_transactions` append-only; không nhân đôi hằng số. Đối chiếu với bảng credit trong `CLAUDE.md`. |

Sau khi giải quyết, **chạy lại toàn bộ checklist trước merge** (conflict có thể làm vỡ lint/build/types).

---

## Kiểm tra an toàn RLS & unlock trước merge

Vì là dữ liệu per-user thật, một policy RLS sai làm lộ credit/unlock chéo user. Trước khi merge thay đổi
bảng/RLS/credit, xác nhận:

- Mọi bảng credit/unlock giữ đúng policy `"own rows"` (`USING (auth.uid() = user_id)`); không có `SELECT`
  mở cho `anon`/`authenticated` trên dữ liệu per-user.
- Mutation vẫn `invalidate` đúng query key (`["user-credits", userId]`, …) — nếu không UI hiện state cũ.
- `unlockAsset` vẫn ghi `user_asset_unlocks` (vĩnh viễn); `unlockCompany`/`unlockOwner` vẫn cộng dồn từ
  expiry cũ; report-period key vẫn dạng `"{slug}:{periodId}"`.

---

## Merge & sau merge

1. **Owner squash-merge** PR vào `main` (một commit mỗi feature; message `type(scope): mô tả` tiếng Việt).
   Contributor xin review, không tự merge.
2. **Xoá branch** sau merge.
3. **Smoke test sau merge** — pull `main`, `npm run dev` (localhost:8080), click qua các luồng đã đụng:
   listings / paywall unlock / KYC onboarding / asset-posting wizard / report dashboard tuỳ mức liên quan.
4. **Xác nhận deploy Vercel** — sau khi Vercel build xong, kiểm tra app production chạy đúng schema mới:
   `npx supabase migration list` cho thấy migration đã ở remote, và luồng phụ thuộc bảng mới hoạt động
   (đăng nhập bằng user thật, thử một unlock, xác nhận credit trừ đúng và RLS không rò dữ liệu chéo user).

Giữ đúng bản chất sản phẩm-thật-có-database: migration lên remote **trước** code, types regenerate không sửa
tay, không commit secret, và các màn/luồng đã đụng chạy được trên production.
