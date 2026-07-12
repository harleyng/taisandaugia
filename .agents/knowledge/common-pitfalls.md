# Common Pitfalls — Tài Sản Đấu Giá (taisandaugia)

> Living document. Things that have gone wrong or are easy to get wrong. **Newest first**, dated. Add an entry whenever a non-obvious bug bites. This is a current-truth doc — when the code moves, update the entry (don't leave a stale warning).

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
`organizations.kyc_status` moves `PENDING_KYC → APPROVED | REJECTED` (admin review). Don't coin intermediate statuses. Org roles are exactly three — Owner / Manager / Agent — seeded and referenced by the `create_owner_membership` trigger; don't hardcode role-string comparisons where a permission check belongs. Phone requires OTP verification; CCCD is 9–12 digits, passport ≥ 6 chars — enforce via the Zod schema, not ad-hoc checks.

### Never import a "versioned" Supabase client
There is exactly one client: `import { supabase } from "@/integrations/supabase/client"`. This project has **no** versioned/alternate client (unlike some sibling repos). Any other import path is wrong.
