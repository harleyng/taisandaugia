# Component Registry — Tài Sản Đấu Giá

> Living document. Update when components are added, removed, or significantly changed.
> Before creating a new component, check here to avoid duplication.

---

## Global / Layout

| Component | File | Purpose |
|-----------|------|---------|
| `Header` | `src/components/Header.tsx` | Site header with nav, auth button, credit balance |
| `Footer` | `src/components/Footer.tsx` | Site footer with links |
| `ProtectedRoute` | `src/components/ProtectedRoute.tsx` | Redirects to auth if no session |

---

## Auth

| Component | File | Purpose |
|-----------|------|---------|
| `AuthDialog` | `src/components/auth/AuthDialog.tsx` | Global auth modal (multi-step: identifier → OTP/password → activate). Singleton — mounted once in App.tsx. Open via `useAuthDialog()`. |

---

## Company Onboarding (KYC)

| Component | File | Purpose |
|-----------|------|---------|
| `MilestoneProgress` | `src/components/company-onboarding/MilestoneProgress.tsx` | Top stepper showing M1/M2/M3 states |
| `M1AccountCreation` | `src/components/company-onboarding/M1AccountCreation.tsx` | Opens AuthDialog; completes when authenticated |
| `M2KYC` | `src/components/company-onboarding/M2KYC.tsx` | Container for the full KYC form |
| `KYCForm` | `src/components/company-onboarding/M2/KYCForm.tsx` | Full form with 4 section cards + sticky ReviewPanel |
| `CompanyTypeahead` | `src/components/company-onboarding/M2/CompanyTypeahead.tsx` | Section A — typeahead search for auction org |
| `Step2SelectTitle` | `src/components/company-onboarding/M2/Step2SelectTitle.tsx` | Section B — legal rep / authorized rep selector |
| `Step3PersonalInfo` | `src/components/company-onboarding/M2/Step3PersonalInfo.tsx` | Section C — CCCD/passport, phone OTP, email |
| `Step4Documents` | `src/components/company-onboarding/M2/Step4Documents.tsx` | Section D — document uploads |
| `M3Deposit` | `src/components/company-onboarding/M3Deposit.tsx` | Deposit confirmation step |

**Key utility:** `src/components/company-onboarding/M2/sectionStatus.ts` — pure function `sectionStatus(form) → { a, b, c, d }` completion states.

---

## Auction

| Component | File | Purpose |
|-----------|------|---------|
| `AuctionCard` | `src/components/AuctionCard.tsx` | Card for auction listing in grid |
| *(Other auction sub-components in `src/components/auction/`)* | — | Detail page analytics, price history, etc. |

---

## Listings

| Component | File | Purpose |
|-----------|------|---------|
| *(Listing sub-components in `src/components/listings/`)* | — | Detail page sections |

---

## Paywall / Credits

| Component | File | Purpose |
|-----------|------|---------|
| *(Paywall dialogs in `src/components/paywall/`)* | — | Credit purchase prompts, unlock tier selectors |

---

## Market Reports

| Component | File | Purpose |
|-----------|------|---------|
| *(BDS report components in `src/components/report/bds/`)* | — | Real estate segment charts |
| *(OPP report components in `src/components/report/opp/`)* | `src/components/report/opp/OppCharts.tsx` etc. | Investment opportunity charts |
| *(Outcomes report in `src/components/report/outcomes/`)* | — | Auction results charts |

---

## Profile

| Component | File | Purpose |
|-----------|------|---------|
| *(Profile sections in `src/components/profile/`)* | — | Credits tab, saved assets tab, billing info |

---

## Contexts (not visual components)

| Context | File | Hook |
|---------|------|------|
| `AuthDialogContext` | `src/contexts/AuthDialogContext.tsx` | `useAuthDialog()` → `{ openAuthDialog, closeAuthDialog }` |
| `PaywallContext` | `src/contexts/PaywallContext.tsx` | `usePaywall()` → `{ openPaywall }` |

---

## Hooks (key hooks)

| Hook | File | Purpose |
|------|------|---------|
| `useCredits` | `src/hooks/useCredits.tsx` | All credit operations — balance, unlock, transactions |
| `useAuctionListings` | `src/hooks/useAuctionListings.tsx` | Fetch and filter auction listings |
| `useAssetActions` | `src/hooks/useAssetActions.tsx` | Save / unsave listings |
| `useOnboardingTasks` | `src/hooks/useOnboardingTasks.tsx` | Track KYC milestone progress |
| `useCompanyViewTracker` | `src/hooks/useCompanyViewTracker.tsx` | Track company profile views (localStorage) |
| `useDemandSubscription` | `src/hooks/useDemandSubscription.tsx` | Demand market subscriptions |
| `usePaywall` | (context hook) | Trigger paywall dialogs |
| `useAuthDialog` | (context hook) | Open/close auth modal |

---

## shadcn-ui Primitives

Located in `src/components/ui/`. Do not edit these files.

Key primitives in use: `Button`, `Card`, `Dialog`, `Tabs`, `Input`, `Select`, `Popover`, `Badge`, `Skeleton`, `Accordion`, `Carousel`, `Command`, `Tooltip`, `Toast`, `Sonner`, `Form`, `Separator`, `Checkbox`, `RadioGroup`.
