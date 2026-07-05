---
name: add-unlock
description: Wire a credit-gated flow in taisandaugia — check access via useCredits (assetUnlocked / companyAccess / ownerAccess / isReportPeriodUnlocked), reveal if unlocked, else open the PaywallContext dialog which deducts through the correct unlock fn and invalidates ["user-credits", userId]. Vietnamese UI. Use PROACTIVELY when locking asset/company/owner/report info behind credits, or adding a NEW unlockable kind. Trigger phrases "gate this behind credits", "paywall", "unlock", "credit-gated", "trừ credit".
---

# /add-unlock — scaffold a credit-gated reveal

Credits flow through **one access point — `useCredits()`** (`src/hooks/useCredits.tsx`) — and one dialog layer — **`PaywallContext`** (`src/contexts/PaywallContext.tsx`). The mutations live in `src/lib/credits.ts` and write to the **append-only `credit_transactions` ledger**; every unlock inserts a ledger row and auto-invalidates `["user-credits", userId]`. Never deduct credits by hand — always go through these. UI copy is **Vietnamese**.

## 1. Gate on the RIGHT access check
In the component, read the boolean/derived access from `useCredits()` and branch:
```tsx
const { assetUnlocked, companyAccess, ownerAccess, isReportPeriodUnlocked } = useCredits();
const { openAssetPaywall, openCompanyPaywall, openOwnerPaywall } = usePaywall();

if (assetUnlocked(listingId)) return <RevealedAssetInfo … />;   // permanent
return <LockedTeaser onClick={() => openAssetPaywall(listingId, label)} />;
```
Match kind → check → opener:
| Kind | Check (from `useCredits`) | Lifetime | Paywall opener (`usePaywall`) |
|------|---------------------------|----------|-------------------------------|
| Asset contact | `assetUnlocked(id)` → `bool` | **permanent** (`user_asset_unlocks`) | `openAssetPaywall(id, label)` |
| Company (org) | `companyAccess(orgId).isUnlocked` | **time-limited, stacking** | `openCompanyPaywall(orgId, label)` |
| Owner | `ownerAccess(ownerId).isUnlocked` | **time-limited, stacking** | `openOwnerPaywall(ownerId, label)` |
| Deep report period | `isReportPeriodUnlocked(slug, periodId)` | permanent (`{slug}:{periodId}`, expands) | (report page's own unlock UI) |

## 2. Let the paywall dialog do the deduction
`openXPaywall(...)` shows the dialog (`src/components/paywall/*PaywallDialog.tsx`). The dialog already: shows cost vs `balance`; if enough, calls the correct `useCredits` fn (`unlockAsset` / `unlockCompany(orgId, tier)` / `unlockOwner(ownerId, tier)` / `unlockDeepReportPeriod(slug, periodId)`), which deducts, writes the ledger row, and `invalidate()`s `["user-credits", userId]` — the gate re-renders unlocked automatically; if **insufficient**, routes to buy credits (`/profile?tab=credits&return=…&unlock=asset:<id>`). You do **not** re-implement any of this in the gate.

Costs (from `src/lib/credits.ts`, mirrored in CLAUDE.md): asset `ASSET_COST=59`; `COMPANY_TIERS` 99/299/1990 (7d/30d/1y); `OWNER_TIERS` 49/149/995; `DEEP_REPORT_PERIOD_PRICES` 990/2490/8900 (month/quarter/year). Company/owner tiers **extend from the existing expiry** when still active; a year unlock of a report expands to all its quarters/months via `expandUnlock`.

## 3. Adding a NEW unlockable kind (not asset/company/owner/report)
Full path, in order: (a) **`/migration`** for a `user_<x>_unlocks` table with the "own rows" RLS policy; (b) an unlock fn in `src/lib/credits.ts` that `deductCredits` + inserts a `credit_transactions` row (add its `TransactionType`) + writes the unlock row; (c) surface it through `useCredits` (add the check + the `unlockX` wrapper that calls `invalidate()`); (d) a `X PaywallDialog` in `src/components/paywall/` + an `openXPaywall` on `PaywallContext` and its dialog mount in `PaywallProvider`. Keep the ledger append-only and the invalidate key `["user-credits", userId]`.

## 4. Non-negotiables
- **Single source:** all credit reads/writes via `useCredits`; all gate dialogs via `usePaywall`. No direct `supabase.from("user_credits")` in components.
- **Never** compute "unlocked" from a raw expiry in a component — use `companyAccess/ownerAccess` (they handle stacking + `Date.now()` expiry).
- Insufficient-balance UX is the dialog's job — the gate just opens it.

## 5. Verify + log
Phase 4: `npm run lint && npm run build` green. A new unlockable kind or a changed cost/lifetime rule → close with **`/log-decision`** (update `business-rules.md`).
