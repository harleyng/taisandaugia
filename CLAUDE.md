# CLAUDE.md

This file provides guidance to Claude Code when working with the `taisandaugia` repository.

## Project Overview

**Tài Sản Đấu Giá** — a Vietnamese real estate auction marketplace and broker portal. Buyers browse and unlock auction listings; auction companies onboard via a KYC flow to list assets. Built on the Lovable AI platform.

### User Roles

| Role | Entry Point | Key Actions |
|------|-------------|-------------|
| Anonymous visitor | `/`, `/listings` | Browse listings, view market report teasers |
| Authenticated buyer | `/profile`, `/listings/:id` | Save assets, buy credits, unlock asset/company/owner info |
| Auction company rep | `/dang-ky-to-chuc` | Complete KYC onboarding (3 milestones) |

## Commands

```bash
npm run dev      # Dev server on localhost:8080
npm run build    # Production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

### Supabase CLI

```bash
npx supabase db push                  # Apply pending migrations to remote
npx supabase db push --include-all    # Apply all migrations including out-of-order ones
npx supabase migration list           # List migrations and their status
npx supabase gen types typescript --project-id dvdpfjprncvkhfwcvqmp > src/integrations/supabase/types.ts  # Regenerate types after schema changes
```

**IMPORTANT:** Always run migrations yourself using the Supabase CLI — do not ask the user to run them manually.

## Technology Stack

- **Framework:** React 18 + TypeScript + Vite
- **UI:** shadcn-ui (Radix primitives) + Tailwind CSS
- **State:** TanStack React Query (server state), React Hook Form + Zod (forms)
- **Database:** Supabase (PostgreSQL with typed client, project ID `dvdpfjprncvkhfwcvqmp`)
- **Maps:** Leaflet + Mapbox GL
- **Charts:** Recharts
- **PWA:** vite-plugin-pwa (scope `/broker/`, start URL `/broker/dashboard`)
- **Toasts:** sonner + shadcn toast
- **i18n:** Vietnamese UI strings are hardcoded throughout — no i18n library

## Architecture

### Directory Structure

```
src/
├── components/
│   ├── ui/                      # shadcn-ui primitives (do not edit)
│   ├── company-onboarding/      # 3-milestone KYC onboarding flow
│   │   ├── M1AccountCreation.tsx
│   │   ├── M2KYC.tsx + M2/      # KYC form (2-column layout)
│   │   │   ├── KYCForm.tsx
│   │   │   ├── CompanyTypeahead.tsx
│   │   │   ├── Step2SelectTitle.tsx
│   │   │   ├── Step3PersonalInfo.tsx
│   │   │   ├── Step4Documents.tsx
│   │   │   └── sectionStatus.ts
│   │   ├── M3Deposit.tsx
│   │   └── MilestoneProgress.tsx
│   ├── auction/                 # Auction detail sub-components
│   ├── listings/                # Listing detail sub-components
│   ├── paywall/                 # Credits & paywall dialogs
│   ├── report/                  # Market report components (bds/, opp/, outcomes/)
│   ├── profile/                 # Profile page sections & tabs
│   ├── auth/                    # AuthDialog (global modal)
│   ├── demand/                  # Demand tracking components
│   └── onboarding/              # General onboarding components
├── pages/                       # Route page components (23 pages)
├── hooks/                       # Custom React hooks
├── lib/                         # Utilities, mock data, credits logic, report periods
├── contexts/                    # AuthDialogContext, PaywallContext
├── integrations/supabase/       # Supabase client + auto-generated types
├── types/                       # TypeScript type definitions
├── constants/                   # Category slugs, Vietnam locations
└── utils/                       # Formatters
```

### Routing (App.tsx)

```
/                        → Index (homepage, auctions + news + market report)
/listings                → Listings (search & filter grid)
/listings/:id            → ListingDetail
/auctions/:id            → AuctionDetail (with analytics)
/report                  → MarketReport (statistical dashboard)
/report/:slug            → MarketReportCategory
/report/deep/outcomes    → MarketReportOutcomes
/auction-org/:id         → CompanyDetail
/asset-owner/:id         → AssetOwnerDetail (protected)
/dang-ky-to-chuc         → CompanyOnboarding (KYC flow)
/profile                 → ProfilePage (protected)
/buy-credits             → BuyCredits
/payment/vnpay           → VnpayCheckout
/payment-result          → PaymentResult
/auth                    → Auth
/install                 → PWAInstall
/lien-he                 → Contact
/gioi-thieu              → About
/chinh-sach-bao-mat      → PrivacyPolicy
/dieu-khoan-su-dung      → TermsOfUse
```

### Context Provider Order (App.tsx)

Providers wrap in this order — do not reorder:
1. `QueryClientProvider`
2. `TooltipProvider`
3. `AuthDialogProvider`
4. `Toaster` / `Sonner` / `AuthDialog` (global singleton)
5. `BrowserRouter`
6. `PaywallProvider` (must be inside Router — uses `useNavigate` internally)

## Configuration

### Path Aliases

`@/` maps to `./src/` (configured in `vite.config.ts` and `tsconfig.json`).

### Environment Variables

```
VITE_SUPABASE_URL=<supabase_url>
VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key>
VITE_SUPABASE_PROJECT_ID=<project_ref>
```

### Tailwind & Design Tokens

All color tokens are defined as HSL CSS variables in `src/index.css`. **Never add new color values or change existing tokens.**

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `152 60% 26%` | Green — CTAs, stepper, focus rings |
| `--accent` | `43 96% 56%` | Amber — highlights |
| `--success` | `142 76% 36%` | Completed states |
| `--warning` | `38 92% 50%` | Warnings (e.g., company already linked) |
| `--muted-foreground` | `215 16% 47%` | Secondary text |
| `--radius` | `0.5rem` | Input/button border-radius |
| `--sidebar-*` | dark green | Admin/portal/owner-portal nav shells only |

Cards use `rounded-2xl`. All Tailwind classes must map to these tokens (`bg-primary`, `text-muted-foreground`, etc.).

`--primary` and `--success` are now both green, so a chart series can no longer use
`hsl(142 76% 36%)` next to the primary colour — the two read as one. Chart palettes in
`src/components/admin/reports/` pick distinct hues (violet / magenta / red) for the
second series instead.

## Patterns

### Supabase Integration

```typescript
// CORRECT — use the typed client
import { supabase } from "@/integrations/supabase/client";

const { data, error } = await supabase
  .from("auction_organizations")
  .select("*")
  .order("name");
```

There is **no versioned client** in this project. Always import from `@/integrations/supabase/client`.

Types are auto-generated in `src/integrations/supabase/types.ts` — do not edit directly. After any schema migration, regenerate with the `npx supabase gen types` command above.

### Auth

Auth is handled globally via `AuthDialogContext`. To trigger the login modal from any component:

```typescript
import { useAuthDialog } from "@/contexts/AuthDialogContext";

const { openAuthDialog } = useAuthDialog();

// Optional: pass a callback to run after successful login
openAuthDialog(() => doSomethingAfterLogin());
```

`AuthDialog` is a multi-step modal: identifier input → email/phone choice → OTP/password → activation. It handles both login and registration in one flow.

### Paywall / Credits

The paywall context (`PaywallContext`) drives credit-gated dialogs. The underlying credit logic lives in `src/lib/credits.ts`. The `useCredits` hook in `src/hooks/useCredits.tsx` is the single point of access for all credit operations in components.

```typescript
import { useCredits } from "@/hooks/useCredits";

const {
  balance,
  transactions,
  isLoading,
  assetUnlocked,      // (id: string) => boolean
  companyAccess,      // (orgId: string) => CompanyAccess
  ownerAccess,        // (ownerId: string) => OwnerAccess
  isReportPeriodUnlocked,
  unlockAsset,
  unlockCompany,
  unlockOwner,
  unlockDeepReportPeriod,
  addCredits,
  ASSET_COST,
  COMPANY_TIERS,
  OWNER_TIERS,
  CREDIT_PACKAGES,
} = useCredits();
```

**Credit costs:**

| Action | Cost |
|--------|------|
| Unlock asset contact (`ASSET_COST`) | 59 credits |
| Track company — 7 days | 99 credits |
| Track company — 30 days | 299 credits |
| Track company — 1 year | 1,990 credits |
| Track owner — 7 days | 49 credits |
| Track owner — 30 days | 149 credits |
| Track owner — 1 year | 995 credits |
| Deep report — month | 990 credits |
| Deep report — quarter | 2,490 credits |
| Deep report — year | 8,900 credits |

**Credit packages (VND → credits):**

| Key | VND | Credits |
|-----|-----|---------|
| `starter` | 69,000 | 69 |
| `popular` | 179,000 | 190 |
| `value` | 299,000 | 330 |
| `pro` | 499,000 | 600 |
| `max` | 1,999,000 | 2,600 |

**Key behaviors:**
- `unlockAsset` is **permanent** (stored in `user_asset_unlocks`).
- `unlockCompany` / `unlockOwner` are **time-limited** and stack — new purchase extends from existing expiry.
- `unlockDeepReportPeriod` key format: `"{slug}:{periodId}"` (e.g., `"bds:2025-Q1"`). Purchasing a year unlocks all quarters/months within it via `expandUnlock()`.
- All mutations call `invalidate()` on the `["user-credits", userId]` query key to refresh state.

### Forms

React Hook Form + Zod pattern:
```typescript
const schema = z.object({ field: z.string().min(3) });
const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
```

### React Query

```typescript
// Server state
const { data } = useQuery({
  queryKey: ["auction_organizations"],
  queryFn: async () => { /* supabase query */ },
});

// Mutations invalidate queries + show toast
const mutation = useMutation({
  mutationFn: async (payload) => { /* supabase write */ },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["..."] });
    toast.success("Thành công");
  },
});
```

### Button Navigation Pattern

**CRITICAL:** Never use `asChild` with `<Link>` inside `<Button>`. Buttons disappear silently from the DOM with no console error.

```tsx
// DON'T
<Button asChild><Link to="/path">Click</Link></Button>

// DO
const navigate = useNavigate();
<Button onClick={() => navigate("/path")}>Click</Button>
```

### Component Design

- Keep page files under 300 lines by extracting sections into sub-components
- Each modal should be its own component
- Reusable UI patterns (selectors, cards, lists) go in `src/components/[module]/`
- Pages orchestrate components; they don't contain all UI logic

## Company Onboarding Flow

The KYC flow at `/dang-ky-to-chuc` has 3 milestones rendered by `MilestoneProgress`:

| Milestone | Component | Description |
|-----------|-----------|-------------|
| M1 | `M1AccountCreation` | Opens `AuthDialog`. Completes when user is authenticated. |
| M2 | `M2KYC` → `KYCForm` | Full KYC form (2-column layout). Creates `organizations` row with `PENDING_KYC`. |
| M3 | `M3Deposit` | Deposit confirmation to activate the org. |

### M2 KYC Form Structure

The KYC form is broken into 4 section cards with a sticky `ReviewPanel` sidebar:

| Section | Component | Content |
|---------|-----------|---------|
| A | `CompanyTypeahead` | Typeahead search for auction company |
| B | `Step2SelectTitle` | Role selector (legal rep / authorized rep) |
| C | `Step3PersonalInfo` | Identity fields (CCCD/passport, phone OTP, email) |
| D | `Step4Documents` | Legal document uploads |

Progress logic lives in `sectionStatus.ts`. The sidebar is computed from `sectionStatus(form)`.

### KYC Validation Rules

| Field | Rule |
|-------|------|
| Full name | ≥ 3 characters |
| CCCD | 9–12 digits |
| Passport | ≥ 6 characters |
| Phone | `/^0[0-9]{9}$/` — requires OTP verification |
| Email | Valid format only (no domain restriction) |
| File uploads | PDF/JPG/PNG, ≤ 10MB |

### Organization Status Flow

```
organizations.kyc_status:
  PENDING_KYC  → (admin review) → APPROVED | REJECTED
```

## Database

### Key Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Auth-linked user rows; `invoice_info JSONB` for billing |
| `auction_organizations` | Auction company registry (name, tax_code, province, phone, logo_url, org_type) |
| `organizations` | KYC onboarding records (kyc_status, linked user) |
| `organization_roles` | 3 built-in roles: Owner / Manager / Agent |
| `user_credits` | Per-user credit balance (PK = user_id) |
| `credit_transactions` | Append-only ledger of all credit changes |
| `user_asset_unlocks` | Permanent asset unlocks per user |
| `user_company_unlocks` | Time-limited company access (tier + expires_at) |
| `user_owner_unlocks` | Time-limited owner access (tier + expires_at) |
| `user_report_unlocks` | Permanent deep-report period unlocks (key = `{slug}:{periodId}`) |
| `listing_price_sessions` | Price session history per listing |

### Organization Roles

Three default roles are seeded and referenced by the `create_owner_membership` trigger:

| Role | Permissions |
|------|-------------|
| Owner | `ALL_PERMISSIONS` |
| Manager | `CAN_POST_LISTING`, `CAN_INVITE_AGENT`, `CAN_REMOVE_AGENT`, `CAN_MANAGE_LISTINGS`, `CAN_VIEW_ANALYTICS` |
| Agent | `CAN_POST_LISTING`, `CAN_VIEW_OWN_LISTINGS` |

### RLS Policy Convention

All credit/unlock tables have a single `"own rows"` policy: `USING (auth.uid() = user_id)`. Do not expose credit data cross-user.

## Mock Data

The following files in `src/lib/` contain static mock data used while real APIs are being built:

| File | Contents |
|------|----------|
| `mockAuctionSessions.ts` | Sample auction sessions |
| `mockAuctionCompanies.ts` | Sample auction companies (`AuctionCompany` interface) |
| `mockBdsReport.ts` | Real estate market report data |
| `mockOppReport.ts` | Opportunity report data |
| `mockOutcomesReport.ts` | Auction outcomes data |
| `mockCredits.ts` | Sample credit transactions |

**Do not rely on mock data for new features** — connect to Supabase directly.

## Development Workflow

### Phase 1: Analysis

Before writing any code:
1. Understand the user need and identify the end user (buyer, company rep, anonymous visitor)
2. Map the main flow, alternative flows, edge cases, and error states
3. Check if the change touches the auth gate, paywall, credit deduction, or KYC flow
4. Search for existing patterns before creating new code

**Present the analysis and confirm with the user before proceeding.**

### Phase 2: Solution Design

1. Outline files to create/modify
2. Follow component design guidelines (single responsibility, pages < 300 lines)
3. Plan any DB migrations needed

**Get approval before implementation.**

### Phase 3: Implementation

Write code following the patterns above. All UI strings are in Vietnamese — match the existing style and tone.

### Phase 4: Verification

```bash
npm run lint    # Must pass
npm run build   # Must pass
```

Both must pass before considering a change complete.
