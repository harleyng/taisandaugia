# Common Pitfalls — Tài Sản Đấu Giá

> Living document. Things that have gone wrong or are easy to get wrong.

---

## UI / Component Pitfalls

### Button + Link — Silent DOM Disappearance

`<Button asChild><Link to="...">` causes buttons to silently disappear from DOM. No console error. Always use `useNavigate()` instead.

```tsx
// ❌ Button will not render
<Button asChild><Link to="/listings">Browse</Link></Button>

// ✅ Always
const navigate = useNavigate();
<Button onClick={() => navigate("/listings")}>Browse</Button>
```

This has happened multiple times in the project. **Check this first** when a button is visually missing.

### AuthDialog Must Not Be Double-Mounted

`<AuthDialog>` is a global singleton mounted once in `App.tsx` inside `AuthDialogProvider`. Do NOT add a second `<AuthDialog>` in any page or component. To open it, use the context:

```typescript
const { openAuthDialog } = useAuthDialog();
openAuthDialog();
```

### PaywallProvider Requires Router Context

`PaywallProvider` uses `useNavigate()` internally. It must be rendered **inside `BrowserRouter`**. The current order in `App.tsx` is correct — do not move it outside the Router.

### Empty States Must Never Return `null`

If a tab or data list is empty, always render an explicit empty state. Returning `null` leaves a blank white area that looks broken. See `design-system.md → Empty States`.

### Tab Content Inside Accordion (Double Disclosure)

Never wrap tab content in `<Accordion>` or `<Collapsible>`. The tab itself is already a disclosure — a second layer is pure friction.

---

## Data / Supabase Pitfalls

### Direct Credits Function Calls from Components

Never call functions from `src/lib/credits.ts` directly in components. Always use the `useCredits()` hook which handles auth state, React Query caching, and invalidation.

```typescript
// ❌ Wrong — bypasses caching and auth state
import { unlockAsset } from "@/lib/credits";
await unlockAsset(userId, listingId);

// ✅ Correct
const { unlockAsset } = useCredits();
await unlockAsset(listingId, label);
```

### Credit Balance is Client-Trusted

The current credit deduction pattern (`deductCredits` in `credits.ts`) reads the current balance from the DB, subtracts locally, then writes back. This is **not atomic** — concurrent unlocks from the same user could race. Treat this as a known limitation: edge cases are low-probability for the current usage patterns.

### Supabase Types — Never Edit Manually

`src/integrations/supabase/types.ts` is auto-generated. Edits will be overwritten. After schema changes:

```bash
npx supabase gen types typescript --project-id bcusbpkfnydqcvxxjvew > src/integrations/supabase/types.ts
```

### RLS on Credit Tables

All six credit/unlock tables have `"own rows"` RLS policies. Queries without a logged-in user will return empty results, not errors. If credit data is unexpectedly empty, check auth session before debugging the query.

### Deep Report Unlock Key Format

Report unlock keys follow the pattern `"{slug}:{periodId}"` (e.g., `"bds:2025-Q1"`, `"bds:2025-01"`).

When purchasing a year/quarter, `expandUnlock()` expands it to all constituent months/quarters. Check `src/lib/reportPeriods.ts` for the expansion logic before writing any report unlock code.

---

## KYC / Onboarding Pitfalls

### Company Typeahead Sources From `auction_organizations`

Section A of the KYC form (`CompanyTypeahead`) searches `auction_organizations`, not `organizations`. These are two different tables — one is the registry of auction companies, the other is the KYC onboarding record.

### sectionStatus Is Computed, Not Stored

KYC form progress (sections A/B/C/D complete status) is computed on-the-fly by `sectionStatus(form)` in `src/components/company-onboarding/M2/sectionStatus.ts`. It is not persisted to DB. The ReviewPanel sidebar is a pure function of current form state.

### Phone Validation Requires OTP

The KYC phone field (`Step3PersonalInfo`) requires OTP verification before the form can be submitted. The pattern is: phone input → trigger OTP → verify code → mark phone as verified in form state. Do not skip OTP for "quick testing" as it changes the UX flow.

---

## Analytics / Reports Pitfalls

### Market Report Data Is Mock

All three main market report pages (`MarketReport`, `MarketReportCategory`, `MarketReportOutcomes`) currently render **mock data** from `src/lib/mockBdsReport.ts`, `mockOppReport.ts`, `mockOutcomesReport.ts`. Do not assume report numbers are live DB queries.

When implementing real data for any report section:
1. Define the metric formula precisely (see `analytics-patterns.md`)
2. Confirm which DB table and columns are the source of truth
3. Replace only the specific section, not the whole page

### Deep Report Unlock State Relies on `user_report_unlocks`

The `isReportPeriodUnlocked(slug, periodId)` check in `useCredits` looks for the key `"{slug}:{periodId}"` in the user's `reportUnlocks` array. This is fetched once on mount with `staleTime: 30_000`. If a user just unlocked a period, the UI updates immediately because `invalidate()` is called on success — but if the same page is open in two tabs, the second tab may show stale unlock state for up to 30 seconds.

---

## Performance Pitfalls

### Listings Page — Heavy Filter State

`src/pages/Listings.tsx` is ~20KB and manages complex filter state (province, category, price range, auction company, date). When adding new filters, ensure:
1. Filter state is initialized from URL params (deep-linkable)
2. Filter changes reset pagination to page 1
3. The filter query is debounced (not firing on every keystroke)

### useCompanyViewTracker Writes to localStorage

`useCompanyViewTracker` persists company view history to `localStorage`, not to DB. This is intentional for anonymous tracking. Do not refactor this to a DB write without considering the auth gate.
