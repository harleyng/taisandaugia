# Complete Asset Dossier Plan → "Hồ sơ hoàn chỉnh" + trust score

> Version 0.1 · 2026-10-01 · Status: **proposed, pending approval**
> Scope: digitised assets (`asset_postings`) of asset owners — banks / AMCs first, individual owners work the same way.
> How to use: every phase in **Part C** has a self-contained English prompt that points back to this file. Paste the prompt block into Claude Code (or just say `Execute Phase N of docs/owner-dossier-plan.md`). Respect the dependencies in **Part B**.
> Language convention: this document is in English. Text in "quotes" in Vietnamese is **UI copy** that appears on screen and must stay Vietnamese.
> Related: design language and shared UI blocks come from **section A8 of `docs/owner-control-tower-plan.md`** — this plan does not redefine them.

---

# PART A — DESIGN (reference for every prompt)

## A0. Summary

| | |
|---|---|
| **Problem** | The platform sells 3 services for a digitised asset: **auction organisation**, **valuation** ("thẩm định giá") and **legal advice** ("tư vấn pháp lý"). Many owners (banks) **already have their own partners** for these. The wizard only supports finding partners *via the platform*, so those owners stop at that step: there is nowhere to record the work their partners already did. |
| **Strategy** | Let owners **self-enter** their partners' results and documents. Do not sell it as "data entry". Sell it as **"một bộ hồ sơ hoàn chỉnh, đáng tin"**: a complete dossier that buyers trust and that gets more registrations. |
| **Core idea** | One dossier per asset = ownership + legal + valuation + auction organisation + media. Each part is labelled by **proof level** and adds to a **trust score (0–100)** with a level "Cơ bản" / "Đầy đủ" / "Hoàn chỉnh". Partner history feeds a private **partner scorecard**. |
| **Out of scope (v1)** | Inviting partners to fill in data, notifying partners, admin verification of partner documents, credit rewards. |

### Why owners will fill it in (the two value props we sell)

1. **Buyer trust → more registrations.** Public listings show "Hồ sơ hoàn chỉnh" plus a short checklist ("Đã thẩm định giá", "Đã có ý kiến pháp lý", "Có tổ chức đấu giá"). Fewer sessions fail with "không ai đăng ký" / "chỉ 1 người".
2. **Evidence to choose partners.** "Đối tác của tôi" compares the owner's own valuers, lawyers and auction organisations on real outcomes (valuation vs winning price, success rate, rounds to sell).

## A1. Current state of the code (verified 2026-10-01)

| Area | Reality |
|---|---|
| Wizard | `src/components/asset-posting/AssetPostingWizard.tsx`, 5 steps; one `useForm` with `wizardSchema.ts`. **Gating = `requirements()` only** (zod is just for typing — do not add `.min()`/`superRefine` rules). |
| Step 4 | `steps/Step4AuctionNeeds.tsx`: `wantsAuction` (""/yes/no), `orgMode` (self/platform), `chosenOrgs` (≤ `MAX_RFQ_ORGS`), `pricingMode` (`self` / `appraisal`), `startingPrice`, `auctionFormat`, `commissionPct`. |
| Legal | Step 3 (`Step3LegalStatus.tsx`): 3 self-declared answers `has_dispute`, `has_mortgage`, `is_seized` + `legal_notes`; ownership proof (`ownership_proof_urls`) or signed declaration (`ownership_declaration`) depending on `getProofMode(parentSlug)`. |
| Services | `asset_service_requests` = one row per org receiving an RFQ; quote plan catalog in `src/constants/quote-plan.ts` (milestone `tham_dinh`, scope item `tham_dinh_gia`). Valuation exists only as a *scope item of an auction quote*, not as a standalone service — **verify in Phase 1 survey**. |
| `asset_postings` | Has `pricing_mode`, `starting_price`, `chosen_org_id`, `doc_urls`, `image_urls`, `review_status`, `workspace_id` … **No column for partner, valuation value, certificate, legal opinion.** |
| Detail page | `src/components/asset-posting/detail/`: tabs `PostingOverviewTab`, `PostingLegalTab`, `PostingAuctionTab`, cards, `ExportPostingPdfButton`. |
| Authentication cert | A separate "chứng thư giám định" gate exists (BR-GD-03, `AuthenticationContext`) — **do not confuse** with the valuation certificate of this plan. |
| Constants | `MIN_IMAGES = 1` (`src/constants/asset-posting-rules.ts`). |

## A2. Dossier parts and the three sources

Every service part (`appraisal`, `legal`, `auction`) has exactly one **source**:

| Source | UI label | Meaning |
|---|---|---|
| `marketplace` | "Tìm qua sàn" | Current RFQ / quote flow. **Behaviour must not change.** |
| `external_partner` | "Đã có đối tác" | Owner self-enters partner + result + documents. |
| `none` | "Chưa cần" | Owner skips it (not available for `auction` when `wantsAuction = 'yes'`). |

Fields entered for `external_partner`:

| Part | Fields |
|---|---|
| Thẩm định giá | partner name · **appraised value** · certificate date · valid until (prefill +6 months, editable) · certificate file · toggle "Hiển thị giá thẩm định công khai" (default **off**) |
| Pháp lý | partner name · conclusion "Pháp lý sạch" / "Có vướng mắc" (+ summary when has issues) · legal opinion file |
| Tổ chức đấu giá | org from `auction_organizations` directory **or** free-text name · service contract date · planned auction date |

When an appraised value is entered and `startingPrice` is empty, prefill `startingPrice` with it.

## A3. Proof levels (shown on every item)

| `proof` | UI label | Icon (lucide) | Rule |
|---|---|---|---|
| `self` | "Tự khai" | `PenLine` | Data entered, no file |
| `document` | "Có tài liệu" | `FileCheck` | At least one evidence file attached |
| `platform` | "Sàn xác nhận" | `ShieldCheck` | Done via the platform (selected quote) or posting `review_status = approved` |

Same vocabulary as the source badges of the control-tower plan (A3 there) — keep wording consistent.

## A4. Table `asset_posting_dossier_items`

```sql
CREATE TABLE public.asset_posting_dossier_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_id           UUID NOT NULL REFERENCES asset_postings(id) ON DELETE CASCADE,
  workspace_id         UUID REFERENCES asset_owner_workspaces(id) ON DELETE SET NULL, -- copied from posting
  kind                 TEXT NOT NULL CHECK (kind IN ('appraisal','legal','auction')),
  source               TEXT NOT NULL CHECK (source IN ('marketplace','external_partner','none')),
  service_request_id   UUID REFERENCES asset_service_requests(id) ON DELETE SET NULL,
  partner_org_id       UUID REFERENCES auction_organizations(id) ON DELETE SET NULL,
  partner_name         TEXT,
  issued_at            DATE,          -- certificate / opinion / service-contract date
  valid_until          DATE,          -- appraisal only
  appraised_value      NUMERIC(18,0),
  show_appraised_value BOOLEAN NOT NULL DEFAULT false,
  legal_conclusion     TEXT CHECK (legal_conclusion IN ('clean','has_issues')),
  legal_summary        TEXT,
  planned_auction_date DATE,
  evidence_urls        TEXT[] NOT NULL DEFAULT '{}',
  created_by           UUID NOT NULL REFERENCES profiles(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (posting_id, kind),
  CONSTRAINT ext_needs_partner  CHECK (source <> 'external_partner' OR partner_org_id IS NOT NULL OR partner_name IS NOT NULL),
  CONSTRAINT ext_appraisal_value CHECK (kind <> 'appraisal' OR source <> 'external_partner' OR appraised_value IS NOT NULL),
  CONSTRAINT ext_legal_conclusion CHECK (kind <> 'legal' OR source <> 'external_partner' OR legal_conclusion IS NOT NULL)
);
```

- RLS: **same read/write rule as the parent `asset_postings` row** — reuse the existing helper (e.g. `owner_posting_row_can`), no new logic.
- Storage: private bucket `posting-dossier-evidence`, path `{posting_id}/{kind}/...`, PDF/JPG/PNG ≤ 10MB, policies by posting access.
- Evidence files and partner names are **never** public.

## A5. Trust score (single source of truth = SQL)

RPC `asset_posting_dossier_trust(p_posting_id)` — SECURITY DEFINER, STABLE, fixed `search_path`, checks the caller can read the posting. Returns `score INT`, `level TEXT`, `items JSONB[]` where each item = `{key, label, points_earned, points_max, status, proof, hint}`, `status ∈ done | partial | missing | expired`. **The frontend never recomputes the score.**

| key | UI label | Max | Rule |
|---|---|--:|---|
| `ownership` | "Giấy tờ sở hữu" | 15 | Documents group: ≥ 1 `ownership_proof_url` = 15. Other groups: valid signed declaration = 10 |
| `legal_self` | "Tự khai pháp lý" | 5 | All 3 legal questions answered |
| `legal_partner` | "Ý kiến pháp lý" | 20 | Conclusion entered = 10; + evidence file = +10; marketplace with selected quote = 20 |
| `appraisal` | "Thẩm định giá" | 25 | Value + partner = 10; + certificate file = +10; + `valid_until ≥ today` = +5. Expired ⇒ `status = expired`, loses the +5 |
| `auction_org` | "Tổ chức đấu giá" | 15 | Directory org = 10 / free text = 5; + contract date or planned auction date = +5; marketplace with selected quote = 15 |
| `media` | "Hình ảnh & tài liệu" | 10 | ≥ `MIN_IMAGES` images = 5; + ≥ 1 `doc_url` = +5 |
| `review` | "Sàn đã duyệt" | 10 | `review_status = approved` |
| | **Total** | **100** | |

**Levels**

| Level | UI label | Rule |
|---|---|---|
| `basic` | "Cơ bản" | score < 40 |
| `full` | "Đầy đủ" | 40 ≤ score < 75, or ≥ 75 without the "complete" condition |
| `complete` | "Hoàn chỉnh" | score ≥ 75 **and** `appraisal` and `legal_partner` both at least `partial` |

- Weights are constants at the top of the function and documented in `business-rules.md`.
- Each missing/partial item returns a short verb-first hint with the points it would add: "Tải chứng thư thẩm định (+10 điểm)".
- **Public variant** `get_public_dossier_trust(p_posting_id)`, GRANT to `anon`, only for publicly listed postings: level, score and item labels/status only. No file URLs, no partner names, no `appraised_value` unless `show_appraised_value = true`.

## A6. Certificate expiry

| Condition | Badge | Token |
|---|---|---|
| `valid_until` within 30 days | "Chứng thư sắp hết hạn" | `warning` |
| `valid_until < today` | "Chứng thư đã hết hạn — cần thẩm định lại" | `destructive` |

Expiry is the natural moment to suggest the platform's valuation service. v1 only shows the badge and an action "Cập nhật chứng thư"; any upsell CTA waits for decision D5.

## A7. Partner scorecard ("Đối tác của tôi")

RPC `owner_partner_scorecard(p_workspace_id)` from dossier items + `owner_asset_outcomes_resolved`. Private to the workspace.

| Partner type | Metrics |
|---|---|
| Thẩm định giá | Assets · median `|winning_price − appraised_value| / appraised_value` for sold assets · % assets unsold ≥ 2 rounds |
| Pháp lý | Assets · outcomes cancelled / failed for legal reasons |
| Tổ chức đấu giá | Assets · success rate · average rounds to sell · average participants |

- Group by `partner_org_id`, else by normalised `partner_name` (trim + lower + `unaccent`).
- Show a metric only when the partner has **≥ 3 assets with an outcome**; otherwise "Chưa đủ dữ liệu".
- v1: the scorecard **does not** change the dossier trust score (decision D3).

## A8. UI placement & copy

| Where | What |
|---|---|
| Wizard step 4 | Section "Hồ sơ dịch vụ": 3 rows with a segmented choice (A2). Intro line: "Có sẵn đối tác? Nhập kết quả của họ để hồ sơ hoàn chỉnh và đáng tin hơn." |
| Wizard review step | Trust preview: level + score + top 2 hints |
| Posting detail | New tab "Hồ sơ": `DossierTrustCard` (L1) → `DossierChecklist` with inline actions (L2) → item details & files (L4) |
| Owner posting list | Level badge + score column |
| Print / PDF export | Trust section with the checklist (proof labels as text) |
| Public listing / views for auction orgs | Badge "Hồ sơ hoàn chỉnh" or "Hồ sơ đầy đủ" + compact checklist; tooltip explains "Tự khai" vs "Có tài liệu" |
| Owner portal nav | "Đối tác của tôi" in group "Phân tích" → `/chu-tai-san/doi-tac` |

Marketing line for L1: "Hồ sơ hoàn chỉnh giúp người mua tin tưởng và đăng ký nhiều hơn." Follow control-tower plan A8 for typography, colours (existing tokens only), icons (lucide, stroke 1.5) and the shared blocks in `src/components/asset-owner-portal/ui/`.

Icons: "Hồ sơ" `FolderCheck` · "Thẩm định giá" `Scale` · "Pháp lý" `Landmark` · "Tổ chức đấu giá" `Gavel` · "Đối tác của tôi" `Handshake` · expiry `Clock`. Verify each name exists in the installed lucide version.

## A9. Open decisions

| # | Decision | Blocks | Default if undecided |
|---|---|---|---|
| D1 | Final score weights and the "Hoàn chỉnh" threshold | Phase 1 | Table in A5 |
| D2 | Can owners publish the appraised value? | Phase 4 | Opt-in per asset, default off |
| D3 | Does partner history change the dossier score? | Phase 5 | No, separate label only |
| D4 | Default validity of a valuation certificate | Phase 1, 2 | 6 months, editable (confirm against current regulation) |
| D5 | Upsell CTA to platform services on missing/expired items | after Phase 3 | No CTA in v1 |

---

# PART B — DEPENDENCIES & PARALLEL EXECUTION

## B1. Dependency graph

| Phase | Depends on | Unblocks |
|:-:|---|---|
| P1 | — | P2, P3, P5 |
| P2 | P1 | — |
| P3 | P1 | P4 |
| P4 | P3 + D2 | — |
| P5 | P1 + D3 | — |

```text
P1 ─┬─► P2
    ├─► P3 ─► P4*
    └─► P5*
* = also blocked by an open decision (P4: D2 · P5: D3)
```

## B2. Execution waves

| Wave | Phases (parallel) | Waits for |
|:-:|---|---|
| 1 | **P1** | — |
| 2 | **P2**, **P3**, **P5*** | P1 merged |
| 3 | **P4*** | P3 merged |

Critical path: P1 → P3 → P4.

## B3. Rules for running phases in parallel

1. One git worktree / branch per phase.
2. Only P1 and P5 have migrations. If they run together, do not hand-merge `types.ts`; regenerate once after merging.
3. Migration timestamps are generated at run time; run `npx supabase migration list` before `db push`.
4. Known overlaps: **P2 ↔ P3** both reuse the dossier field components. P3 creates them in `src/components/asset-posting/dossier/fields/`; if P2 runs first, P2 creates them there and P3 reuses them. Merge P3 first when both are open.
5. The `marketplace` source path (RFQ, `owner_select_service_quote`, quote selection) must behave **exactly** as before in every phase. Rerun the consignment tests after each merge.

---

# PART C — PHASES & PROMPTS

## C0. General rules (every prompt points here)

1. Before starting, read `CLAUDE.md`, `.agents/knowledge/business-rules.md` (esp. "Tài sản tự nguyện", "Hồ sơ số hoá theo tenant", "Ký gửi tài sản"), `common-pitfalls.md`, `design-system.md`, **Part A of this file**, and **section A8 of `docs/owner-control-tower-plan.md`**.
2. This plan is approved. **Do not stop to ask for confirmation**, unless the actual code contradicts Part A. In that case, stop and describe the contradiction.
3. Migrations: new timestamped file in `supabase/migrations/`, apply it yourself (skill `migration`), regenerate `src/integrations/supabase/types.ts`. Never edit an existing migration.
4. UI: Vietnamese copy, existing tokens only, `rounded-2xl` cards, lucide icons, **never** `<Button asChild><Link/></Button>`, pages and components under 300 lines, one component per modal.
5. Data via React Query + the typed Supabase client (skill `add-query`); mutations invalidate the right keys (including the trust RPC key) and show a toast.
6. **Stay within the phase scope.** List out-of-scope findings under "Notes for later phases" in your final report.
7. To finish: `npm run lint` and `npm run build` must pass; record decisions with skill `log-decision`; tick this phase's "Done" box in this file; report the files changed, migrations, manual test steps, and screenshots (desktop + mobile) if a browser is available.

### Phase 1 — Data model, evidence storage, trust score RPCs
- [ ] Done
- **Depends on:** — (decisions D1, D4 use defaults if open)
- **Can run in parallel with:** —

```text
Execute Phase 1 of docs/owner-dossier-plan.md. Follow section C0.

Goal: the database layer for the complete dossier and its trust score. No UI.

Step 0 — survey (put in the report BEFORE changing anything; stop if it contradicts Part A):
- How Step4AuctionNeeds / AssetPostingWizard create asset_service_requests rows on "Hoàn tất".
- Whether valuation and legal advice exist as standalone service kinds anywhere (asset_service_requests,
  service catalog, EnhanceServiceDialog, PostingEnhanceCard) or only as part of an auction quote.
- The RLS helper used for asset_postings rows, to reuse for the new table.
- How "a quote was selected" is represented, so 'marketplace' items can be scored (section A5).

Tasks (one migration):
1. Table asset_posting_dossier_items exactly as in section A4 + updated_at trigger + RLS reusing the posting helper.
   Trigger: copy workspace_id from the parent posting on insert/update.
2. Private storage bucket posting-dossier-evidence (section A4), policies by posting access.
3. RPC asset_posting_dossier_trust(p_posting_id) per section A5 (weights as named constants at the top,
   certificate validity default from D4). Status 'expired' per section A6.
4. RPC get_public_dossier_trust(p_posting_id), GRANT to anon, only for publicly listed postings, filtered
   output per section A5.
5. Regenerate types. Add src/lib/dossier/types.ts with TS types for the RPC output + label maps (A3, A5).
6. business-rules.md: new section "Hồ sơ hoàn chỉnh & điểm tin cậy" (sources, proof levels, weights, levels,
   public filtering).

Out of scope: any UI.
Acceptance (SQL evidence in the report): 3 sample postings — empty / partial / complete — with their scores and
levels; an expired certificate gives status 'expired'; an anon call to get_public_dossier_trust returns no file URL,
partner name or appraised value (unless show_appraised_value = true); a non-member cannot read another workspace's items.
```

### Phase 2 — Wizard: "Hồ sơ dịch vụ" section
- [ ] Done
- **Depends on:** Phase 1
- **Can run in parallel with:** Phase 3, Phase 5

```text
Execute Phase 2 of docs/owner-dossier-plan.md. Follow section C0.

Goal: while digitising, owners can say for each service "Tìm qua sàn" / "Đã có đối tác" / "Chưa cần" and enter
their partner's results (section A2).

Tasks:
1. New component src/components/asset-posting/steps/DossierServicesSection.tsx rendered inside Step4AuctionNeeds
   (keep both files under 300 lines). Three rows: "Thẩm định giá", "Pháp lý", "Tổ chức đấu giá", each with a
   segmented choice. The auction row has no "Chưa cần" when wantsAuction = 'yes'.
2. "Tìm qua sàn" maps to the CURRENT behaviour (pricingMode 'appraisal' for valuation; orgMode / chosenOrgs / RFQ
   for auction). Do not change how asset_service_requests rows are created or how quotes are selected.
   If Phase 1's survey found no standalone platform service for legal advice, show "Tìm qua sàn" for legal as
   disabled with the hint "Sắp có" and record this in the report.
3. "Đã có đối tác" shows inline fields per section A2, using field components in
   src/components/asset-posting/dossier/fields/ (create them if Phase 3 has not yet). Uploads go to the
   posting-dossier-evidence bucket (reuse useStorageUpload). Appraised value prefills startingPrice when empty.
4. Add the new fields to WizardValues, wizardDefaults and postingToWizardValues. requirements() gets NO new hard
   rules: the dossier is optional and only raises the score. Draft autosave (useDraftAutosave) must keep the fields.
5. On "Hoàn tất" (and on draft save once the posting exists), upsert asset_posting_dossier_items, one row per kind
   that has a choice.
6. StepReview: show a trust preview (level + score + top 2 hints) from asset_posting_dossier_trust when the
   posting id exists; otherwise show the checklist without a score.
7. Vitest: mapping wizard values ⇔ dossier rows (all 3 kinds × 3 sources).

Out of scope: detail page tab (Phase 3), public display (Phase 4).
Acceptance: an owner with their own valuer, lawyer and auction org can finish the wizard without using any
platform service; reopening the draft shows the same values; the "Tìm qua sàn" path behaves exactly as before.
```

### Phase 3 — "Hồ sơ" tab, list badge, PDF export
- [ ] Done
- **Depends on:** Phase 1
- **Can run in parallel with:** Phase 2, Phase 5

```text
Execute Phase 3 of docs/owner-dossier-plan.md. Follow section C0.

Goal: the owner sees and completes the dossier after submission, and sees the trust score everywhere they work.

Tasks (components in src/components/asset-posting/dossier/):
1. New tab "Hồ sơ" in the posting detail, next to the existing tabs (PostingLegalTab, PostingAuctionTab…).
   - DossierTrustCard (L1): score as a bar or ring, level badge, line
     "Hồ sơ hoàn chỉnh giúp người mua tin tưởng và đăng ký nhiều hơn."
   - DossierChecklist (L2): items from asset_posting_dossier_trust; each shows status, proof badge (section A3)
     and the hint as an inline action button that opens DossierItemDialog for that part.
   - Item details (L4): partner, dates, value, list of evidence files (signed URLs, owner-only).
2. DossierItemDialog: create/edit one part, reusing dossier/fields/ (create them here if Phase 2 has not).
   Editing is allowed only with write access to the posting.
3. Expiry badges per section A6 in the checklist and on the detail header.
4. Shared DossierLevelBadge component (level + score, compact). Add it to the owner's posting lists
   (digitised postings list and OwnerAssetsPage) as a column/badge.
5. ExportPostingPdfButton / print view: add a trust section (level, score, checklist; proof as text labels).
6. Mutations invalidate the posting, the dossier items and the trust RPC query keys.

Out of scope: public display (Phase 4), partner scorecard (Phase 5).
Acceptance: adding a certificate file to an appraisal entered as "Tự khai" raises the score by 10 immediately and
changes the proof badge to "Có tài liệu"; a posting can go from "Đầy đủ" to "Hoàn chỉnh" entirely from this tab;
viewers see no edit buttons.
```

### Phase 4 — Public "Hồ sơ hoàn chỉnh" badge (marketing)
- [ ] Done
- **Depends on:** Phase 3 + decision D2
- **Can run in parallel with:** Phase 5

```text
Execute Phase 4 of docs/owner-dossier-plan.md. Follow section C0.

Goal: buyers and auction organisations see that a dossier is complete and trustworthy.

Tasks:
1. Find every place a posting is shown publicly or to auction organisations (listing detail/cards fed by postings,
   consignment/RFQ views on the company portal). List them in the report.
2. Show DossierLevelBadge ("Hồ sơ hoàn chỉnh" only for level complete, "Hồ sơ đầy đủ" for full, nothing for basic)
   and a compact checklist from get_public_dossier_trust: "Đã thẩm định giá", "Đã có ý kiến pháp lý",
   "Có tổ chức đấu giá". Tooltip explains "Tự khai" vs "Có tài liệu" vs "Sàn xác nhận".
3. Appraised value appears only when show_appraised_value = true (decision D2), labelled "Giá thẩm định".
4. Listing cards: a small badge only (no checklist), so cards stay light.

Out of scope: search filters/sorting by level (note it for later).
Acceptance: an anonymous visitor sees the badge and checklist; the network response contains no file URLs,
partner names or hidden appraised values.
```

### Phase 5 — "Đối tác của tôi" (partner scorecard)
- [ ] Done
- **Depends on:** Phase 1 + decision D3
- **Can run in parallel with:** Phase 2, Phase 3, Phase 4

```text
Execute Phase 5 of docs/owner-dossier-plan.md. Follow section C0.

Goal: owners compare their own valuers, lawyers and auction organisations on real outcomes (section A7).

Tasks:
1. Migration: RPC owner_partner_scorecard(p_workspace_id), SECURITY DEFINER, checks owner_ws_can(...,'read');
   joins asset_posting_dossier_items with owner_asset_outcomes_resolved. Group by partner_org_id, else by normalised
   partner_name (trim + lower + unaccent; enable the extension if missing). Return metrics per section A7 plus
   assets_with_outcome so the UI can apply the ≥ 3 rule.
2. Page /chu-tai-san/doi-tac (skill new-page), nav group "Phân tích", label "Đối tác của tôi", icon Handshake.
   Three tabs: "Thẩm định giá" / "Pháp lý" / "Tổ chức đấu giá". Table per tab; metrics below the threshold show
   "Chưa đủ dữ liệu". Clicking a partner lists its assets.
3. Scope: workspace members only; staff with branch_scope see only their branches' assets.
4. Per decision D3 the scorecard does NOT affect asset_posting_dossier_trust. Record it with log-decision.

Out of scope: sharing the scorecard, ranking public partners, notifying partners.
Acceptance: with 3 sold assets from one valuer, the median deviation matches a manual calculation; a partner with
2 outcomes shows "Chưa đủ dữ liệu"; free-text names that differ only by case/accents are grouped together.
```

---

## Appendix — Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Owners inflate the score with self-declared data | Proof levels always visible; files add more points than text; "Hoàn chỉnh" needs valuation + legal parts. |
| 2 | Sensitive data leaks (valuation, legal issues of non-performing loans) | Private bucket; public RPC filtered; appraised value opt-in only. |
| 3 | Breaking the existing RFQ / quote flow | "Tìm qua sàn" maps to current behaviour; no new hard rules in requirements(); rerun consignment tests. |
| 4 | Expired certificates displayed as valid | Status `expired` computed at read time, not stored. |
| 5 | Partner names typed inconsistently break the scorecard | Normalised grouping + prefer directory pick for auction orgs; the ≥ 3 rule hides noisy metrics. |
