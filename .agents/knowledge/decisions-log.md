# Decisions Log — Tài Sản Đấu Giá (taisandaugia)

> **History file — grep, don't auto-read.** Reverse-chronological (newest first). This is the audit trail of *why*; the canonical *what* lives in the current-truth files (`architecture.md` / `business-rules.md` / `design-system.md` / `component-registry.md` / `common-pitfalls.md`). **Rule: this log records only WHY.** When a decision establishes or changes a rule, update the rule file too — if a rule lives only here, agents won't find it and it is effectively lost. Use `/log-decision`.
> Format per entry: `## YYYY-MM-DD — Short title`, then **Context** (the problem / why now), **Decision** (what we chose), **Consequences** (follow-ups, obligations, what it makes true).

---

## 2026-07-12 — "Danh sách cụ thể": gửi được email NGOÀI hệ thống + badge "Chưa có tài khoản"

**Context:** `resolve_campaign_audience` giải đối tượng hoàn toàn `FROM profiles` → email import không khớp tài khoản nào bị âm thầm loại bỏ (không vào số "sẽ nhận", không snapshot lúc gửi) dù admin vẫn thêm vào danh sách được. Yêu cầu: cho phép gửi tới người ngoài hệ thống + đánh dấu họ.
**Decision:**
- **RPC thêm nhánh email ngoài hệ thống** (`20260712000007_campaign_audience_external_emails.sql`, `CREATE OR REPLACE`): mọi email trong `spec.emails` KHÔNG khớp `profiles` (anti-join `lower(p.email)`) trả về `user_id=NULL` và **LUÔN được gửi** — `respect_optin` chỉ áp cho tài khoản có sẵn (email ngoài HT không có `notifications_enabled`). `count_campaign_audience` + snapshot (`campaign_recipients.user_id` nullable) thừa hưởng.
- **UI badge "Chưa có tài khoản"**: hook `useEmailAccountStatus` (mirror `useUserLabels`) tra `spec.emails` trong `profiles` (lowercase, kiểu `fetchOptOut`); `SelectedRecipientsTable` gắn badge hàng `noAccount`.
**Consequences:**
- Áp bằng `psql "$SUPABASE_DB_URI"` (ở `.env.local`) + `supabase migration repair --status applied 20260712000007` — KHÔNG `db push --include-all` để tránh áp nhầm migration đang dở song song (`20260712000008_profile_terms_consent`).
- `ResolvedAudienceRow.user_id` nay `string|null`. `types.ts` KHÔNG regen (feature consent sẽ tự regen); hook mới chỉ select `profiles.email` (type đã có).

## 2026-07-12 — Module Quảng cáo (Banner) + Khách hàng dùng chung

**Context:** Cần cụm admin "Marketing" gộp Email Marketing + Quảng cáo; xây quản lý banner (tạo/list/chi tiết) tham khảo Email Marketing + ảnh Kiot.pro, có master data vị trí/giá, chặn vị trí unique, và 1 module Khách hàng nằm ngoài Marketing (dùng chung nhiều dịch vụ).
**Decision:**
- 5 bảng (`20260712000002_advertising.sql`, admin-only RLS): `ad_pages`→`ad_positions` (master data 2 cấp, `placement_type` slide/unique + `price NUMERIC(12,0)`), `advertisements` (banner; `code` "B0000009" qua trigger + `ad_code_seq`; lifecycle `draft/scheduled/active/paused/ended`, chỉ draft+scheduled sửa được), `ad_daily_stats` (seed demo 30 ngày×2 device cho biểu đồ ComposedChart), `customers` (generic, `code` "KH…").
- **Chốt cứng unique**: trigger `enforce_unique_ad_position` dùng `tstzrange(start,end) &&` — chặn 2 banner scheduled/active trùng thời gian ở cùng vị trí unique; slide không chặn. UI cũng cảnh báo + toast `isUniquePositionError`.
- Bucket `ad-banners` (public read, admin write, 10MB). `AdminLayout` refactor sang NAV có `children` + Collapsible (port từ PortalSidebar): cha "Marketing"→[Email, Quảng cáo], thêm item "Khách hàng". Routes `/admin/marketing/quang-cao/*` (+`/vi-tri` master data) và `/admin/khach-hang/*`.
- **Bỏ** phần audience/đối tượng so với bản tham khảo. Form banner dùng controlled `AdFormState` (không RHF).
**Consequences:**
- ✅ `npx supabase db push` OK (3 migration local==remote) + **regenerate `types.ts` thành công** — nay chứa cả advertising lẫn marketing_campaigns; hook mới dùng `(supabase as any)` theo convention (không còn bắt buộc nhưng giữ nhất quán).
- Render banner ra site công khai + tracking view/click thật = việc SAU (hiện admin-only, stats là seed demo). `numeric` có thể về string → `formatVnd` coerce `Number()`.

## 2026-07-12 — Audience preview = số THỰC NHẬN, gate/lỗi tường minh + seed opt-in

**Context:** Block "Người nhận đủ điều kiện" khi tạo/sửa chiến dịch email hiện `count ?? 0` vô điều kiện (không gate, không đọc `isError`) → chưa cấu hình vẫn ra "0", lỗi RPC nuốt thành "0", mỗi loại một kiểu; loại "Theo tiêu chí" **không bao giờ nhảy số** vì DB có 0 user opt-in (`notifications_enabled` mặc định `false`) và preview lọc `respect_optin=true`.
**Decision:**
- **1 nguồn sự thật** `audiencePreviewHeadline(spec,{count,isFetching,isError})` trong `src/lib/marketing/audienceCriteria.ts` → 4 trạng thái: `empty` ("Chưa cấu hình đối tượng", gate theo `hasAnyAudience`), `loading`, `error` ("Không tính được số người nhận" — KHÔNG hiện 0 giả), `ready` ("{n} người sẽ nhận email"; loại `list` kèm caption "trong N đã chọn"). Dùng chung ở `CampaignReviewPanel` (nay nhận `spec`+`isError`) và `AudienceSummary`; header loại `list` trong `AudienceSection` cũng surface `isError`.
- **Số hiển thị = số THỰC NHẬN** (deliverable, `respect_optin=true`) đúng như số gửi; **gửi vẫn giữ opt-in** (không đổi luồng gửi).
- **Seed opt-in** `20260712000001_seed_optin_sample.sql`: bật `notifications_enabled=true` cho ~1/3 profiles (md5-order, idempotent) để số > 0 và thấy rõ lọc opt-in; **default cột giữ `false`** (opt-in thật cho user mới).
**Consequences:**
- ✅ Gỡ 2 nợ ops từ 2026-07-11: **4 migration marketing đã push** (local==remote), và **project thật = `dvdpfjprncvkhfwcvqmp`** (khớp `config.toml`, CLI linked) — CLAUDE.md ghi `bcusbpkfnydqcvxxjvew` là cũ/sai.
- `types.ts` chưa regen (cần personal access token) → `useCampaigns.ts` vẫn dùng `(supabase as any)`; không đổi schema nên không chặn.
- Seed chỉ là dữ liệu mẫu; sản xuất thật vẫn phụ thuộc user tự bật opt-in.

## 2026-07-12 — "Danh sách cụ thể": chặn opt-out sớm + báo cáo import gộp theo dòng

**Context:** Luồng chọn "Danh sách cụ thể" (tạo/sửa chiến dịch email) để admin thêm được cả người opt-out rồi mới bị lọc âm thầm lúc gửi; import chỉ báo "N email hợp lệ", không cho biết dòng nào bị bỏ. Import bản redesign từ Claude Design (`email-audience/Danh sách cụ thể.html`).
**Decision:**
- **Chặn opt-out NGAY khi thêm/import** (không đợi lúc gửi): opt-out = `profiles.notifications_enabled !== true`, **nhất quán** với bộ lọc của `resolve_campaign_audience` (chỉ gửi khi `= true`). Tab "Tìm & chọn" disable user opt-out ("Chưa cho phép nhận email / Không thể thêm"); import tra `profiles` theo lô 200 để tách nhóm opt-out.
- **Báo cáo import gộp theo dòng**: `src/lib/marketing/importClassify.ts` (thuần) parse giữ số dòng → phân loại sai định dạng / trùng (vs danh sách hiện có + trùng trong file) / chưa cho phép / hợp lệ; `collectIssues` gộp 1 danh sách + `downloadIssueRows` tải `.xlsx`. UI: `audience/ImportReport.tsx`.
- **Bỏ tiêu đề lặp**: header section chỉ còn `{N} người nhận` + nút (bỏ "Người nhận" trùng "Đã chọn N…"); `SelectedRecipientsTable` bỏ tiêu đề đếm, "Xoá tất cả" dời vào hàng lọc (chỉ hiện khi > 10 dòng), nhãn phân trang `start–end / total`.
**Consequences:**
- `notifications_enabled` mặc định `false` NOT NULL → nhiều user hiện "Không thể thêm"; đây là hành vi ĐÚNG (khớp ai thực sự nhận được), không phải lỗi.
- `AddRecipientsDialog` nay cần prop `existingEmails` (lowercase) để bắt trùng; đọc `profiles` thêm cột `notifications_enabled` (đã có trong `types.ts`).

## 2026-07-11 — Email Marketing admin feature (cụm Marketing) + admin-only RLS + RPC audience resolution

**Context:** New admin "Marketing" cluster starting with Email Marketing (list / create-wizard / tabbed-detail). Audience targeting must segment users by criteria (registration date, account type, KYC, credit balance, tỉnh/thành) — but several of those live behind `own rows` RLS (`user_credits`) or across many tables, and admins need cross-user reads.
**Decision:**
- New back-office tables `marketing_campaigns` + `campaign_recipients` (`supabase/migrations/20260711000001_marketing_campaigns.sql`) use RLS **`admin_all` via `has_role(auth.uid(),'ADMIN')`** — a **deliberate deviation** from the default `own rows` convention because this is admin data, not user-owned.
- Audience resolved by **SECURITY DEFINER** RPC `resolve_campaign_audience(_spec jsonb,_respect_optin)` + `count_campaign_audience` (admin-guarded: `RAISE` unless `has_role ADMIN`), joining profiles/user_credits/organizations/memberships/asset_owner_kyc/asset_owner_org_kyc/user_roles/auction_organizations to derive account_type/credit/province **without widening those tables' RLS**. `account_type='buyer'` = NOT(admin OR company_rep OR owner_*); province best-effort via `organizations.license_info->>'auction_org_id'` → `auction_organizations.province`.
- `audience_spec` jsonb = 3 mode-gated sources (criteria/import/specific) **unioned**; every branch in the RPC MUST be gated on its `modes` flag (review caught ungated userIds/emails branches sending to toggled-off recipients).
- Marketing sends **always respect opt-in** (`profiles.notifications_enabled`) — `_respect_optin` hardwired `true`.
- **Send is STUBBED**: `useSendCampaign` resolves audience → snapshots `campaign_recipients` → transitions status; no email provider. Future `supabase/functions/send-campaign` consumes the snapshot at that seam.
- Nav = one flat entry in `AdminLayout` `NAV` (`/admin/marketing/email`); 4 routes under the `/admin` group in `App.tsx`.
**Consequences:**
- **Ops obligation:** run `npx supabase db push` then regenerate `types.ts` — migration is NOT pushed (CLI unauthenticated here); until then `useCampaigns.ts` uses `(supabase as any)` casts (per `useArticles.ts`).
- **Discrepancy to resolve:** `supabase/config.toml` `project_id=dvdpfjprncvkhfwcvqmp` ≠ CLAUDE.md `bcusbpkfnydqcvxxjvew` — confirm the live project before pushing.
- Real delivery + open/click tracking (recipient status pending→sent/opened/clicked, `sent_count` etc.) is the phase-2 follow-up. Reflected in `architecture.md`.

## 2026-07-05 — Decouple Lovable, migrate to native Supabase Google OAuth + Vercel

**Context:** The app originated on the Lovable AI platform and shipped with Lovable-specific auth and build shims — `@lovable.dev/cloud-auth-js` wrapping sign-in and the `lovable-tagger` Vite plugin. Now deployed on **Vercel** with a standalone Supabase project (`bcusbpkfnydqcvxxjvew`), that coupling was dead weight and a lock-in risk, and the wrapped auth blocked using Supabase's own OAuth.
**Decision:**
- Removed `@lovable.dev/cloud-auth-js` and `lovable-tagger` from `package.json` and `vite.config.ts`.
- `AuthDialog` now calls **`supabase.auth.signInWithOAuth({ provider: 'google' })`** directly via the typed client (`src/integrations/supabase/client.ts`); the multi-step identifier→OTP/password flow stays, Google is added as a first-class provider. Auth remains globally driven by `AuthDialogContext` + `AuthProvider` (single auth source — do not add parallel `getSession`/subscriptions).
- Hosting/build is now plain Vite → Vercel; no Lovable-injected tags in the bundle.
**Consequences:**
- **Ops obligation:** enable the **Google provider** in Supabase Auth (client ID/secret) and **whitelist the Vercel domains** (production + preview URLs) in Supabase Auth → URL Configuration (Site URL + Redirect URLs), or OAuth redirects 400. Google Cloud OAuth consent screen must list the same redirect URIs.
- Preview deploys use ephemeral Vercel URLs — either add a wildcard/known preview domain to the allow-list or accept that OAuth only works on whitelisted hosts.
- Reflected in `architecture.md` (auth stack, providers, deploy target). Mock files under `src/lib/mock*.ts` remain legacy scaffolding, unaffected.

## 2026-07-05 — Adopt the 4-layer `.claude` + `.agents` management system (ported from vsf-tm)

**Context:** Solo/agent-driven work on a real production app needed a repeatable operating model — expert personas, a knowledge base that separates current-truth from history, project slash-skills, and safety hooks — instead of ad-hoc prompting. The sibling `vsf-tm` project already had a proven version; port it, adapting from vsf-tm's mock-store/no-database prototype assumptions to taisandaugia's **real Supabase + RLS + React Query** reality.
**Decision:** Installed the four layers with canonical slugs (so cross-references resolve):
1. **Personas** at `.agents/skills/<slug>/SKILL.md`: `orchestrator`, `cpo`, `cto`, `system-architect`, `qa-qc`, `ui-ux-designer`, `data-analyst`, `kyc-expert`, `credits-paywall-expert`.
2. **Thin subagent wrappers** at `.claude/agents/<name>.md` (8, no orchestrator): `cpo`, `cto`, `system-architect`, `qa` (→`qa-qc`), `ui-ux` (→`ui-ux-designer`), `data-analyst`, `kyc-expert`, `credits-paywall-expert`.
3. **Project slash-skills** at `.claude/skills/<slug>/SKILL.md`: `new-page`, `migration`, `add-query`, `log-decision`, `add-unlock`.
4. **Knowledge base** at `.agents/knowledge/`: current-truth files (`architecture.md`, `business-rules.md`, `design-system.md`, `component-registry.md`, `common-pitfalls.md`) + this grep-only `decisions-log.md`, with the auto-read map in `README.md`.
- **Domain swap from vsf-tm:** HR/L&D/IDP/Excel-export content dropped. `hr-expert`→**`kyc-expert`** (3-milestone KYC, `kyc_status` PENDING_KYC→APPROVED|REJECTED, org roles Owner/Manager/Agent, RLS "own rows", CCCD/passport/phone-OTP). `ld-expert`→**`credits-paywall-expert`** (append-only `credit_transactions` ledger, `unlockAsset` permanent vs `unlockCompany`/`unlockOwner` time-limited & stacking, `unlockDeepReportPeriod` `{slug}:{periodId}` + `expandUnlock`, `PaywallContext`, `useCredits` single access point). Reports are **Recharts dashboards**, not Excel.
- Safety hooks at `.claude/hooks/`: `inject-workflow-context.sh`, `guard-main-push.sh` (advisory `ask` on push to `main`), `check-safety.sh`.
**Consequences:**
- `main` is protected **by policy**: only repo owner **@harleyng** pushes to `main`; agents branch + open a PR and don't self-merge. `guard-main-push.sh` is advisory (soft confirm), not a server-side block.
- Governance is authored assuming a real backend — reads respect RLS, writes go through the typed client and invalidate React Query keys (e.g. `["user-credits", userId]`); `system-architect` may propose schema/migrations/RLS.
- Knowledge stays discoverable only if the **current-truth ↔ history split** is honored: decisions logged here MUST be paired with an update to the canonical rule file.
