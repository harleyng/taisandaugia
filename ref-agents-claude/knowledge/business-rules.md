# Business Rules — Tài Sản Đấu Giá

> Living document. Updated after every task that changes business logic.

---

## User Roles & Access

| Role | Entry Point | Key Capabilities |
|------|-------------|-----------------|
| Anonymous visitor | `/`, `/listings` | Browse listings, view report teasers, see auction company profiles |
| Authenticated buyer | `/profile`, `/listings/:id` | Save assets, buy credits, unlock contact/company/owner info |
| Auction company rep | `/dang-ky-to-chuc` | Complete KYC onboarding, get listed in marketplace |

---

## Company Onboarding (KYC) Flow

### Milestones

```
M1: Account Creation
  → User is authenticated (AuthDialog opens automatically)
  → Completes when session exists

M2: KYC Form
  → 4-section form (Company → Role → Personal Info → Documents)
  → Creates row in `organizations` with kyc_status = 'PENDING_KYC'
  → Completes when form is submitted successfully

M3: Deposit
  → Deposit confirmation to activate the org
  → Admin manually reviews KYC before approval
```

### Organization Status Flow

```
organizations.kyc_status:
  PENDING_KYC  →  (admin reviews)  →  APPROVED
                                   →  REJECTED
```

### KYC Form Sections

| Section | Component | Content |
|---------|-----------|---------|
| A — Company | `CompanyTypeahead` | Typeahead search → selects from `auction_organizations` |
| B — Role | `Step2SelectTitle` | Legal rep OR authorized rep |
| C — Personal | `Step3PersonalInfo` | CCCD/passport, phone (OTP-verified), email |
| D — Documents | `Step4Documents` | PDF/JPG/PNG uploads ≤ 10MB each |

Progress computed by `sectionStatus.ts`. Sidebar ReviewPanel reflects current completion.

### KYC Validation Rules

| Field | Rule |
|-------|------|
| Full name | ≥ 3 characters |
| CCCD | 9–12 digits |
| Passport | ≥ 6 characters |
| Phone | `/^0[0-9]{9}$/`, requires OTP verification |
| Email | Valid format |
| File uploads | PDF/JPG/PNG, ≤ 10MB |

---

## Credit System

### Overview

Credits are the marketplace's purchase currency. All credit data is DB-persisted and user-scoped via RLS. The `useCredits` hook is the **only** access point from components.

### Credit Costs

| Action | Cost | Type |
|--------|------|------|
| Unlock asset contact (`ASSET_COST`) | 59 | Permanent |
| Track company — 7 days | 99 | Time-limited, stackable |
| Track company — 30 days | 299 | Time-limited, stackable |
| Track company — 1 year | 1,990 | Time-limited, stackable |
| Track owner — 7 days | 49 | Time-limited, stackable |
| Track owner — 30 days | 149 | Time-limited, stackable |
| Track owner — 1 year | 995 | Time-limited, stackable |
| Deep report — month | 990 | Permanent, expands to all months in period |
| Deep report — quarter | 2,490 | Permanent, expands to all months in quarter |
| Deep report — year | 8,900 | Permanent, expands to all months in year |

### Credit Packages (VND → credits)

| Key | VND | Credits |
|-----|-----|---------|
| `starter` | 69,000 | 69 |
| `popular` | 179,000 | 190 (popular badge) |
| `value` | 299,000 | 330 |
| `pro` | 499,000 | 600 |
| `max` | 1,999,000 | 2,600 (best badge) |

### Key Behaviors

- **Asset unlock** is permanent (`user_asset_unlocks`). Attempting to unlock an already-unlocked asset returns `{ ok: true, reason: "already" }` — no charge.
- **Company/owner unlock** is time-limited. Purchasing while an existing unlock is active **extends from the existing expiry** (not from now).
- **Deep report unlock** stores per-period keys: `"{slug}:{periodId}"`. Purchasing a year or quarter atomically unlocks all constituent months via `expandUnlock()`.
- **Insufficient balance** returns `{ ok: false, reason: "insufficient" }` — triggers the buy-credits paywall.
- All mutations call `queryClient.invalidateQueries(["user-credits", userId])` after success.

### Credit DB Tables

```
user_credits (user_id PK, balance, updated_at)
credit_transactions (id, user_id, type, description, credit_delta, created_at)
user_asset_unlocks (user_id, listing_id, UNIQUE)
user_company_unlocks (user_id, org_id, tier, expires_at)
user_owner_unlocks (user_id, owner_id, tier, expires_at)
user_report_unlocks (user_id, unlock_key, UNIQUE)
```

All tables: RLS `"own rows"` policy = `USING (auth.uid() = user_id)`.

### Transaction Types

```
"purchase"             — credit top-up via package
"unlock_asset"         — asset contact unlock (-59)
"unlock_company"       — company profile unlock (−tier cost)
"unlock_owner"         — owner profile unlock (−tier cost)
"unlock_deep_report"   — market report period unlock (−period cost)
```

---

## Organization Roles

Three built-in roles seeded by migration `20260521000001`:

| Role | Permissions |
|------|-------------|
| **Owner** | `ALL_PERMISSIONS` |
| **Manager** | `CAN_POST_LISTING`, `CAN_INVITE_AGENT`, `CAN_REMOVE_AGENT`, `CAN_MANAGE_LISTINGS`, `CAN_VIEW_ANALYTICS` |
| **Agent** | `CAN_POST_LISTING`, `CAN_VIEW_OWN_LISTINGS` |

The `create_owner_membership` trigger automatically assigns the Owner role on every `organizations` INSERT.

---

## Payment Flow (VnPay)

```
/buy-credits  →  selects package  →  /payment/vnpay  →  VnPay gateway  →  /payment-result
```

On return from VnPay, `/payment-result` calls `addCredits(userId, credits, packageKey)` which:
1. Upserts `user_credits` row (creates if missing)
2. Adds `credit_delta` to balance
3. Inserts a `"purchase"` transaction

### Invoice Info

Users can save invoice details (`companyName`, `taxCode`, `address`, `email`) to `profiles.invoice_info JSONB`. Accessed via `getInvoiceInfo()` / `saveInvoiceInfo()` in `src/lib/credits.ts`.

---

## Access Gating Rules

| Content | Gate | Behavior if not met |
|---------|------|---------------------|
| Asset contact details | Requires unlock (59 credits) | Show blur + "Mở khóa" button |
| Company full profile | Requires time-limited unlock | Show paywall tier selector |
| Owner full profile | Requires time-limited unlock | Show paywall tier selector |
| Deep market report period | Requires period unlock | Show lock icon + period price |
| Saving assets | Requires auth | Trigger `openAuthDialog()` |
| Profile page | Requires auth | Redirect to auth via `<ProtectedRoute>` |
| Asset owner detail | Requires auth | Redirect to auth via `<ProtectedRoute>` |
