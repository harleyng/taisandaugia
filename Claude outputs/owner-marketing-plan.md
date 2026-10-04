# Asset-Owner Marketing ("Truyền thông") — Plan

> Version 0.2 · 2026-10-01 · Status: **proposed — Phase M0 ("Hồ sơ online") approved as priority #1**
> Scope: `/chu-tai-san/*` (Trạm Điều Hành), banks / AMCs first.
> Two parts agreed with the product owner: **(1) "Giao việc cho sàn"** — the owner orders marketing work from the platform; **(2) "Tự truyền thông"** — the owner runs campaigns themselves from the portal, with a flow modelled on the admin Email Marketing flow.
> Strategic gate: the flow must be **demoable to a large bank** and prove value; if the bank is afraid of data exposure, the fallback is **white label inside the bank's own systems**. The design below keeps that door open from day one.
> Language convention: same as `owner-control-tower-plan.md` — this document is in English; text in "quotes" in Vietnamese is **UI copy**.
> How to use: every phase in **Part D** has a self-contained prompt. Paste it into Claude Code, or say `Execute Phase Mx of docs/owner-marketing-plan.md`.

---

# PART A — MARKET RESEARCH & VALUE HYPOTHESES (what the demo must prove)

## A1. What banks do today (desk research, Oct 2026)

| Observation | Evidence |
|---|---|
| Big banks list foreclosed / collateral assets on their **own websites**, usually a filtered catalogue with no audience targeting and no measurement. | Vietcombank "Phát mại tài sản" page: search + filters by property type, sale method, price, province. |
| Volume is large and continuous: hundreds of assets per bank at a time, high ticket sizes. | VietinBank: ~400 collateral assets to dispose of at once (NLĐ, 07/2023). Nov 2025: Agribank listed 20 HCMC properties ≈ 910 bn VND in starting prices; BIDV, VietinBank, VPBank each auctioning assets of tens to hundreds of bn VND (CafeF, 24/11/2025). |
| Many assets go to auction **repeatedly** with price cuts of 15–50%, some relisted 15+ times. Root causes cited: pricing, financing, asset type — and a thin pool of qualified buyers. | Tuổi Trẻ (11/2023), VietnamPlus, Tiền Phong, NLĐ (02/2026) on repeated "đại hạ giá". |
| Collateral disposal is now a material income line, so recovery speed matters to HQ. | Techcombank 9M/2025 gains from such activities doubled YoY to 1.39 tn VND (CafeF). |

**Implication.** Banks already *announce* assets. What they lack is (a) **reach to qualified buyers**, (b) **measurement** of which channel produced bidders, and (c) a **controlled, compliant** way for branch officers to promote without legal risk. Pitch the product as **"more qualified bidders per session, measured"**, not as "another place to post assets".

## A2. Regulatory constraints that shape the design

| Topic | Rule (summary — confirm with counsel) | Design consequence |
|---|---|---|
| Personal data | **Law on Personal Data Protection No. 91/2025/QH15**, effective 01/01/2026: explicit, purpose-bound consent for marketing; opt-out must be as easy as opt-in; a written controller–processor contract is required when a vendor processes data for a bank; fines up to 5% of prior-year revenue for some violations, up to 3 bn VND for others; criminal liability for trading personal data. | The platform must **never receive bank customer lists by default**. Platform-audience sends go only to users who opted in **on the platform** (`notifications_enabled`). Uploading the bank's own lists is a **separate, later, legally reviewed** option (decision D3). |
| Bank IT outsourcing | **Circular 09/2020/TT-NHNN**: banks outsourcing IT that touches customer information must risk-assess the vendor and report to the SBV IT department; vendors need adequate infrastructure and recognised security certifications. Data localisation under the Cybersecurity Law also applies. | Any mode where the bank *sends us customer data* triggers a long vendor review. A mode where **only asset data leaves the bank** (already public after the auction notice) avoids most of it → **"Export mode"** is the default for banks. |
| Banking secrecy | Borrower identity and loan details are confidential. | Templates never contain borrower name or loan data — only facts that appear in the official auction notice. |
| Auction law | The auction organisation is responsible for the official public notice. | Marketing content **reads facts from the session** (starting price, deposit, deadlines, organisation). The owner can edit only the descriptive copy — same `fact` / `draft` split as the session outreach pack (`src/lib/outreach/`). Sending is only allowed while the session is announced and registration is open (`outreach_send_window_open`). |
| Hosting | Supabase cloud has no Vietnam region (nearest: Singapore). | Expect the question "Dữ liệu lưu ở đâu?" in the first bank meeting. Answer prepared in A5; white-label path = **self-hosted Supabase** (open source) on bank infrastructure or a VN cloud. |

## A3. Value hypotheses to validate with the bank

Validate with 3–5 interviews at the target bank before/after the demo: one branch debt-recovery officer, the HQ head of debt resolution ("xử lý nợ"), someone from marketing/communications, and someone from IT security/compliance.

| # | Hypothesis | Signal that it's true | Kill signal |
|---|---|---|---|
| H1 | Too few qualified bidders is a top-3 reason sessions fail. | Officers can name assets that failed for "không ai đăng ký" / "chỉ 1 người". | Failures are almost all about price approval or legal issues. |
| H2 | Nobody can tell which channel brought the bidders today. | "Không biết khách từ đâu tới" — no channel data in their reports. | They already track source per bidder. |
| H3 | Branch officers lack time / skills / legal comfort to produce promotion content. | Content today = copy of the official notice; marketing must go through HQ. | Branches have a marketing budget and an agency already. |
| H4 | HQ wants promotion effort visible next to recovery results. | Interest in the "Hiệu quả truyền thông" section of the periodic report. | HQ only cares about the final recovered amount. |
| H5 | The bank will not share customer data with a vendor, but will send our content through its own channels (app, SMS brandname, Zalo OA, relationship managers). | "Mình gửi được, nhưng không đưa danh sách ra ngoài." | They will not send anything about NPL assets to their customers at all. |
| H6 | The bank will pay for platform-run promotion per asset or per package. | They ask about price or ask for a pilot on 5–10 stuck assets. | "Đã có tổ chức đấu giá lo rồi." |

**Demo success criterion.** At the end of the meeting the bank agrees to a **pilot on 5–10 stuck assets** (≥ 2 failed rounds), with a baseline (participants per session, rounds to sell) and a 60-day comparison. Their choice between **SaaS + Export mode** and **white label** is a valid outcome either way.

## A4. Demo script (15 minutes, seeded workspace)

Workspace "Ngân hàng Demo — Chi nhánh Quận 7" with 6 assets, one of which has failed 2 rounds. All seeded numbers are labelled "Dữ liệu minh hoạ".

1. **"Tổng quan"** — a to-do card: "Nhà đất Q.7 — 2 phiên không thành. Đẩy truyền thông?" → opens the campaign wizard.
2. **Composer** — facts (starting price, deposit, deadline, organisation) auto-filled and locked with a "Lấy từ thông báo đấu giá" badge; the officer edits only the description. Channel previews: Email · Zalo · Facebook · SMS (no diacritics, ≤ 160 chars).
3. **Audience** — "1.240 người mua phù hợp · đã đồng ý nhận tin" (category + province + price band + demand subscribers). **No names shown** — explain why.
4. **Maker–checker** — the officer submits; the branch head approves ("Duyệt") on a second account. Audit trail visible. (Banks expect four-eyes control.)
5. **Export for the bank's own channels** — copy Zalo/SMS text, each with its own tracking link `/l/abc123`; download the media kit. Say explicitly: "Danh sách khách của ngân hàng không rời khỏi ngân hàng."
6. **"Giao việc cho sàn"** — order the "Gói trọn chiến dịch" package for the same asset; show the quote → pay with credits / subscription quota → status timeline.
7. **Results** — funnel per asset and per channel: sent → opened → clicked → listing views → saves → registrations → participants. The bank's own channels show up too, through the tracking links.
8. **"Báo cáo định kỳ"** — new "Hiệu quả truyền thông" section, shared with HQ via `/r/:token`.
9. **"Dữ liệu đi đâu"** — a one-page data-flow view: what enters the platform, what never does, where it is stored, the white-label option.

## A5. Data fear → three deployment levels

| Level | What crosses to the platform | Fit | Build cost |
|---|---|---|---|
| **L0 · SaaS + Export mode** (default) | Only asset data (public after the notice) + anonymous click / visit counts from tracking links. No bank customer data. | Most banks, the pilot. | In this plan. |
| **L1 · SaaS + bank-uploaded lists** | Bank customer contact lists, processed under a controller–processor contract; auto-purged after the campaign. | Banks that accept a vendor review (Circular 09/2020). | Later, after legal review (D3). |
| **L2 · White label** | Nothing — runs inside the bank: self-hosted Supabase + this frontend, bank SSO (OIDC/SAML), the bank's own email/SMS gateway, the bank's branding. | Big banks with strict IT security. | Phase M7 plus a per-bank project. Stays cheap only if M1–M6 respect the **white-label guardrails** (B6). |

---

# PART B — DESIGN

## B1. Current state of the code (verified 2026-10-01)

| Area | Reality | Reuse |
|---|---|---|
| Admin Email Marketing | `marketing_campaigns`, `campaign_recipients`, RPCs `resolve_campaign_audience` / `count_campaign_audience`, admin-only RLS. UI: `src/pages/admin/marketing/*`, `src/components/admin/marketing/*`, hook `useCampaigns.ts`. Spec: `docs/email-marketing-spec.md`. **No real email provider** — sending is simulated in `useCampaigns.ts` (sets status `sent`). | The owner flow mirrors its screens: list → editor (4 sections + summary panel) → detail (Stats / Content / Distribution). |
| Banners / ads | `ad_pages`, `ad_positions` (with price), `advertisements`, `ad_daily_stats`; admin UI at `/admin/marketing/quang-cao`. | Fulfils the "Banner" package in "Giao việc cho sàn". |
| Session outreach pack (auction-org portal) | `session_outreach_packs/fields/edits/sends`, `src/lib/outreach/*` (`noticeTemplate`, `generateOutreach`, `sms`, `sendWindow.canMarkSent`, `printFlyer`), SQL `outreach_send_window_open`. Channel keys `listing / zalo / facebook / sms / flyer`. | The owner composer reuses the generator, the `fact` / `draft` split, SMS formatting and the send window. |
| Services / orders | `services`, `service_variants` (stable `variant_key`), `orders` (admin revenue). Order lifecycle pattern: `asset_authentication_orders` (requested → quoted → paid → … → completed). | "Giao việc cho sàn" catalogue + order lifecycle. |
| Owner billing | Owner subscriptions with quota (`_owner_sub_consume`) + credit fallback (`_charge_owner_feature_credits`); variants such as `scan_3d_owner`, `report_portfolio_owner`. | Payment for marketing packages. |
| Owner permissions | Matrix `src/lib/ownerWorkspace/permissions.ts` (`OwnerModule`, actions `view/create/update/delete/finalize/share`); SQL `owner_ws_has(ws, module, action)`, `owner_ws_has_in` (branch scope). | New module `truyen-thong`; `finalize` = approve, `share` = send / export. |
| Analytics | `analytics_events` (page_view / feature, anonymous `session_id`, `referrer`). | Visits arriving from tracking links. |
| Buyer intent | `user_demand_subscriptions`, saved assets, `notifications_enabled` opt-in. | Audience criteria for the platform audience. |
| Periodic report | `owner_build_report_payload`, snapshots, share link `/r/:token`. | New "Hiệu quả truyền thông" section. |

## B2. Principles

1. **The platform audience belongs to the platform.** An owner never sees who received a campaign — only counts and aggregates. Recipient snapshots are admin-only.
2. **Facts are read, never typed.** Price, deposit, deadlines and organisation come from the session/listing. Content stores a `facts_snapshot` + editable `drafts`.
3. **Send window.** Platform sends are only allowed while the session is announced and registration is open (reuse `outreach_send_window_open`). Tracking links and exports may be created at any time, but the redirect page shows the live status ("Đã hết hạn đăng ký") when the window is closed.
4. **Maker–checker.** A campaign moves `draft → pending_approval → approved` by a member holding `truyen-thong:finalize`. The approver ≠ the author, except when the workspace has a single member.
5. **Frequency cap protects buyers.** A buyer receives at most `OWNER_MKT_WEEKLY_CAP` (default 2) owner-originated emails per 7 days across all owners; excess recipients are skipped and counted as "Bỏ qua do giới hạn tần suất".
6. **Measure everything with one funnel** (B5), whichever channel is used.
7. **Append-only audit** for create / edit / approve / send / export.

## B3. Part 1 — "Giao việc cho sàn" (platform-managed)

**Catalogue** — new `services` category `marketing_owner`, variants with stable keys:

| `variant_key` | UI label | Fulfilled by | Price model |
|---|---|---|---|
| `mkt_featured_owner` | "Tin nổi bật 7 ngày" | Featured flag/slot on `/listings` + homepage | Fixed (credits / quota) |
| `mkt_email_owner` | "Email tới người mua phù hợp" | Admin email campaign (pre-filled from the order) | Fixed per send |
| `mkt_banner_owner` | "Banner trên sàn" | `advertisements` on a chosen position | Position price × period |
| `mkt_social_owner` | "Đăng trên kênh mạng xã hội của sàn" | Manual post + tracking link | Fixed per post |
| `mkt_full_owner` | "Gói trọn chiến dịch" | Platform plans and runs all channels | **Quote** |

**Order** `owner_mkt_orders`: `workspace_id`, `branch_id`, `listing_id` / `session_id`, `service_variant_id`, `brief` (goal, notes), `status` `requested → quoted → paid → in_progress → completed | cancelled`, `quoted_price`, `quote_expires_at`, `payment_method` (`credits | subscription | vnpay`), links to what fulfilled it (`marketing_campaign_id`, `advertisement_id`, `owner_mkt_campaign_id`), `result_summary JSONB`, `assignee` (admin). Fixed-price variants skip `quoted`.

**Admin side** — a new kind `truyen-thong` in the unified service-request queue `/admin/yeu-cau-dich-vu` (where the old per-service menus were merged), detail at `/admin/yeu-cau-dich-vu/truyen-thong/:id`: filter by status; "Tạo chiến dịch email từ đơn" opens `AdminCampaignEditor` pre-filled (content from the composer generator, audience from the asset criteria) and links back; "Tạo banner từ đơn" does the same for `AdminAdEditor`; "Hoàn tất" asks for a short result note. Completing creates an `orders` row for revenue (existing admin revenue pattern).

## B4. Part 2 — "Tự truyền thông" (self-serve)

Same three-screen structure as admin Email Marketing, scoped to the workspace.

**Campaign** `owner_mkt_campaigns`: `workspace_id`, `branch_id`, `name`, `listing_ids UUID[]` (1..n assets of the same workspace), `mode` (`platform_email | export`), `status` (`draft | pending_approval | approved | scheduled | sending | sent | ended | rejected`), `facts_snapshot JSONB`, `drafts JSONB` (per channel: email subject / preview / html, zalo, facebook, sms), `audience_spec JSONB` (criteria only — never user ids), `eligible_count`, `recipient_count`, `skipped_cap_count`, `sent/opened/clicked_count`, `schedule_type`, `scheduled_at`, `created_by`, `approved_by`, `approved_at`, `rejected_reason`, `sent_at`.

**Recipients** `owner_mkt_recipients`: snapshot at send time; **RLS: admin only**. Owners read aggregates through RPC `owner_mkt_campaign_stats(campaign_id)`.

**Audience criteria** (platform_email mode) — derived from the selected assets, editable within limits: asset category, province (+ neighbours), price band ±X%, demand subscribers matching category/province, users who saved similar assets in the last 90 days. RPC `owner_mkt_count_audience(workspace_id, spec)` returns counts only (eligible / blocked by opt-in / blocked by cap). Minimum audience size of 20 to avoid singling people out.

**Export mode** — no sending: the composer produces per-channel texts, each with its own tracking link, plus a downloadable media kit (photos, one-page PDF flyer via `printFlyer`). Status goes `approved → sent` when the officer clicks "Đánh dấu đã gửi" (records channel + time, like `MarkSentDialog`).

**Tracking links** `owner_mkt_links`: `code` (short, unique), `workspace_id`, `campaign_id NULL`, `listing_id`, `channel` (`email | zalo | facebook | sms | bank_app | press | other`), `label`, `created_by`. Public route `/l/:code` → logs a hit in `owner_mkt_link_hits` (`link_id`, `session_id`, `device`, `created_at`; no IP stored) → redirects to the listing with `utm_*`. The landing page sets a 30-day first-party attribution cookie so later saves/registrations carry `mkt_link_id`.

**Channel adapter** (white-label guardrail) — sending goes through a `MarketingChannelProvider` interface (`sendBatch(recipients, message) → statuses`). Today: `SimulatedEmailProvider` (same behaviour as admin). Later: a real ESP, or the bank's own gateway in white label.

## B5. Measurement funnel

`Gửi → Mở → Bấm → Xem tài sản → Lưu → Đăng ký tham gia → Người tham gia phiên → Kết quả (giá trúng / giá khởi điểm)`

- Sent / opened / clicked come from campaign counters. Link hits come from `owner_mkt_link_hits`. Views and saves come from `analytics_events` carrying `mkt_link_id` or `mkt_campaign_id`. Registrations come from on-platform session registration. Participants and outcome come from `owner_asset_outcomes_resolved`.
- Attribution = last touch within 30 days. Off-platform registrations are not attributable — say so in a tooltip.
- RPC `owner_mkt_funnel(workspace_id, period, listing_id NULL)` feeds the asset tab, the module dashboard and the periodic report.

## B6. White-label guardrails (apply in every phase)

1. All sending goes through the `MarketingChannelProvider` adapter — no provider SDK calls in components.
2. No hard-coded brand strings or domains in the marketing module: read the platform name, sender name and link domain from one config (`src/lib/brand.ts`, create it if missing).
3. Short links are built from a configurable base URL.
4. Business logic lives in SQL RPCs (portable to a self-hosted Supabase); no new dependency on Supabase-cloud-only features.
5. Personal data never leaves the database except into the provider adapter.

## B7. Information architecture & permissions

- New nav item **"Truyền thông"** (`Megaphone` icon) in group "Tác nghiệp", route `/chu-tai-san/truyen-thong` with tabs "Chiến dịch" · "Giao việc cho sàn" · "Link theo dõi" · "Hiệu quả".
- Asset detail gets a "Truyền thông" tab (links, campaigns, orders, funnel for that asset).
- "Tổng quan" to-do card for assets with ≥ 2 failed rounds or < 3 registrations 5 days before the deadline: "Đẩy truyền thông".
- New `OwnerModule` **`truyen-thong`** (category `tac-nghiep`) with actions `view / create / update / delete / finalize` (approve) / `share` (send, export, order from the platform). Seed it into existing roles: OWNER = all; STAFF = view/create/update; VIEWER = view.

## B8. Open decisions

| # | Decision | Blocks | Default if undecided |
|---|---|---|---|
| D1 | Do self-serve platform emails also need platform (admin) review before sending? | M3 | **Yes** for a workspace's first 3 campaigns, then automatic. |
| D2 | Price of each package / self-serve send (credits vs subscription quota vs quote). | M4, M3 | Self-serve send = subscription quota, else credits; `mkt_full_owner` = quote. Prices set in `/admin/dich-vu`. |
| D3 | Allow bank-uploaded customer lists (level L1)? | — (not in this plan) | **No** until legal review. |
| D4 | Allow promotion before the session is announced ("sắp đấu giá")? | M2 | No platform send; export and links allowed **without** price or deadlines. |
| D5 | Real email provider for production. | going live with M3 | Stay simulated for the demo. |
| D6 | Data residency answer for the pilot bank (stay on Supabase SG vs VN cloud vs white label). | pilot contract | Present the three levels in A5; decide with the bank. |

---

# PART C — DEPENDENCIES

| Phase | Depends on | Can run in parallel with |
|---|---|---|
| M1 Foundations + tracking links | — | — |
| M2 Composer + export + maker–checker | M1 | M4 |
| M3 Self-serve platform email | M2 | M4 |
| M4 "Giao việc cho sàn" | M1 | M2, M3 |
| M5 Funnel + report section | M3, M4 | — |
| M6 Demo pack | M5 | — |
| M7 White-label readiness | M5 (+ bank decision D6) | M6 |

Critical path to the bank demo: **M1 → M2 → M3 → M5 → M6** (M4 runs alongside). `types.ts` conflicts: regenerate after merging, never hand-merge (same rule as the control-tower plan, B3).

---

# PART D — PHASES & PROMPTS

## D0. General rules

Identical to section **C0 of `docs/owner-control-tower-plan.md`** (read CLAUDE.md + `.agents/knowledge/*`, migrations applied by you, A8 design language, Vietnamese UI, pages < 300 lines, no `<Button asChild><Link/>`, lint + build must pass, record decisions with `log-decision`, tick the phase checkbox). Additionally: respect **B2 principles** and **B6 white-label guardrails** in every phase.


### Phase M0 — "Hồ sơ online" for the bank's own customers (PRIORITY #1)
- [ ] Done
- **Why first:** banks will not share customer data, so the first deliverable is a rich, public, shareable web dossier of
  a digitised asset that bank officers send through their own channels. Core of the bank demo.
- **Prompt:** see Appendix — Phase M0 prompt (self-contained, paste into Claude Code).

### Phase M1 — Module, permissions, tracking links
- [ ] Done

```text
Execute Phase M1 of docs/owner-marketing-plan.md. Follow D0.

Goal: the "Truyền thông" module exists, with tracking links working end to end.

1. Permissions: add OwnerModule 'truyen-thong' (category tac-nghiep, actions view/create/update/delete/finalize/share,
   actionLabels finalize="Duyệt", share="Gửi / xuất") in src/lib/ownerWorkspace/permissions.ts and in the SQL catalogue
   (owner_ws_permission_catalog). Migration seeds it into existing roles per B7. Keep the matrix self-check style of
   20260927170100_owner_ws_rbac_enforce.sql.
2. Nav: item "Truyền thông" (Megaphone) in group "Tác nghiệp", module 'truyen-thong'; page /chu-tai-san/truyen-thong
   (skill new-page) with tabs "Chiến dịch" · "Giao việc cho sàn" · "Link theo dõi" · "Hiệu quả". Only "Link theo dõi" is
   functional in this phase; the others show EmptyState with "Sắp ra mắt".
3. Migration: owner_mkt_links + owner_mkt_link_hits per B4. RLS: read with owner_ws_can(ws,'read'), write with
   owner_ws_has(ws,'truyen-thong','create') and branch scope via owner_ws_has_in. Hits: insert ONLY via a SECURITY DEFINER
   RPC owner_mkt_track_hit(code, session_id, device) granted to anon; no direct insert policy; never store IP.
4. Public route /l/:code (outside ProtectedRoute, lazy): call the RPC, then redirect to /listings/:id with
   utm_source=<channel>&utm_campaign=<code>; store mkt_link_id in a 30-day first-party cookie (try/catch). Unknown code →
   polite page.
5. Short-link base URL and brand strings come from src/lib/brand.ts (create it) — guardrail B6.
6. "Link theo dõi" tab: create a link (asset, channel, label), copy, QR code (the `qrcode` package is already installed), hit count per link.

Acceptance: a staff member creates a Zalo link for an asset, opens it in an incognito window → lands on the listing,
hit count +1; a viewer cannot create links; a link from workspace A is invisible to workspace B.
```

### Phase M2 — Composer, export mode, maker–checker
- [ ] Done

```text
Execute Phase M2 of docs/owner-marketing-plan.md. Follow D0.

Goal: an officer prepares a campaign for 1..n assets, gets it approved, and exports per-channel content with tracking links.

1. Migration: owner_mkt_campaigns per B4 (mode 'export' only used in this phase; 'platform_email' is allowed by the CHECK
   but rejected by the RPCs until M3) + owner_mkt_audit (append-only, SELECT only for members; writes only inside RPCs).
   RPCs (SECURITY DEFINER, {ok:false, reason} for business errors): owner_mkt_save_draft, owner_mkt_submit,
   owner_mkt_approve / owner_mkt_reject (needs 'finalize'; approver ≠ author unless the workspace has 1 member),
   owner_mkt_mark_sent (needs 'share'; records channel + time). Each RPC writes an audit row in the same statement.
2. Composer (components/asset-owner-portal/marketing/): reuse src/lib/outreach generators. Facts snapshot read from
   listing/session, rendered locked with the badge "Lấy từ thông báo đấu giá"; drafts editable per channel
   (Email / Zalo / Facebook / SMS, SMS via outreach/sms.ts). Never include borrower identity. Per decision D4: before the
   session is announced, facts with price/deadlines are omitted and the UI says why.
3. Editor page mirrors the admin AdminCampaignEditor layout: section cards (Thông tin · Tài sản · Nội dung · Kênh) +
   sticky summary panel showing progress and approval state.
4. On approval in export mode: create one owner_mkt_links row per channel automatically; the export view shows each text
   with its link already inserted, "Sao chép", and "Tải bộ tư liệu" (photos + flyer via printFlyer).
5. Campaign list tab "Chiến dịch": status tabs, search, filter by branch; detail page with tabs "Nội dung" ·
   "Lịch sử duyệt" (audit) · "Hiệu quả" (link hits for now).

Acceptance: staff drafts → submits; the same staff cannot approve; the branch head approves; links are created; editing
facts is impossible in the UI and rejected by the RPC; audit shows every step.
```

### Phase M3 — Self-serve email to the platform audience
- [ ] Done

```text
Execute Phase M3 of docs/owner-marketing-plan.md. Follow D0. Read docs/email-marketing-spec.md first.

Goal: an approved campaign can be sent by email to matching, opted-in platform buyers, without the owner ever seeing who
they are.

1. Migration: owner_mkt_recipients (snapshot; RLS admin-only). RPCs:
   - owner_mkt_count_audience(workspace_id, spec) → {eligible, no_optin, capped}; spec built from criteria in B4;
     minimum audience 20 (below → ok:false 'audience_too_small').
   - owner_mkt_send(campaign_id): needs 'share'; status approved; send window open (reuse outreach_send_window_open for
     every selected asset's session); applies OWNER_MKT_WEEKLY_CAP (constant, default 2) across all owner campaigns;
     snapshots recipients; sets counters. Decision D1: if the workspace has < 3 sent platform campaigns, status goes to
     'pending_platform_review' instead and an admin approves it in the admin queue (add that status to the CHECK).
   - owner_mkt_campaign_stats(campaign_id) → aggregates only.
2. Sending goes through a MarketingChannelProvider interface (src/lib/marketing/provider.ts) with a
   SimulatedEmailProvider that reproduces today's admin behaviour. No provider SDK in components (guardrail B6).
3. Every email has the platform unsubscribe link (sets notifications_enabled=false) and the tracking link of channel 'email'.
4. UI: an audience section in the editor showing counts only, with the sentence
   "Danh sách người nhận do sàn quản lý — bạn chỉ thấy số lượng."; schedule (immediate / scheduled); detail tab "Thống kê"
   mirrors the admin StatsTab.
5. Admin: a review list for 'pending_platform_review' campaigns, as a tab next to the admin Email Marketing list
   (/admin/marketing/email).

Acceptance: network responses for owners never contain recipient emails or ids; capped users are skipped and counted;
sending outside the registration window is rejected with a clear Vietnamese message.
```

### Phase M4 — "Giao việc cho sàn"
- [ ] Done
- **Can run in parallel with:** M2, M3

```text
Execute Phase M4 of docs/owner-marketing-plan.md. Follow D0.

Goal: an owner orders a marketing package for an asset and follows it to completion; admins fulfil it with the existing
email / banner tools.

1. Migration: services row (category 'marketing_owner') + service_variants with the keys in B3 (ON CONFLICT DO NOTHING);
   owner_mkt_orders per B3 with workspace RLS (create needs 'truyen-thong:share'); RPCs owner_mkt_order_create,
   admin_mkt_order_quote, owner_mkt_order_pay (subscription quota via _owner_sub_consume first, then credits via
   _charge_owner_feature_credits; VNPay only if the existing owner payment flow supports it — otherwise list it under
   "Notes for later phases"), admin_mkt_order_start, admin_mkt_order_complete (writes result_summary, creates the admin
   `orders` revenue row), owner/admin cancel. Follow the asset_authentication_orders lifecycle pattern.
2. Owner UI: tab "Giao việc cho sàn" = package cards (name, what you get, price or "Báo giá") → order dialog (asset, brief)
   → order list with a status timeline; "Đẩy truyền thông" on the asset's "Truyền thông" tab pre-selects the asset.
3. Admin UI: add kind 'truyen-thong' to the unified queue /admin/yeu-cau-dich-vu (detail /admin/yeu-cau-dich-vu/truyen-thong/:id,
   following the existing vr-tour / giam-dinh kinds); "Tạo chiến dịch email từ đơn" opens AdminCampaignEditor pre-filled
   (content via the outreach generator, audience criteria from the asset) and links marketing_campaign_id back; the same
   for "Tạo banner từ đơn" → AdminAdEditor / advertisement_id; mkt_featured_owner sets the listing's existing `featured` flag for
   7 days (add a featured_until column; verify how /listings and the homepage read `featured` first).
4. When the order completes, the owner sees the linked campaign/banner stats inside the order.

Acceptance: fixed-price order → paid from quota → admin fulfils with an email campaign → owner sees sent/opened/clicked;
a quote order cannot be paid before it is quoted and expires after quote_expires_at.
```

### Phase M5 — Funnel & periodic report
- [ ] Done

```text
Execute Phase M5 of docs/owner-marketing-plan.md. Follow D0.

1. Attribution: when a visitor with the mkt_link_id cookie saves an asset or registers for a session, record mkt_link_id
   (analytics_events feature row, and a nullable column on the registration record if one exists — survey first and
   report).
2. RPC owner_mkt_funnel(workspace_id, period_start, period_end, listing_id NULL) → funnel per B5, split by channel and
   by source (self-serve / ordered from the platform / own channels via links). Participants and outcome from
   owner_asset_outcomes_resolved.
3. "Hiệu quả" tab: HeroFigure (registrations attributed in the period), funnel bars, per-channel table, per-asset table;
   the asset "Truyền thông" tab shows the same for one asset. Charts follow the CLAUDE.md chart note.
4. Periodic report: add a "Hiệu quả truyền thông" part to owner_build_report_payload (frozen in snapshots, included in
   print / Excel / the /r/:token payload, with no personal data).

Acceptance: numbers match between the tab, the asset tab and the report for the same period; unattributable data is
labelled "Không xác định nguồn".
```

### Phase M6 — Bank demo pack
- [ ] Done

```text
Execute Phase M6 of docs/owner-marketing-plan.md. Follow D0.

1. Idempotent seed script (NOT a migration that runs in production — a separate SQL file or edge function guarded by an
   admin flag) creating the workspace "Ngân hàng Demo — Chi nhánh Quận 7" with 2 accounts (Cán bộ, Trưởng đơn vị),
   6 assets (one with 2 failed rounds), one sent campaign, one export campaign with link hits, one completed platform
   order, and outcomes, so that every screen in the A4 script has data. Every seeded figure carries the badge
   "Dữ liệu minh hoạ".
2. Page /chu-tai-san/truyen-thong/du-lieu ("Dữ liệu đi đâu"): a static, plain-language data-flow diagram per level
   L0 / L1 / L2 of A5 — what enters the platform, what never does, where it is stored, and contact for white label.
3. "Tổng quan" to-do card "Đẩy truyền thông" (B7 rule).
4. Write docs/owner-marketing-demo.md: the 15-minute script of A4 with click paths and the interview questions of A3.

Acceptance: running through the A4 script on the seeded accounts shows no empty states and no console errors.
```

### Phase M7 — White-label readiness (only after decision D6)
- [ ] Done

```text
Execute Phase M7 of docs/owner-marketing-plan.md. Follow D0. Start with a SPIKE report and stop for confirmation.

Spike: (a) list every Supabase-cloud-only dependency (edge functions, storage policies, auth providers, cron, extensions)
and whether self-hosted Supabase supports it; (b) list every hard-coded brand/domain string outside src/lib/brand.ts;
(c) propose the provider adapters needed (email, SMS brandname, SSO via OIDC/SAML).
Then, if confirmed: a theme/brand config switch, a provider config switch, an OIDC login option for owner workspaces,
and docs/white-label-deploy.md (docker-compose for self-hosted Supabase + build-time env).
```

---

## Appendix — Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Owners spam the platform audience; buyers unsubscribe. | Weekly frequency cap, minimum audience size, platform review of first campaigns (D1), unsubscribe tracking per campaign. |
| 2 | Content contradicts the official auction notice. | Facts locked and read from the session; send window enforced in SQL. |
| 3 | The bank asks where data is hosted and the answer is "Singapore". | Prepare the A5 levels; Export mode keeps customer data inside the bank; white-label path ready. |
| 4 | The demo looks good but the value isn't real. | Pilot with a baseline and a 60-day comparison (A3 success criterion); funnel built before the demo. |
| 5 | Simulated email gets mistaken for real delivery in production. | Provider adapter shows "Mô phỏng" in admin and owner detail pages until D5 is decided. |

## Appendix — Sources

- Vietcombank — Phát mại tài sản: https://www.vietcombank.com.vn/vi-VN/Trang-thong-tin-dien-tu/Phat-mai-tai-san
- NLĐ / Tuổi Trẻ — Ngân hàng "đau đầu" rao bán tài sản (07/2023): https://tuoitre.vn/nld/kinh-te/ngan-hang-dau-dau-rao-ban-tai-san-20230703214031183.htm
- CafeF — Ngân hàng rao bán nhiều tài sản thế chấp (24/11/2025): https://cafef.vn/ngan-hang-rao-ban-nhieu-tai-san-the-chap-188251124152802142.chn
- Tuổi Trẻ — Nguyên nhân ngân hàng dồn dập "đại hạ giá" bất động sản nhưng vẫn ế: https://tuoitre.vn/nguyen-nhan-ngan-hang-don-dap-dai-ha-gia-bat-dong-san-nhung-van-e-20231121182555677.htm
- NLĐ — Liên tục "đại hạ giá" khoản nợ xấu hàng trăm tỉ đồng (02/2026): https://nld.com.vn/lien-tuc-dai-ha-gia-khoan-no-xau-hang-tram-ti-dong-cua-mot-cong-ty-du-lich-196260206062907945.htm
- Tạp chí Ngân hàng — Luật BVDLCN 2025 và tác động tới ngân hàng: https://tapchinganhang.gov.vn/luat-bao-ve-du-lieu-ca-nhan-nam-2025-va-nhung-tac-dong-doi-voi-linh-vuc-ngan-hang-tai-viet-nam-17211.html
- GV Lawyers — Luật bảo vệ dữ liệu cá nhân 2026: https://gvlawyers.com.vn/luat-bao-ve-du-lieu-ca-nhan-2026/
- Bộ Công an — Luật BVDLCN có hiệu lực từ 01/01/2026: https://bocongan.gov.vn/chinh-sach-phap-luat/bai-viet/luat-bao-ve-du-lieu-ca-nhan-chinh-thuc-co-hieu-luc-thi-hanh-tu-ngay-01-01-2026-1767186124
- Thông tư 09/2020/TT-NHNN: https://thuvienphapluat.vn/van-ban/Tien-te-Ngan-hang/Thong-tu-09-2020-TT-NHNN-an-toan-he-thong-thong-tin-trong-hoat-dong-ngan-hang-455885.aspx
- Thị trường Tài chính Tiền tệ — Điện toán đám mây: lưu ý khi triển khai tại ngân hàng: https://thitruongtaichinhtiente.vn/dien-toan-dam-may-nhung-luu-y-khi-trien-khai-tai-ngan-hang-37240.html

## Appendix — Phase M0 prompt ("Hồ sơ online")

```text
Implement "Hồ sơ online" — a public, shareable web dossier of a digitised asset (asset_postings), so bank officers
can send it to the bank's own customers through the bank's own channels (Zalo, email, RM). The platform never receives
the bank's customer data. Read CLAUDE.md, .agents/knowledge/business-rules.md, common-pitfalls.md, design-system.md and
section A8 of docs/owner-control-tower-plan.md (design language) first. All UI copy in Vietnamese.

CONTEXT (verified in code)
- A printable A4 "Hồ sơ số hoá tài sản" already exists: src/pages/chu-tai-san/OwnerPostingPrintPage.tsx,
  src/components/asset-posting/print/* (PostingPrintSheet, PrintCover, PrintAssetSections, PrintMediaSection, PrintQr),
  data from src/hooks/usePostingPrintData.ts (owner-only). Its QR currently points to the protected owner portal.
- Public share pattern to copy: /r/:token — SharedOwnerReportPage.tsx + RPC get_shared_owner_report in
  supabase/migrations/20260926181355_owner_report_share.sql (token format check, expiry, revoke, view counting that
  excludes workspace members, filtered payload, noindex meta, column-privilege self-check).
- Media: bucket asset-media is PUBLIC (images/videos); bucket asset-docs is PRIVATE (legal docs) — never expose it.
  3D: asset_3d_scans (status 'ready', model_url); VR: asset_vr_tours / public_session_lot_vr_tours;
  appraisal: asset_authentication_orders (completed).
- A posting reaches a session via auction_session_items.asset_posting_id (source='posting'); online dossier purchase =
  auction_bidding_contracts (sessions.dossier_fee).
- Permissions: src/lib/ownerWorkspace/permissions.ts (module "so-hoa" has view/create/update today) + SQL
  owner_ws_permission_catalog / owner_ws_has / owner_ws_has_in (see 20260927170000/170100 migrations).
- Hosting has vercel.json (SPA rewrite).

DECISIONS ALREADY TAKEN (do not ask again)
- D1 Starting price: hidden by default while the posting has no announced session; the officer can turn it on per link.
- D2 "Nhận thông báo khi mở phiên" requires a platform account (openAuthDialog). The bank sees COUNTS only, never who.
- D3 A link can be created only when asset_postings.review_status = 'approved' and status <> 'cancelled'.
- D4 Link-preview cards for Zalo/Facebook via Vercel Routing Middleware — but verify the host first (step 0).

STEP 0 — SPIKE (report, then continue unless something below is false)
- Confirm production is deployed on Vercel (vercel.json, any deploy config, README). If it is NOT Vercel, still do
  steps 1–5, implement step 6 as a Supabase Edge Function instead, and state the trade-off (link domain) in the report.
- Confirm the public session page route a buyer uses to buy the dossier (grep App.tsx for sessions/:id) and how the
  owner/bank display name + logo can be read for a workspace (asset_owner_workspaces / asset_owners); report what exists.
- List every field of PostingPrintData and classify it PUBLIC / PRIVATE using the rules in step 2.

STEP 1 — PERMISSION
- Add action "share" to module "so-hoa" (TS: actions + actionLabels share = "Chia sẻ hồ sơ"; SQL catalogue).
  Migration grants it to every role that currently has so-hoa:update (OWNER included). Keep the self-check style of the
  RBAC migrations (no one gains or loses anything else).

STEP 2 — DATABASE (one migration, apply it yourself with the migration skill, then regenerate types)
- posting_share_links: id, posting_id FK asset_postings ON DELETE CASCADE, workspace_id (nullable — individual owners
  have none), code TEXT UNIQUE (12 chars, URL-safe random, generated server-side), label TEXT NOT NULL (e.g.
  "Anh Minh – KHDN", ≤ 80), sender_name, sender_phone (/^0[0-9]{9}$/), show_price BOOL default false,
  show_exact_address BOOL default false, show_sender_contact BOOL default false, expires_at (NULL = no expiry),
  revoked_at, view_count, unique_view_count, cta_dossier_count, cta_pdf_count, cta_follow_count, last_viewed_at,
  created_by, created_at, updated_at.
- posting_share_events: id, link_id, event CHECK IN ('view','cta_dossier','cta_pdf','cta_follow','cta_call'),
  visitor_id TEXT (anonymous id from the client, like analytics_events.session_id), device, created_at. NO IP.
- posting_share_follows: posting_id, user_id, link_id, created_at, UNIQUE(posting_id, user_id); RLS "own rows".
- RLS: links/events readable by workspace members with so-hoa:view (or the posting's user_id for individual owners);
  NO direct insert/update/delete policies — all writes through SECURITY DEFINER RPCs returning {ok:false, reason} for
  business errors:
  * create_posting_share_link(posting_id, label, sender_name, sender_phone, show_price, show_exact_address,
    show_sender_contact, expires_in_days) — requires so-hoa:share (+ branch scope via owner_ws_has_in) and rule D3.
  * update_posting_share_link(...) / revoke_posting_share_link(link_id).
  * get_shared_posting(code, visitor_id) — GRANT to anon, authenticated. Rejects bad format / unknown / revoked
    (same 'not_found') / expired ('expired'). Counts a view (unique by visitor_id per link) ONLY when the caller is not
    a member of the owning workspace. Returns a FILTERED payload:
      PUBLIC: title, category labels, province/district (+ ward/address only if show_exact_address), description,
      specs from delta_fields, legal booleans as badges (has_dispute, has_mortgage, is_seized, right_to_sell),
      image_urls, video_urls, 3D model url if a scan is 'ready', VR url if attached, "Đã giám định" flag if an
      authentication order is completed, starting_price only if show_price OR the session is announced,
      session card (organisation name, schedule, dossier_fee, deposit, registration deadline, session public path)
      when an announced session contains the posting, bank display name + logo, sender name/phone only if
      show_sender_contact, link expiry.
      NEVER: ownership_proof_urls, doc_urls (asset-docs), ownership_declaration, legal_notes, review_* fields,
      commission_pct, consult/request internals, user_id, workspace_id, posting id, link id, counters.
  * track_posting_share_event(code, visitor_id, event) — anon; ignores unknown/expired codes; rate-limit 1 event of
    the same type per visitor per link per minute.
  * follow_shared_posting(code) — authenticated; upserts posting_share_follows, increments cta_follow_count once per
    user; later notification delivery is OUT OF SCOPE (just store the follow).
- Self-check block at the end: anon/authenticated cannot SELECT posting_share_links.code directly; get_shared_posting's
  payload keys are exactly the PUBLIC whitelist.

STEP 3 — PUBLIC PAGE /hs/:code (outside ProtectedRoute, lazy, its own minimal layout, noindex meta, mobile-first —
it will mostly open inside Zalo's in-app browser)
- src/pages/SharedPostingPage.tsx (< 300 lines) + components in src/components/asset-posting/shared/:
  SharedHero (cover image, title, area, price or "Giá khởi điểm: liên hệ"), SharedGallery (images + videos,
  swipe on mobile), SharedMediaBadges (3D / VR / "Đã giám định", opening the viewers that already exist),
  SharedSpecs (reuse label logic from PrintAssetSections — extract a shared helper rather than duplicating),
  SharedLegalBadges, SharedSessionCard (CTA "Mua hồ sơ trực tuyến" → session public page; if no announced session:
  CTA "Nhận thông báo khi mở phiên" → openAuthDialog then follow_shared_posting, success toast),
  SharedSenderCard (bank name/logo, sender name + "Gọi" tel: link when allowed), SharedFooter
  ("Hồ sơ số hoá trên Tài Sản Đấu Giá" + small logo).
- Anonymous visitor_id stored in localStorage (wrap in try/catch, fall back to an in-memory id).
- Fire track events for view (once per load), cta_dossier, cta_pdf, cta_follow, cta_call.
- Unavailable states (not found / expired) use EmptyState with a polite message, like SharedOwnerReportPage.
- Sticky bottom CTA bar on mobile. Skeleton loading. Existing tokens only, cards rounded-2xl, lucide icons.
- "Tải PDF": render a print view from the PUBLIC payload only (route /hs/:code/in). Reuse print components where their
  props allow; if they require private PostingPrintData fields, build a slim SharedPostingPrintSheet instead of
  widening the public payload. The QR in this print view points to the /hs/:code link.

STEP 4 — OWNER SIDE (cổng chủ tài sản, posting detail /chu-tai-san/dang-tai-san/:id)
- Section card "Hồ sơ online" (visible with so-hoa:view; actions need so-hoa:share): button "Tạo link chia sẻ" →
  ShareLinkDialog (own component; Zod; fields per step 2 with helper text; expiry 7 / 30 / 90 ngày / Không hết hạn;
  disabled with explanation when review_status ≠ approved).
- ShareLinksTable: label, created by, expiry/status badge, views, unique visitors, "Mua hồ sơ" clicks, follows,
  last viewed; row actions: "Sao chép link", "Mã QR" (download PNG via the qrcode package), "Tin nhắn Zalo"
  (copies a short Vietnamese message: title, area, price if shown, link), "Sửa", "Thu hồi" (confirm dialog).
- "Xem như người nhận" opens /hs/:code in a new tab (member views are not counted).
- React Query hooks in src/hooks/usePostingShareLinks.ts with proper keys + invalidation + toasts.

STEP 5 — TESTS
- vitest: Zalo message builder, expiry/status helper, public spec-label helper.
- SQL test evidence in the report: create link as staff with share permission; viewer without share is refused;
  unapproved posting is refused; anon get_shared_posting returns no private keys; revoked link returns not_found;
  member view does not increment counters.

STEP 6 — LINK PREVIEW (OG) FOR ZALO / FACEBOOK
- Vercel Routing Middleware (middleware.ts at repo root, matcher '/hs/:path*'): if the User-Agent is a link crawler
  (facebookexternalhit, Facebot, Zalo, Twitterbot, Slackbot, TelegramBot, WhatsApp, LinkedInBot, Googlebot excluded
  since the page is noindex), call get_shared_posting via the Supabase REST endpoint with the anon key (read from
  server-side env vars; document which ones to set in Vercel) using visitor_id 'crawler' that MUST NOT count as a view
  (handle in the RPC), and return a tiny HTML with og:title, og:description (area · price if shown · "Hồ sơ số hoá"),
  og:image (cover image), og:url, twitter:card; otherwise pass through to the SPA. Expired/unknown → generic OG card.
- If step 0 found the host is not Vercel: implement the same as a Supabase Edge Function and explain the link format.

OUT OF SCOPE (list under "Notes for later" if relevant): collections of several assets in one link, sending
notifications to followers, sharing follower identities with the bank, fixing the QR inside the owner print sheet,
analytics dashboards beyond the table counters.

FINISH: npm run lint and npm run build must pass; record decisions with the log-decision skill (new public share
pattern for postings, the PUBLIC/PRIVATE field whitelist); report files changed, migration name, Vercel env vars to
set, how to test manually (including pasting a link into Zalo), and mobile screenshots of /hs/:code if a browser is
available.
```
