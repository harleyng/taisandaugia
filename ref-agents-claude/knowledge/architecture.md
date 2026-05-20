# Architecture — Tài Sản Đấu Giá

> Living document. Updated when architecture patterns are established or changed.

---

## Project Structure

```
taisandaugia/
├── src/                   # Single-portal React app
├── supabase/
│   ├── config.toml        # Project ID: bcusbpkfnydqcvxxjvew
│   └── migrations/        # 56 migrations (Oct 2024–May 2026)
├── CLAUDE.md              # Root project guide
└── ref-agents-claude/     # Agent knowledge base (this folder)
```

Single portal. No dual-schema versioning. No learner portal.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript + Vite |
| UI | shadcn-ui + Tailwind CSS + Radix primitives |
| State | TanStack React Query v5 (server), React Hook Form + Zod (forms) |
| Router | React Router v6 |
| Database | Supabase PostgreSQL (single `public` schema) |
| Auth | Supabase Auth + `@lovable.dev/cloud-auth-js` |
| Maps | Leaflet + Mapbox GL |
| Charts | Recharts v2 |
| PWA | vite-plugin-pwa |
| Toasts | sonner + shadcn toast |
| i18n | None — Vietnamese UI strings are hardcoded |

---

## Supabase Integration

### ⚠️ CRITICAL: Single Client Pattern

```typescript
// ✅ ALWAYS use — there is only one client
import { supabase } from "@/integrations/supabase/client";

const { data, error } = await supabase
  .from("auction_organizations")
  .select("*");

// ❌ NEVER use a versioned client — this project has none
```

The client uses `localStorage` for session persistence with `autoRefreshToken: true`.

### Type Regeneration

After any schema migration:
```bash
npx supabase gen types typescript --project-id bcusbpkfnydqcvxxjvew > src/integrations/supabase/types.ts
```

Never edit `src/integrations/supabase/types.ts` manually.

---

## Key Patterns

### React Query

```typescript
// Lists
const { data } = useQuery({
  queryKey: ["auction_organizations"],
  queryFn: async () => { /* supabase query */ },
  staleTime: 30_000,
});

// Mutations — always invalidate + toast
const mutation = useMutation({
  mutationFn: async (payload) => { /* supabase write */ },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["auction_organizations"] });
    toast.success("Thành công");
  },
});
```

Query keys: `["entity"]` for lists, `["entity", id]` for detail, `["user-credits", userId]` for credit state.

### Forms

```typescript
const schema = z.object({ name: z.string().min(3) });
const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
```

### Auth (global modal)

```typescript
import { useAuthDialog } from "@/contexts/AuthDialogContext";

const { openAuthDialog } = useAuthDialog();
openAuthDialog(() => doSomethingAfterLogin());
```

Never mount `<AuthDialog>` manually — it is a global singleton mounted once in `App.tsx`.

### Credits (always via hook)

```typescript
import { useCredits } from "@/hooks/useCredits";

const { balance, assetUnlocked, unlockAsset, companyAccess, COMPANY_TIERS } = useCredits();
```

Never call `src/lib/credits.ts` functions directly from components — always go through the hook.

### Paywall

```typescript
import { usePaywall } from "@/contexts/PaywallContext";
const { openPaywall } = usePaywall();
```

### Button Navigation

```tsx
// ❌ NEVER — button silently disappears from DOM
<Button asChild><Link to="/path">Label</Link></Button>

// ✅ ALWAYS
const navigate = useNavigate();
<Button onClick={() => navigate("/path")}>Label</Button>
```

---

## Context Provider Order (App.tsx)

Do not reorder — `PaywallProvider` requires Router context:

```
QueryClientProvider
  TooltipProvider
    AuthDialogProvider
      <Toaster /> <Sonner /> <AuthDialog />   ← global singletons
      BrowserRouter
        PaywallProvider
          <Routes>
```

---

## Directory Structure

```
src/
├── components/
│   ├── ui/                      # shadcn-ui primitives — DO NOT EDIT
│   ├── company-onboarding/      # KYC 3-milestone flow
│   │   ├── M1AccountCreation.tsx
│   │   ├── M2KYC.tsx
│   │   ├── M2/                  # KYCForm + sub-sections A/B/C/D
│   │   ├── M3Deposit.tsx
│   │   └── MilestoneProgress.tsx
│   ├── auction/                 # Auction detail sub-components
│   ├── listings/                # Listing detail sub-components
│   ├── paywall/                 # Credit & paywall dialogs
│   ├── report/                  # Market report (bds/, opp/, outcomes/)
│   ├── profile/                 # Profile page tabs & sections
│   ├── auth/                    # AuthDialog
│   └── demand/                  # Demand tracking
├── pages/                       # Route page components (23 pages)
├── hooks/                       # Custom React hooks
├── lib/                         # Credits logic, mock data, report periods, utils
├── contexts/                    # AuthDialogContext, PaywallContext
├── integrations/supabase/       # client.ts + auto-generated types.ts
├── constants/                   # Category slugs, Vietnam locations
├── types/                       # TypeScript type definitions
└── utils/                       # Formatters
```

---

## Routing

```
/                        → Index
/listings                → Listings
/listings/:id            → ListingDetail
/auctions/:id            → AuctionDetail
/report                  → MarketReport
/report/:slug            → MarketReportCategory
/report/deep/outcomes    → MarketReportOutcomes
/auction-org/:id         → CompanyDetail
/asset-owner/:id         → AssetOwnerDetail (protected)
/dang-ky-to-chuc         → CompanyOnboarding (KYC)
/profile                 → ProfilePage (protected)
/buy-credits             → BuyCredits
/payment/vnpay           → VnpayCheckout
/payment-result          → PaymentResult
/auth                    → Auth
```

Protected routes use `<ProtectedRoute>` wrapper (redirects to auth if no session).

---

## Database Key Tables

| Table | Purpose |
|-------|---------|
| `profiles` | Auth-linked user rows; `invoice_info JSONB` for billing |
| `auction_organizations` | Auction company registry |
| `organizations` | KYC onboarding records (`kyc_status`) |
| `organization_roles` | 3 built-in roles: Owner / Manager / Agent |
| `user_credits` | Per-user credit balance (PK = `user_id`) |
| `credit_transactions` | Append-only ledger |
| `user_asset_unlocks` | Permanent asset unlocks per user |
| `user_company_unlocks` | Time-limited company access |
| `user_owner_unlocks` | Time-limited owner access |
| `user_report_unlocks` | Permanent deep-report period unlocks |
| `listing_price_sessions` | Price session history per listing |

All credit/unlock tables have `"own rows"` RLS: `USING (auth.uid() = user_id)`.

---

## Supabase CLI Commands

```bash
npx supabase db push                    # Apply pending migrations
npx supabase db push --include-all      # Apply all including out-of-order
npx supabase migration list             # Check migration status
npx supabase gen types typescript --project-id bcusbpkfnydqcvxxjvew > src/integrations/supabase/types.ts
```

Always run migrations yourself — never ask the user to run them.

---

## Environment Variables

```
VITE_SUPABASE_URL=<url>
VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key>
VITE_SUPABASE_PROJECT_ID=bcusbpkfnydqcvxxjvew
```

---

## Mock Data

Located in `src/lib/`. Used while APIs were being built — do not rely on them for new features.

| File | Contents |
|------|----------|
| `mockAuctionSessions.ts` | Sample auction sessions |
| `mockAuctionCompanies.ts` | Sample auction companies |
| `mockBdsReport.ts` | Real estate market report data |
| `mockOppReport.ts` | Opportunity report data |
| `mockOutcomesReport.ts` | Auction outcomes data |
| `mockCredits.ts` | Sample credit transactions |
