# CLAUDE.md

This file provides guidance to Claude Code when working with the `taisandaugia` repository.

## Project Overview

**Tài Sản Đấu Giá** — a Vietnamese real estate auction marketplace. Buyers browse and unlock auction listings; auction companies onboard via a KYC flow to list assets. Built on the Lovable AI platform.

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
npx supabase db push        # Apply pending migrations to remote
npx supabase migration list # List migrations and their status
```

## Technology Stack

- **Framework:** React 18 + TypeScript + Vite
- **UI:** shadcn-ui (Radix primitives) + Tailwind CSS
- **State:** TanStack React Query (server state), React Hook Form + Zod (forms)
- **Database:** Supabase (PostgreSQL with typed client)
- **Maps:** Leaflet + Mapbox GL
- **Charts:** Recharts
- **PWA:** vite-plugin-pwa
- **Toasts:** sonner + shadcn toast
- **i18n:** Vietnamese UI (hardcoded strings, no i18n library)

## Architecture

### Directory Structure

```
src/
├── components/
│   ├── ui/                      # shadcn-ui primitives (do not edit)
│   ├── company-onboarding/      # 3-milestone KYC onboarding flow
│   │   ├── M1AccountCreation.tsx
│   │   ├── M2KYC.tsx + M2/      # KYC form (2-column layout)
│   │   ├── M3Deposit.tsx
│   │   └── MilestoneProgress.tsx
│   ├── auction/                 # Auction detail sub-components
│   ├── listings/                # Listing detail sub-components
│   ├── paywall/                 # Credits & paywall dialogs
│   ├── report/                  # Market report components
│   ├── profile/                 # Profile page sections & tabs
│   ├── auth/                    # AuthDialog (global modal)
│   └── ...                      # Header, Footer, AuctionCard, etc.
├── pages/                       # Route page components
├── hooks/                       # Custom React hooks
├── lib/                         # Utilities, mock data, credits/paywall logic
├── contexts/                    # AuthDialogContext, PaywallContext
├── integrations/supabase/       # Supabase client + auto-generated types
├── types/                       # TypeScript type definitions
├── constants/                   # Category slugs, Vietnam locations
└── utils/                       # Formatters
```

### Routing (App.tsx)

```
/                    → Index (homepage)
/listings            → Listings (search & filter)
/listings/:id        → ListingDetail
/auctions/:id        → AuctionDetail
/report              → MarketReport
/report/:slug        → MarketReportCategory
/auction-org/:id     → CompanyDetail
/asset-owner/:id     → AssetOwnerDetail (protected)
/dang-ky-to-chuc     → CompanyOnboarding (KYC flow)
/profile             → ProfilePage (protected)
/buy-credits         → BuyCredits
/payment/vnpay       → VnpayCheckout
/payment-result      → PaymentResult
/auth                → Auth
```

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

All color tokens are defined as HSL CSS variables in `src/index.css`. **NEVER add new color values or change existing tokens.**

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `210 90% 30%` | Navy — CTAs, stepper, focus rings |
| `--accent` | `43 96% 56%` | Amber — highlights |
| `--success` | `142 76% 36%` | Completed states |
| `--warning` | `38 92% 50%` | Warnings (e.g., company already linked) |
| `--muted-foreground` | `215 16% 47%` | Secondary text |
| `--radius` | `0.5rem` | Input/button border-radius |

Cards use `rounded-2xl`. All Tailwind classes must map to these tokens (`bg-primary`, `text-muted-foreground`, etc.).

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

Types are auto-generated in `src/integrations/supabase/types.ts` — do not edit directly.

### Auth

Auth is handled globally via `AuthDialogContext`. To trigger the login modal from any component:

```typescript
import { useAuthDialog } from "@/contexts/AuthDialogContext";

const { openAuthDialog } = useAuthDialog();

// Optional: pass a callback to run after successful login
openAuthDialog(() => doSomethingAfterLogin());
```

### Paywall / Credits

Paywall checks and credit deductions live in `src/lib/credits.ts`. Dialogs are in `src/components/paywall/`. Credit costs:

| Action | Cost |
|--------|------|
| Unlock asset contact | 59 credits |
| View company (7d/30d/1y) | 99 / 299 / 1990 credits |
| View owner (7d/30d/1y) | 49 / 149 / 995 credits |

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

**CRITICAL:** Never use `asChild` with `<Link>` inside `<Button>`. Buttons disappear silently from the DOM.

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

The KYC flow at `/dang-ky-to-chuc` has 3 milestones:

| Milestone | Component | Description |
|-----------|-----------|-------------|
| M1 | `M1AccountCreation` | Opens `AuthDialog`. Completes when user is logged in. |
| M2 | `M2KYC` → `KYCForm` | Full KYC form (2-column layout). Creates `organizations` row with `PENDING_KYC`. |
| M3 | `M3Deposit` | Deposit confirmation to activate the org. |

### M2 KYC Form Structure

The KYC form is broken into 4 section cards (A/B/C/D) with a sticky `ReviewPanel` sidebar:

| Section | Component | Content |
|---------|-----------|---------|
| A | `CompanyTypeahead` | Typeahead search for auction company |
| B | `Step2SelectTitle` | Role selector (legal rep / authorized rep) |
| C | `Step3PersonalInfo` | Identity fields (CCCD/passport, phone OTP, email) |
| D | `Step4Documents` | Legal document uploads |

Progress logic lives in `sectionStatus.ts`. Sidebar computed from `sectionStatus(form)`.

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

Key tables: `auction_organizations`, `organizations`, `profiles`, `user_credits`, `credit_transactions`, `user_asset_unlocks`, `listing_price_sessions`.

`AuctionCompany` interface (from `src/lib/mockAuctionCompanies.ts`):
```typescript
interface AuctionCompany {
  id: string;
  name: string;
  taxCode: string;
  address: string;
  province: string;
  phone: string;
  linkedAccountId: string | null;
}
```

## Development Workflow

### Phase 1: Analysis

Before writing any code:
1. Understand the user need and who the end user is (buyer, company rep, anonymous visitor)
2. Map the main flow, alternative flows, edge cases, and error states
3. Check impact on auth gate, paywall, or credits system
4. Search for existing patterns before creating new code

**Present analysis and confirm with the user before proceeding.**

### Phase 2: Solution Design

1. Outline files to create/modify
2. Follow component design guidelines (single responsibility, pages < 300 lines)
3. Plan any DB migrations needed

**Get approval before implementation.**

### Phase 3: Implementation

Write code following the patterns above. Vietnamese UI strings are hardcoded — match the existing style and tone.

### Phase 4: Verification

```bash
npm run lint    # Must pass
npm run build   # Must pass
```

Both must pass before considering a change complete.
