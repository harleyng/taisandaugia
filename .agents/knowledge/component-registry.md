# Component Registry — taisandaugia

> **Hand-curated** catalog of notable custom components & hooks, grouped by feature folder. Not exhaustive — **update it when you add a notable component**. Scan here (and **reuse**) before creating something new. Current-truth as of the `src/` scan.
> `src/components/ui/` = the standard **shadcn-ui primitives** (button, dialog, table, tabs, badge, select, popover, drawer, sidebar, form, chart, number-input, input-otp, sonner, …) — not enumerated here; **do not edit them directly**.
> All UI strings are **Vietnamese**. Design tokens are HSL vars in `src/index.css` — never add colors. Cards use `rounded-2xl`. Never `<Button asChild><Link>` — use `navigate()`.

---

## Global / top-level — `src/components/*.tsx`

Homepage sections, chrome, and route guards. **Reuse before building new:** `AuctionCard` for any listing tile; `ProtectedRoute`/`AdminRoute` to gate a page; `Header`/`Footer` are the shell for public pages.

| Component | Purpose |
|---|---|
| `Header.tsx` / `Footer.tsx` | Public site chrome (nav, auth entry, credit chip) |
| `AuctionCard.tsx` | Canonical auction/listing tile — reuse everywhere a listing appears |
| `AuctionSection.tsx` / `CompletedAuctions.tsx` / `FeaturedProjects.tsx` / `PopularAreas.tsx` | Homepage grids |
| `NewsSection.tsx` / `MarketReportTeaser.tsx` / `PartnersSection.tsx` | Homepage news, report teaser, partner logos |
| `AuctionFilterDialog.tsx` / `AuctionFilterSidebar.tsx` / `AuctionQuickFilters.tsx` / `SearchBar.tsx` | Listing search & filter surfaces (`/listings`) |
| `ProtectedRoute.tsx` / `AdminRoute.tsx` | Route guards (auth-gate / admin-gate) |
| `HomepageRewardBanner.tsx` | Onboarding-reward banner (ties to `onboarding/`) |
| `CollaborationDialog.tsx` | "Hợp tác/liên hệ" lead dialog |
| `AdSlot.tsx` / `AdvertisementBlock.tsx` | Ad placements |

## auth — `src/components/auth/`

**Do not build a second login UI.** All auth flows go through the one global modal.

| Component | Purpose |
|---|---|
| `AuthDialog.tsx` | Global multi-step modal: identifier → email/phone → OTP/password → activate. Handles login **and** register. Opened via `useAuthDialog().openAuthDialog(cb?)`; singleton mounted in `App.tsx`. Reuses `DepositCard` on activate step. |

## paywall — `src/components/paywall/`

Credit-gated unlock dialogs + lock chrome. **Reuse before building new:** wrap any gated content in `LockedBlur`; open the matching `*PaywallDialog` — never re-implement credit deduction (that's `useCredits`).

| Component | Purpose |
|---|---|
| `AssetPaywallDialog.tsx` | Unlock asset contact — **permanent** (`unlockAsset`, `ASSET_COST` 59) |
| `CompanyPaywallDialog.tsx` | Track auction company — **time-limited/stacking** tiers (99/299/1990) |
| `OwnerPaywallDialog.tsx` | Track asset owner — time-limited tiers (49/149/995) |
| `DeepReportPaywallDialog.tsx` | Unlock deep report period — key `"{slug}:{periodId}"`, `expandUnlock` (990/2490/8900) |
| `LockedBlur.tsx` | Blur-over-content lock with teaser + CTA — the reusable gate wrapper |
| `CreditBalanceChip.tsx` | Header/nav credit-balance pill |

## company-onboarding — `src/components/company-onboarding/`

Auction-company KYC at `/dang-ky-to-chuc` (M1 auth → M2 KYC → M3 deposit). See CLAUDE.md § Company Onboarding.

| Component | Purpose |
|---|---|
| `M2KYC.tsx` | M2 orchestrator: renders the 4 section cards + sticky `ReviewPanel` |
| `DepositCard.tsx` | M3 deposit confirmation card (also reused inside `AuthDialog` activate step) |
| `M2/CompanyTypeahead.tsx` | Section A — typeahead search over `auction_organizations` |
| `M2/KYCForm.tsx` | Section B–D form: role, identity (CCCD/passport, phone OTP, email), doc uploads |
| `M2/ReviewPanel.tsx` | Sticky sidebar summary computed from `sectionStatus(form)` |
| `M2/Step5PendingReview.tsx` | Post-submit `PENDING_KYC` waiting screen |
| `M2/TrustSignals.tsx` | Trust badges beside the form |
| `M2/sectionStatus.ts` | **Logic (not a component):** per-section completeness → drives `ReviewPanel` |

## report (public market report) — `src/components/report/`

Recharts dashboards at `/report`, `/report/:slug` (bds/opp/outcomes). Deep periods are paywalled. **Reuse before building new:** `DeepReportGate`/`DeepReportPreview`/`ReportLockedCTA` for gating; `Report*` shells for layout; per-vertical `*Section*` for chart blocks.

| Group | Notable components |
|---|---|
| Shell / nav | `ReportHero`, `ReportTopNav`, `ReportTOC`, `ReportSection`, `ReportHighlights`, `CategoryFilterTabs`, `PeriodFilterTabs`, `PeriodPickerCompact` |
| Gating | `DeepReportGate`, `DeepReportPreview`, `ReportLockedCTA`, `ReportSubscribeForm` |
| Generic sections | `SectionOverview`, `SectionPriceTrend`, `SectionCategories`, `SectionCompetition`, `SectionOutcomes` |
| `bds/` (bất động sản) | `BdsReportContent` + `BdsHero/Highlights/TOC/FinalCTA` + sections `Delta`, `Distribution`, `HallOfFame`, `Outcomes`, `PriceMap`, `PriceTrend` |
| `opp/` (cơ hội) | `OppSessionTable`, `OppCharts`, `OppFilterBar`, `OppDrawer`, `OppConfirmDialog` |
| `outcomes/` (kết quả) | `OutcomesContent` + `OutcomesHero/Highlights/TOC/FinalCTA` + sections `ByCategory`, `ByRegion`, `ByValue`, `Trend`, `MarketRate`, `Reauction`, `HallOfFame` |

## auction — `src/components/auction/`

Auction-detail sub-components (`/auctions/:id`). Owner/asset cards behind paywall.

| Component | Purpose |
|---|---|
| `AuctionQuickInfo.tsx` / `AuctionInfoTable.tsx` / `AuctionScheduleInfo.tsx` | Header + fact tables + schedule |
| `AuctionAssetCard.tsx` / `AuctionAssetOwnerCard.tsx` | Asset & owner blocks (owner card is paywalled) |
| `AuctionOrganizerInfo.tsx` | Organizing company block |
| `AuctionPriceHistory.tsx` / `AuctionPriceRow.tsx` / `AuctionPricePrediction.tsx` | Price session history + prediction |
| `AuctionAttachments.tsx` / `AuctionSimilarAssets.tsx` | Docs + related listings |

## listings — `src/components/listings/`

Listing-detail sub-components (`/listings/:id`).

| Component | Purpose |
|---|---|
| `AuctionInfoCard.tsx` / `AuctionDetailTable.tsx` | Auction summary + detail spec table |
| `AssetOwnerCard.tsx` / `OrganizationContactCard.tsx` | Owner & organizer contact (paywalled) |
| `LocationMap.tsx` | Leaflet/Mapbox map of the asset |

## profile — `src/components/profile/`

Buyer profile at `/profile`. Tabbed layout.

| Component | Purpose |
|---|---|
| `ProfileSidebar.tsx` | Left nav for profile tabs |
| `tabs/ProfileInfoTab.tsx` / `PasswordTab.tsx` / `NotificationsTab.tsx` | Account settings tabs |
| `tabs/CreditsTab.tsx` | Balance + `credit_transactions` ledger |
| `tabs/SavedAssetsTab.tsx` / `MyAssetsTab.tsx` | Saved & unlocked assets |
| `tabs/CompanyTab.tsx` | Linked auction-company (KYC) status |
| `sections/ProfileBasicSection.tsx` / `ProfileIntentSection.tsx` / `PhoneOtpDialog.tsx` | Reusable profile field sections + phone-OTP dialog |

## demand — `src/components/demand/`

Buyer demand-tracking (nhu cầu). Paywalled matches.

| Component | Purpose |
|---|---|
| `DemandStatusBadge.tsx` | Demand-subscription status pill |
| `DemandPaywallDialog.tsx` | Gate for matched-demand reveal |
| `DemandEmptyMatch.tsx` / `DemandUpsellBanner.tsx` | Empty state + upsell |

## onboarding — `src/components/onboarding/`

First-run reward tasks (credit incentives). Pairs with `HomepageRewardBanner`.

| Component | Purpose |
|---|---|
| `RewardTasksDialog.tsx` | List of reward tasks + progress |
| `RewardClaimDialog.tsx` | Claim credits for a completed task |

---

## ═══ Asset-owner (chủ tài sản) portal cluster ═══

Everything under `/tro-thanh-chu-tai-san` (KYC) and `/chu-tai-san/*` (portal). This is the Layer-3 owner side — distinct from the auction-company capability portal below.

### owner-portal — `src/components/owner-portal/`
Shell for `/chu-tai-san/*`, shown to users as **"Trạm Điều Hành"** — or **"Tháp Điều Hành"** when the selected workspace is an HQ with a linked branch the user reads (Phase 15a, `useOwnerPortalName()` / `ownerPortalName()`; never hard-code the name). **Reuse:** `OwnerPortalLayout` wraps every owner page. The nav lives in `owner-nav-config.ts` (`OWNER_NAV_GROUPS`). No desktop top bar: credit balance + profile menu (Quay lại Marketplace / Mua thêm credit / Đăng xuất) sit at the sidebar foot (`OwnerPortalAccountMenu`); mobile gets a thin `OwnerPortalMobileBar` (hamburger + portal name). The layout sets the tab title (`<page> · <portal name>`) from `owner-page-titles.ts` — a new route needs its own entry there.

| Component | Purpose |
|---|---|
| `OwnerPortalLayout.tsx` / `OwnerPortalSidebar.tsx` / `OwnerPortalMobileBar.tsx` | Portal shell (no desktop top bar) |
| `OwnerPortalAccountMenu.tsx` | Sidebar foot: credit row → `/chu-tai-san/credits` + profile dropdown (Quay lại Marketplace, Mua thêm credit, Đăng xuất) |
| `owner-nav-config.ts` | Grouped nav: Điều hành (Tổng quan / Chỉ tiêu / Tài sản / Kết quả phiên) · Tác nghiệp (Số hoá tài sản / Ký gửi đấu giá / Hợp đồng mua bán / Thu tiền) · Phân tích (Phân tích danh mục / Dòng tiền / Báo cáo định kỳ) · Thiết lập (Chi nhánh / Thành viên / Liên kết / Credit). Count badges (none on Tổng quan): `owner-consignment`, `owner-sale`, `owner-link-requests`, `owner-awaiting-payment` (Thu tiền = `useOwnerPulse().awaitingPayment`, same list as the "Chờ thu tiền" row on Tổng quan) |
| `OwnerWorkspaceSwitcher.tsx` | Sidebar dropdown (under the portal name) to switch workspace; shown only when the user belongs to ≥ 2 workspaces. The layout remounts the outlet on a real switch. Linked branch Trạm (Phase 14) show "Trụ sở · chỉ xem" via `ownerWsAccessLabel`. |
| `ReportTOC.tsx` | Report table-of-contents |

### asset-owner-portal — `src/components/asset-owner-portal/`
Dashboard ("Tổng quan") + 4-layer owner report. **New owner UI must use the `ui/` blocks** (see design-system.md → Owner portal).

| Group | Components |
|---|---|
| `ui/` | `OwnerPageHeader`, `SectionCard`, `HeroFigure`, `StatTile`, `ActionCard`, `EmptyState`, `IconTile` — shared building blocks (plan §A8.6). **The only tab / search / filter controls:** `OwnerTabs` (`OwnerTabBar`, `OwnerTabsList`, `OwnerTabsTrigger`), `OwnerSearchInput`, `OwnerFilterSelect`, `OwnerFilterBar` (see design-system.md → Owner portal). `OwnerNoWorkspaceState` wraps a workspace-only page's empty state: on the "Cá nhân" tenant it offers to switch to the user's workspace instead of the KYC CTA. |
| `pulse/` | Phase 7 to-do queues with inline actions — since 2026-09-27 they live on the page that owns the work, NOT on "Tổng quan" (its to-do list only links here):<br>• `OutcomeDueBlock` — "Chờ khai kết quả", top of `/chu-tai-san/ket-qua`; the buttons open `ReportOutcomeDialog` with `defaultKind`<br>• `AwaitingPaymentBlock` — "Chờ thu tiền" with quick actions (not mounted now: payment actions incl. "Người trúng bỏ cọc" live on the "Thu tiền" page `/chu-tai-san/thu-tien` via `CashFlowDialogs`; the Overview row links there)<br>• `PartialPaymentDialog` (amount received THIS time → a `payment` entry), `ConfirmDefaultDialog`<br>• `PulseListParts` (`ShowAllToggle`, which expands in place; `PulseListSkeleton`; `ReadOnlyNote`)<br>Data comes from `useOwnerPulse()`; the rules are in `src/lib/ownerPulse.ts`, the payment form in `src/lib/ownerOutcomePayment.ts`; "Đã thu đủ" = `useSettleOutcome` (Phase 15a) |
| `targets/` | Phase 9 "Chỉ tiêu" (redesign 2026-09-27) — list `OwnerTargetsPage`, detail `OwnerTargetDetailPage`, form `OwnerTargetFormPage` (`/chi-tieu/moi`, `/chi-tieu/:id/sua`); the Overview's target block is `overview/RevenueTargetBlock`:<br>• Blocks: `PeriodTile` (Tháng 9 / Quý III / Năm 26), `TargetStatusPill`, `TargetProgressBar` (elapsed marker, tone normal/behind/failed), `TargetScopeLabel`, `TargetCrumb`, `targetStyles.ts`<br>• List: `TargetList` (groups Kỳ đang diễn ra / Sắp tới) → `TargetListRow` (`<Link>` card row)<br>• Detail: `TargetDetailHeader` (hero card, `children` = `TargetSummaryCard` band), `TargetCriterionCard` (selected = ring + pointer), `TargetContributionCard` (split bar, 5 rows/page, footer total = actual)<br>• Form: `TargetEditor` (RHF + `targetFormSchema`) → `TargetFormSection`, `TargetPeriodFields` (conflict warning), `TargetCriteriaFields` (1..4, "Kỳ trước" hint), `TargetFormPreview`<br>Data: `useOwnerTargetProgress()` / `useOwnerTargetsBoard()` / `useOwnerTargetDetail(id)` / `useOwnerTargetEditor(id)` (`src/hooks/useOwnerTargets.ts`); save = RPC `owner_save_target`; rules in `src/lib/ownerTargets.ts`, display helpers in `src/lib/ownerTargetView.ts` |
| `pipeline/` | Phase 12 "Tài sản" kanban on `/chu-tai-san/tai-san` (read-only, no DnD):<br>• `AssetViewToggle` — "Bảng" / "Giai đoạn" (`ToggleGroup`); constants `OWNER_ASSETS_VIEWS` / `OWNER_ASSETS_VIEW_KEY` in `assetsView.ts`, remembered via `useStoredChoice`<br>• `PipelineView` — container: summary line, "chờ xác nhận" hint, postings error, empty state<br>• `PipelineBoard` → `PipelineColumn` (empty columns narrow to `w-44`, "Xem thêm" after 20) → `PipelineCard` (whole card = one button; red only on the days chip)<br>Data: `useOwnerPipeline({ claims, outcomesByListing, loading })`; rules in `src/lib/ownerPipeline.ts`, adapters + posting select in `src/lib/ownerPipelineFacts.ts` |
| `overview/` | "Tổng quan" `/chu-tai-san/dashboard` (redesign 2026-09-27), 4 blocks in priority order:<br>• `OverviewFilters` — Đơn vị (Toàn đơn vị / branch) + Kỳ (Tháng/Quý/Năm), both `OwnerFilterSelect`, in the page header, URL state `?scope=&period=`; Đơn vị filters every block, Kỳ only the target + analysis blocks<br>• `RevenueTargetBlock` (gradient card, hero + % badge, `RecoveryBar` 3 parts recorded/estimated/hatched awaiting clipped at the goal, white `TargetGapCard`; count-only targets fall back to sold count)<br>• `PortfolioAnalysisBlock` = `CumulativeWinChart` (Recharts line, this period solid primary vs same period last year dashed muted — hidden when last year is empty; sr-only table) + `OverviewKpiGrid` (2×2, cross dividers, "▲/▼ X% so với cùng kỳ năm trước" coloured by good/bad; success rate in points)<br>• `TodoListBlock` — one list, one row per kind (count, oldest item's name, amount); rows only link to the owning page, zero rows hidden<br>• `AuctionCalendarBlock` — next 7 days grouped by day, today on `bg-primary/5`<br>Data: `useOwnerOverview()` (`src/hooks/useOwnerOverview.ts`, reuses pulse/targets/outcomes caches + `["pending-claims-dashboard", ws]`); pure lib `src/lib/ownerOverview.ts` |
| `dashboard/` | `DashboardBlurPreview` (unused) |
| `outcomes/` | `OutcomeSourceBadge` (source label §A3 + "Lệch số liệu" chip with tooltips — also fits `StatTile`'s `badge` slot), `OutcomeResultCell` ("Kết quả" cell: full price + badge). Data comes from `useOwnerAssetOutcomes(workspaceId)` → `byListing`; types and labels are in `src/lib/ownerOutcomes.ts`. **`ReportOutcomeDialog`** (Phase 6: "Khai kết quả", props `{ open, onOpenChange, workspaceId, target: ReportOutcomeTarget, defaultKind? }`; build `target` from a claim with `claimToReportTarget`) with sub-parts `OutcomeSoldFields` / `OutcomeNotSoldFields`. The form logic is pure in `src/lib/ownerOutcomeReport.ts` and the write lives in `useReportOwnerOutcome` (`src/hooks/useOwnerOutcomeReports.ts`). Phase 8 additions:<br>• the dialog also takes `target: { kind: "offplatform", … }` (renders `OffPlatformAssetFields`, saved via `useSaveOwnerOutcome`) and `record` for edit mode, plus `branches` / `branchScope`<br>• `AssetIdTag` — "Mã 3F9A12BC"; the code comes from `shortAssetId` in `src/lib/ownerAssetId.ts` |
| `outcomes-page/` | Phase 8 `/chu-tai-san/ket-qua` (`src/pages/chu-tai-san/OwnerOutcomesPage.tsx`):<br>• `OutcomeTotals` (`OutcomeHero` L1 + `OutcomeStatGrid` L3)<br>• `OutcomeConflictCards` (L2)<br>• `OutcomeFilters` (URL state)<br>• `OutcomesTable` — stacked rows below md; the row's title is a stretched button, so the badge tooltips stay clickable<br>• `OutcomeConflictSheet` — sources side by side with "Giữ số của tôi" / "Dùng số của …", plus `OutcomeRoundHistory` (edit/delete) and `DeleteOutcomeRoundDialog`; `OutcomeSourceCard`<br>• `OutcomeImportDialog` + `OutcomeImportPreview`<br>Data comes from `useOwnerOutcomesOverview` / `useOwnerOutcomeHistory` (`src/hooks/useOwnerOutcomesOverview.ts`), `useSaveOwnerOutcome` / `useDeleteOwnerOutcome` / `invalidateOwnerOutcomes` (`useOwnerOutcomeEdit.ts`), `useImportOwnerOutcomes`, and `useResolveOutcomeConflict`. Pure libs: `ownerOutcomesOverview.ts`, `ownerPeriods.ts`, `ownerOutcomeImport.ts`, `ownerOutcomeEdit.ts` |
| `periodic-report/` | Phase 10 "Báo cáo định kỳ" — pages `OwnerPeriodicReportsPage` / `OwnerPeriodicReportDetailPage` / `OwnerPeriodicReportPrintPage` in `src/pages/chu-tai-san/` (`/chu-tai-san/bao-cao-dinh-ky`, `…/:id`, `…/:id/in`; the print route sits OUTSIDE `OwnerPortalLayout`):<br>• **`ReportDocument`** `{ payload, status, variant: "screen" \| "print" \| "shared" }` — the 6 sections of §A5 (`ReportTargetsSection` + `ReportHero`, `ReportResultsSection`, `ReportMoneySection`, `ReportStuckSection`, `ReportPlanSection`, `ReportNotesSection`). Display only<br>• **`ReportSheet`** `{ payload, status, variant: "print" \| "shared", footerNote }` — the A4 sheet (`@page` CSS, header with unit / period / scope / status, `ReportDocument`, footer with logo) shared by the print route and P11's `/r/:token`; each page adds its own toolbar<br>• `ReportTable` — generic L4 table: real `<table>` in print (header repeats, rows never split), stacked rows below md on screen, "Xem thêm" after 20. Variant `shared` = stacked + paginated on mobile, full table on md+ and in print; `AssetCell` (title + "Mã …"/"Ngoài sàn" + branch)<br>• `ReportSourceLabel` — `OutcomeSourceBadge` on screen, plain text in print (§A8.9); `shared` renders both, switched by `print:`<br>• **`ReportShareCard`** `{ report, canShare }` (P11, final reports only) — "Chia sẻ với trụ sở": link + copy / "Gia hạn" / "Thu hồi" for `send_report`, status only for other members; `ShareReportDialog` (7/30/90 days, create or extend mode), `RevokeShareDialog`; `SharedReportCta` (the "Tháp Điều Hành" CTA on `/r/:token`, hidden in print). Hooks `src/hooks/useOwnerReportShare.ts`, pure lib `src/lib/ownerReportShare.ts`<br>• `ReportsTable` (list), `CreateReportDialog` (period type → period → scope; scoped staff only get their branches), `ReportNotesCard` (form owned by the page so "Chốt" can save unsaved notes first), `FinalizeReportDialog`, `DeleteReportDialog` (drafts only)<br>Data: `src/hooks/useOwnerPeriodicReports.ts`; pure libs `src/lib/ownerPeriodicReport.ts` (payload types + tolerant `mapReportPayload`, periods, Zod, errors, `canDraftReport`/`canFinalizeReport`) and `src/lib/ownerPeriodicReportExcel.ts` (`buildReportWorkbook`, 5 sheets) |
| `members/` | Phase 3 `/chu-tai-san/thanh-vien`:<br>• `OwnerMembersTable` — collapses to stacked rows below md<br>• `OwnerInvitesCard` — copy / revoke / "Mời lại"<br>• `InviteOwnerMemberDialog` — RHF + Zod, then a link step via `InviteLinkPanel url=`<br>• `EditOwnerMemberDialog`, `RemoveOwnerMemberDialog`<br>• `BranchScopePicker`, `scopeLabel(isOwner, …)` — role picked with `roles/OwnerRolePicker` (roles from DB)<br>• `JoinedWorkspacesCard` — entry card in `/profile?tab=my-assets` for invited members without KYC |
| `roles/` | `/chu-tai-san/vai-tro(/:id)` (2026-09-27):<br>• `OwnerRolesTable`, `OwnerRoleFormDialog` (name/description + copy from role), `DeleteOwnerRoleDialog` (blocked while members/invites)<br>• `OwnerPermissionMatrixEditor` — adapter over `permissions/PermissionMatrixEditor` (now accepts per-module `actionLabels` / `hint`), implied "Xem" via `normalizeOwnerMatrix`<br>• `OwnerRolePicker` — radio of workspace roles with `lockedReason` (anti-escalation via `roleWithinCaller`)<br>• hooks `useOwnerWsRoles` + create/update/delete/set-permissions mutations; `OwnerPermissionGate` in `owner-portal/` |
| `links/` | Phase 14 `/chu-tai-san/lien-ket` (`src/pages/chu-tai-san/OwnerLinksPage.tsx`):<br>• `BranchLinkSection` — current HQ + incoming requests ("Đồng ý" opens `AcceptLinkDialog`, which states what HQ sees; "Từ chối")<br>• `HqLinkSection` — child entities from the directory with their state (no Trạm / available / pending / linked / linked elsewhere) and "Gửi yêu cầu liên kết" / "Rút yêu cầu" / "Huỷ liên kết"<br>• `ConfirmUnlinkDialog` `{ target: { childWorkspaceId, otherName, side } }`<br>Data: `src/hooks/useOwnerWorkspaceLinks.ts` (`useOwnerLinkOverview`, `usePendingLinkRequestCount` for the nav badge `owner-link-requests`, request / cancel / respond / unlink mutations) |
| `cash-flow/` | Phase 15a, split 2026-09-27 into **Thu tiền** `/chu-tai-san/thu-tien` (`OwnerCollectionsPage`) and **Dòng tiền** `/chu-tai-san/dong-tien` (`OwnerCashFlowPage`):<br>• Shared: `CashScopeSelect` / `CashPeriodSelect` (`CashFlowFilters.tsx`, pill selects "Đơn vị" / "Kỳ"; scope only when > 1 unit), `CashFlowPageStates` (skeleton / no workspace / load error), `AssetLine`<br>• Thu tiền: `CollectionBuckets` (3 due buckets = toggle filter, `aria-pressed`), `CollectionReceivablesTable` (due chip + Đổi hạn / Ghi thu / ⋯ Người trúng bỏ cọc via non-modal `DropdownMenu`), `CashLedgerTable` (tab Đã ghi, edit / delete)<br>• Dòng tiền: `CashReportHero` (Thực nhận + Đã thu / Còn phải thu / Tỷ lệ thu, token gradient over `bg-card`), `CashRecoveryBars` (5-step HTML waterfall, labels + values as text, bars aria-hidden), `CashFlowInfoNotes` (platform / untracked sold + CTA), `UnitRecoveryTable` (HQ), `CashForecastCard` (stacked owed + hatched estimate)<br>• Dialogs through one `CashFlowDialogs` switch (`cashFlowDialogState.ts`): `CashEventDialog` (add / edit, asset picker = own writable tracked rows), `DeleteCashEventDialog`, `PaymentDueDialog` ("Đổi hạn thu"), `ConfirmDefaultDialog` (from `pulse/`)<br>Data: `src/hooks/useOwnerCashFlow.ts` (`useOwnerCashFlow`, `useCashCanWrite`, `useSaveCashEvent`, `useDeleteCashEvent`, `useSetPaymentDue`, `useSettleOutcome`); pure libs `src/lib/ownerCashFlow.ts` (payload, scope, cohort waterfall, receivables + due buckets, unit recovery, forecast, estimate, `buildCollectionsView` / `buildCashReportView`), `src/lib/ownerCashFlowExcel.ts` (Xuất Excel) and `src/lib/ownerCashEvent.ts` (kinds, Zod, granted-column payload builders, messages) |
| `contracts/` | Menu "Hợp đồng" `/chu-tai-san/hop-dong` (`OwnerContractsPage`, detail pages `OwnerConsignmentContractPage` / `OwnerServiceContractPage`; mua bán = `SaleContractPage embedded`): `ContractRowItem` `{ row: ContractListRow, onOpen }` — one row for all 3 types (icon tile by type, code, status + action badges, counterparty, value). Data `useOwnerContracts()` / `useOwnerContractActionCount()` (badge `owner-contracts`) / `useOwnerConsignmentContract(id)` in `src/hooks/useOwnerContracts.ts`; normalizers `src/lib/contracts/rows.ts` (`fromConsignment`, `fromSale`, `fromService`, `CONTRACT_TABS`, `CONTRACT_TONE_CLASS`) |
| `benchmark/` | Phase 14 `BenchmarkBlock` at the bottom of "Phân tích danh mục" `/chu-tai-san/bao-cao` (moved off "Tổng quan" 2026-09-27; ignores the report filters) — anonymous comparison with sibling branches; renders nothing when unavailable or for HQ-access tenants. Data `useOwnerBenchmark` (RPC `owner_ws_benchmark`, 10-min staleTime); pure lib `src/lib/ownerBenchmark.ts` (`parseBenchmark`, `positionSentence`, `bandGeometry`) |
| `report/` | `ReportHeader`, `ReportLayer2`, `ReportLayer3`, `ReportLayer4` (progressive deep-report layers) |
| `report-filter/` | `FilterDimensions`, `ReportConfirmDialog` |
| `shared/` | `PortfolioOverviewBlock` (owner report view), `PortfolioAttentionCount` (unused) |

### asset-owner-onboarding — `src/components/asset-owner-onboarding/`
KYC at `/tro-thanh-chu-tai-san` — 2 branches (individual / organization), org has Tier1 + Tier2 (auto-claim).

| Group | Components |
|---|---|
| root | `BranchSelector`, `PreFillBanner`, `StatusScreen` |
| `individual/` | `PersonalInfoSection`, `EKYCSection`, `TermsSection` |
| `organization/tier1/` | `OrgInfoSection`, `OrgDocsSection`, `RepInfoSection`, `RepEKYCSection`, `RegistryMatchBanner` |
| `organization/tier2/` | `SeedSetupSection`, `ManualClaimSearch`, `ClaimResultList` (Tier-2 auto-claim of assets) |

### asset-posting — `src/components/asset-posting/`
"Số hoá / Đăng tài sản đấu giá" 5-step wizard at `/chu-tai-san/dang-tai-san`. Backed by `useAssetPosting.ts` + `lib/orgMatching.ts`; table `asset_postings`. **Reuse:** `DeltaFieldsSection`/`DeltaFieldInput` for the delta-fields pattern; `OrgMatchCard`/`OrgComparisonTable` for org matching.

| Component | Purpose |
|---|---|
| `AssetPostingWizard.tsx` / `WizardProgress.tsx` / `wizardSchema.ts` | Wizard shell, stepper, Zod schema |
| `steps/Step1AssetType…Step5MatchAndSend.tsx` | The 5 steps (type → general → legal → auction needs → match & send) |
| `AssetMediaUpload.tsx` / `AssetDocUpload.tsx` | Media & legal-doc uploads |
| `DeltaFieldsSection.tsx` / `DeltaFieldInput.tsx` | Category-specific "delta" fields (`constants/asset-delta-fields.ts`) |
| `OrgMatchCard.tsx` / `OrgComparisonTable.tsx` | Suggested auction-org matches (client-side `rankOrgs`) |
| `AssetPostingsLanding.tsx` | List `/chu-tai-san/dang-tai-san` (design "So Hoa Tai San - Danh sach & Chi tiet"): tabs Tất cả / Cần bạn xử lý / Đang số hoá / Đang ký gửi / Đã ký hợp đồng + search (`?nhom=&q=`), table `digitize/DigitizeTable` (status dot + 4-segment bar, "Bước tiếp theo", thumb via `digitize/PostingThumb`). Data `hooks/useOwnerDigitizedPostings.ts` (key `qk.ownerDigitizePostings`, under `myPostings`) |
| `AssetPostingDetail.tsx` | Detail `/chu-tai-san/dang-tai-san/:id`: `detail/PostingDetailHeader` (thumb, facts, "Chỉnh sửa", ⋯ menu) + `detail/PostingFlowStrip` (4-step track + one next-step box/CTA), tabs `?tab=` → `detail/PostingOverviewTab` (Specs, LegalStatus, Media + aside AuctionNeeds, `PostingEnhanceCard` → `EnhanceServiceDialog` hosting the full 3D/VR/giám định cards), `detail/PostingLegalTab` (result checklist + "Chuyên gia" aside), `detail/PostingAuctionTab` |
| `digitize/DigitizeStatusParts.tsx` | `DigitizeStatusLabel`, `DigitizeTrackBar`, `DigitizeNextCell` — render a `DigitizeStatus` (`lib/asset-posting/digitizeStatus.ts`) |
| `ConsignmentDetail.tsx` | Thân trang `/chu-tai-san/ky-gui-dau-gia/:id` (design Ký gửi): `KgDetailHeader` + `KgStageBody` (thẻ theo giai đoạn) + `AskCard`/`ActivityCard`; khối ở `src/components/consignment/owner/detail/` |
| `OwnerContractPanel.tsx` | Hợp đồng dịch vụ phía chủ tài sản — dùng ở trang hợp đồng ký gửi của menu Hợp đồng |
| `consignment/owner/*` | Danh sách Ký gửi: `ConsignmentTable`, `OrgDots` (chấm tổ chức), `KgStatusParts` (`ToneLabel`, nhãn + thanh 3 bước + ô bước tiếp theo); chi tiết: `QuoteCompareCard`, `OrgRequestRows`, `SuggestOrgsCard`, `BrokerStatusCard`, `ChosenQuoteCard`, `PickQuoteDialog`, `FindOrgsDialog`, `BrokerRequestDialog` |

Danh sách ký gửi: `pages/chu-tai-san/OwnerConsignmentsPage.tsx` + `hooks/useOwnerConsignments.ts` (một lượt đọc hồ sơ kèm yêu cầu / nhờ sàn / hợp đồng, key `qk.ownerConsignmentPostings` nằm dưới `myPostings`) + luật thuần `lib/consignment/ownerConsignment.ts`.

### asset-owner-management + owner-branches
| Folder | Components |
|---|---|
| `asset-owner-management/` | `ClaimsTable.tsx` — admin/owner view of asset claims |
| `owner-branches/` | `BranchImportDialog.tsx` — bulk-import owner branches |

---

## ═══ Auction-company capability portal cluster ═══

`/portal/*` (and legacy `/broker/*`) — the auction company's own back-office: năng lực (capability), documents, tax, infrastructure, auction history, applications. Shell in `portal/`.

### portal — `src/components/portal/`
| Component | Purpose |
|---|---|
| `PortalLayout.tsx` / `PortalSidebar.tsx` / `PortalTopBar.tsx` / `nav-config.ts` | Portal shell + nav |
| `ScoreBreakdownDialog.tsx` / `ScoreInlineBar.tsx` / `SectionScoreHeader.tsx` | Capability-score UI (reused across năng-lực sections) |
| `ComingSoon.tsx` | Placeholder for unbuilt sections |

### general-info — `src/components/general-info/`
Company profile / legal / bank / branches (năng lực → thông tin chung).
Notable: `CompanyProfileCard`, `OnboardingWizard`, `EditInfoSheet`, `BankAccountsCard`+`BankAccountFormDialog`, `BranchesCard`+`BranchFormDialog`, `EstablishmentDocumentsCard`, `MOJDirectoryStatusCard`, `SensitiveFieldMask`, `InfoField`; `sections/` = `EntityInfoSection`, `AddressContactSection`, `LegalRepSection`, `EstablishmentSection`.

### infrastructure — `src/components/infrastructure/`
Cơ sở vật chất capability. **Reuse:** `PhotoUpload`/`PhotoGrid`/`PhotoLightbox`, `AddressInput`, `SectionScoreBadge`, `SectionFreshnessIndicator`, `SuggestionsCard`. `sections/` = Headquarters / Camera / Archive / Reception / OnlineAuction / Website.

### tax — `src/components/tax/`
Nghĩa vụ thuế capability: `TaxRecordForm`, `YearListTimeline`, `YearCard`, `TaxScoreSummary`, `TaxSuggestionsCard`, `AmountDisplay`, `TargetYearBanner`, `ScoreReferenceBar`, `EmptyState`.

### documents — `src/components/documents/`
Tủ tài liệu (document cabinet) — Supabase Storage + metadata; hooks `useFolders`/`useDocuments`; dnd-kit + react-dropzone.
| Group | Components |
|---|---|
| `main/` | `DocumentGrid/List/Card/Row`, `DocumentToolbar`, `DocumentBulkBar`, `FolderBreadcrumb`, `EmptyState`, `DocumentMainArea` |
| `sidebar/` | `FolderTree`+`FolderTreeNode`, `FolderSidebar`, `QuickFilters`, `TagCloud`, `StorageUsageBar` |
| `modals/` | `UploadModal`+`UploadDropZone`, `FolderFormDialog`, `MoveFolderDialog`, `BulkTagDialog`, `DocumentDetailSheet`, `DocumentPreview`, `VersionHistoryPanel`, `DeleteConfirmDialog` |
| `shared/` | `FileTypeIcon`, `TagBadge`, `ExpiryBadge`, `DocumentContextMenu` |
| root | `DocumentCabinetPage`, `DocumentsTabInModule`, `OnboardingView` |

### applications — `src/components/applications/`
Hồ sơ dự thầu / hồ sơ năng lực builder (5 sections + export).
Notable: `ApplicationScoreHeader`, `ApplicationSummaryBox`, `CopyFromPreviousModal`, `AnnouncementImport`; `sections/` = `Section1Announcement`, `Section2CapacitySummary`, `Section3AuctionPlan/*`, `Section4Criteria/*` (`CriterionCard`, `AddCriterionDialog`), `Section5Export/*` (`ExportButton`, `FormatPicker`, `PreviewModal`, `WarningsList`).

### auction-history — `src/components/auction-history/`
Company's own auction-record log + enrichment + import wizard.
Notable: `AuctionTable`+`AuctionRow`, `AuctionFormDialog`, `AuctionRecordDialog`, `AuctionDetailDrawer`, `AuctionFilterBar`, `AuctionStatsCards`, `QuickFillDialog`+`QuickFillForm`, `AuctionEnrichDialog`, `EnrichmentAlertBanner`, `BulkActionBar`, `SyncStatusBanner`, `AutoSyncEmptyState`, `SourceBadge`; `import/` = 6-step wizard (`ImportDialog` → Upload/ColumnMapping/Preview/Progress/Success).

### auctioneers — `src/components/auctioneers/`
Đấu giá viên roster + conflict/override handling: `AuctioneerTable`, `AuctioneerForm`, `AuctioneerOnboarding`, `AuctioneerStatsCards`, `AuctioneerWarnings`, `AuctioneerSyncBanner`, `ConflictResolutionDialog`, `OverrideFieldDialog`, `SourceBadge`.

---

## admin — `src/components/admin/` + `src/pages/admin/`
Admin console (gated by `AdminRoute`). Components: `AdminLayout`, `RichTextEditor`, `ImageUploadButton`. Pages: `AdminDashboard`(+`Charts`), `AdminKYCPage`/`AdminKYCDetail`, `AdminAssetOwnerKYCPage`/`Detail`, `AdminArticlesPage`/`Editor`, `AdminCategoriesPage`, `AdminContactsPage`, `AdminCollaborationPage`.

### Contracts (admin "Pháp lý & Đấu giá") — `src/components/admin/contracts/`, `src/components/admin/contract-templates/`
- `AdminContractsTable` (list `/admin/hop-dong`, rows from `useAdminContracts` → `src/lib/contracts/adminRows.ts`), `AdminConsignmentContractView` `{ contract, events }` (read-only; do NOT reuse `OwnerContractPanel` for admins — it renders owner actions). Pages `src/pages/admin/contracts/` (`AdminContractsPage`, `AdminContractDetailPages` = ky-gui / mua-ban / dich-vu).
- `TemplateVersionsTable` + `TemplateStatusBadge` (versions per type, VN "today"); pages `src/pages/admin/contract-templates/` (`AdminContractTemplatesPage`, `AdminContractTemplateEditor` — one field per slot, `AdminContractTemplateDetail` — "Xem PDF mẫu" via `templateSamplePdfBlob`).

### service-contracts / contracts — `src/components/service-contracts/`, `src/components/contracts/`
- `ServiceContractPayButton` `{ kind, orderId, price }` — THE "Thanh toán" button of the 4 service order cards; opens `ServiceContractAcceptDialog` `{ kind, orderId, open, onOpenChange }` (terms, "Tải bản xem trước", checkbox, "Đồng ý & thanh toán" → RPC → checkout). Never link a service order straight to `/payment/vnpay`.
- `ServiceContractDetailBody` `{ detail, actions? }` — HDCU page body shared by owner + admin (clauses, parties, acceptance + SHA-256, "Tải PDF").
- `ContractClausesView` `{ templateType, clauses, hideKeys?, showParty? }` — renders a template's slots in schema order (dialog, contract page, admin template detail).

## shared — `src/components/shared/`
Small cross-cutting primitives — **reuse before making your own:** `InfoBox`, `InfoCardShell`, `SectionLabel`, `SessionStatusBadge`, `CopyTextButton`, `AuctionOrgPicker`.
- `AuctionOrgPicker` is a combobox over `auction_organizations`, moved here from `admin/suppliers` in Phase 8.
  - `accountedToggle` (default on) shows "Chỉ tổ chức đã có tài khoản".
  - The directory data comes from `useAuctionOrgDirectory` (`src/hooks/useAuctionOrgDirectory.ts`).

---

## Hooks — `src/hooks/`

**Single points of access — reuse before writing raw Supabase/auth calls.**

| Hook | Purpose |
|---|---|
| `useCredits.tsx` | **The** credit API: balance, `assetUnlocked`/`companyAccess`/`ownerAccess`/`isReportPeriodUnlocked`, `unlockAsset`/`unlockCompany`/`unlockOwner`/`unlockDeepReportPeriod`, `addCredits`, tiers/costs (see CLAUDE.md) |
| `useProfile.ts` / `useAuthState.tsx` / `useAuthGuardedNavigate.tsx` | Auth/profile — use these, **not** raw `getSession`/`profiles` fetches (AuthContext is the single source) |
| `useAssetActions.tsx` / `useListingById.tsx` / `useListingContact.tsx` / `useListingPriceSessions.ts` / `useListingSaveCounts.tsx` | Listing read/save/contact/price-session |
| `useAuctionListings.tsx` / `useAuctionHistory.ts` / `useAuctioneers.ts` / `useAuctionOrgNames.tsx` / `usePropertyTypes.tsx` | Auction & registry data |
| `useAssetPosting.ts` | Asset-posting wizard CRUD + `useMatchedOrgs` (client-side `rankOrgs`) |
| `useAssetOwnerKYC.tsx` / `useAssetOwnerOrgKYC.tsx` / `useAssetOwnerWorkspace.tsx` / `useOwnerPortfolioMetrics.tsx` / `useOwnerReportAccess.tsx` | Asset-owner KYC + portal. `useAssetOwnerWorkspace()` has no arguments: claims plus claim/seed mutations for the current workspace. |
| `useOwnerWorkspace.ts` | **The** way to find the owner workspace:<br>• `useOwnerWorkspace()` → `{ workspaceId, workspace, role, accessVia ('member' | 'hq' | null), branchScope, memberships, can(action), canWriteClaim, selectWorkspace, isPersonal, hasPersonalTenant, tenantKey, canWritePosting(p), canCreatePosting }` (tenant = workspace or "Cá nhân"; `workspaceId` is null on Cá nhân)<br>• `useOwnerWorkspaceMemberships()` — direct memberships, then linked branch Trạm of workspaces I own (`accessVia:'hq'`, role `viewer`, `memberId` null)<br>• `useClaimWriteAccess()` → `{ canWriteClaim(claim), canConfirmAll }`<br>Never query `.eq("owner_user_id")`. |
| `useOwnerWorkspaceMembers.ts` / `useOwnerInviteAccept.ts` | Members (RPC list), invites, branch options; invite / update / remove / revoke mutations through `owner_ws_*` RPCs + `assertOwnerWsRpcOk`; invite preview + accept. |
| `useGeneralInfo.ts` / `useInfrastructure.ts` / `useTaxRecords.ts` / `useCapacityProfile.ts` / `useApplication.ts` / `useIsVerifiedCompany.ts` / `useWorkspaceBranches.tsx` | Company capability portal |
| `useDocuments.ts` / `useFolders.ts` | Document cabinet (Storage + metadata) |
| `useDemandSubscription.tsx` / `useCompanyViewTracker.tsx` / `useNotificationSettings.tsx` / `useOnboardingTasks.tsx` / `useArticles.ts` | Demand, tracking, notifications, rewards, CMS |
| `useAutoSave.ts` / `use-mobile.tsx` / `use-toast.ts` | Autosave, mobile breakpoint, toast (shadcn) |
| `useStoredChoice.ts` | `useState` remembered in localStorage (`src/lib/storedChoice.ts`, try/catch, allowed list + fallback) — per-browser view preferences only |

> For libs/helpers (not components) — `lib/credits.ts`, `lib/orgMatching.ts`, `lib/report*`, `constants/asset-delta-fields.ts`, contexts `AuthDialogContext`/`PaywallContext`/`AuthContext` — see CLAUDE.md § Patterns and `architecture.md`.

### Hồ sơ số hoá theo tenant (Phase 4)
| Path | Purpose |
|---|---|
| `src/components/asset-posting/postingAccess.ts` | `PostingAccessProvider` / `usePostingCanWrite()`. Set by `AssetPostingDetail` from `canWritePosting(posting)`; the default `true` covers the wizard. The action blocks shared with the wizard (3D, VR, giám định, tư vấn, quotes, contract) hide their write buttons through it. |
| `src/components/asset-posting/BranchField.tsx` | "Chi nhánh" select for the wizard (step 2). Hidden on Cá nhân or when the workspace has no branches. Required and scope-limited for scoped staff. |
| `usePostingPartyAddress(postingId)` / `useUpdateOwnerAddress(postingId)` (`useConsignmentContract.ts`) | Bên A address of ONE posting (RPC `owner_posting_party_address`). Edits go to the personal KYC or to the workspace's org KYC. Replaces the old `useOwnerKycAddress`. |
