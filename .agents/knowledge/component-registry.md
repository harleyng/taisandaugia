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
Shell for `/chu-tai-san/*`. **Reuse:** `OwnerPortalLayout` wraps every owner page; nav lives in `owner-nav-config.ts` (`OWNER_NAV_SECTIONS`).

| Component | Purpose |
|---|---|
| `OwnerPortalLayout.tsx` / `OwnerPortalSidebar.tsx` / `OwnerPortalTopBar.tsx` | Portal shell |
| `owner-nav-config.ts` | Nav sections (Tổng quan / Tài sản / Số hoá tài sản / Chi nhánh / Báo cáo) |
| `ReportTOC.tsx` | Report table-of-contents |

### asset-owner-portal — `src/components/asset-owner-portal/`
Dashboard + 4-layer owner report.

| Group | Components |
|---|---|
| `dashboard/` | `DashboardBlurPreview`, `PendingConfirmationsBlock`, `StuckAssetsBlock`, `UpcomingAuctionsBlock` |
| `report/` | `ReportHeader`, `ReportLayer2`, `ReportLayer3`, `ReportLayer4` (progressive deep-report layers) |
| `report-filter/` | `FilterDimensions`, `ReportConfirmDialog` |
| `shared/` | `PortfolioOverviewBlock`, `PortfolioAttentionCount` |

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
| `AssetPostingsLanding.tsx` / `AssetPostingDetail.tsx` / `SuccessScreen.tsx` | Landing, detail, post-submit success |

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

## shared — `src/components/shared/`
Small cross-cutting primitives — **reuse before making your own:** `InfoBox`, `InfoCardShell`, `SectionLabel`, `SessionStatusBadge`.

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
| `useAssetOwnerKYC.tsx` / `useAssetOwnerOrgKYC.tsx` / `useAssetOwnerWorkspace.tsx` / `useOwnerPortfolioMetrics.tsx` / `useOwnerReportAccess.tsx` | Asset-owner KYC + portal |
| `useGeneralInfo.ts` / `useInfrastructure.ts` / `useTaxRecords.ts` / `useCapacityProfile.ts` / `useApplication.ts` / `useIsVerifiedCompany.ts` / `useWorkspaceBranches.tsx` | Company capability portal |
| `useDocuments.ts` / `useFolders.ts` | Document cabinet (Storage + metadata) |
| `useDemandSubscription.tsx` / `useCompanyViewTracker.tsx` / `useNotificationSettings.tsx` / `useOnboardingTasks.tsx` / `useArticles.ts` | Demand, tracking, notifications, rewards, CMS |
| `useAutoSave.ts` / `use-mobile.tsx` / `use-toast.ts` | Autosave, mobile breakpoint, toast (shadcn) |

> For libs/helpers (not components) — `lib/credits.ts`, `lib/orgMatching.ts`, `lib/report*`, `constants/asset-delta-fields.ts`, contexts `AuthDialogContext`/`PaywallContext`/`AuthContext` — see CLAUDE.md § Patterns and `architecture.md`.
