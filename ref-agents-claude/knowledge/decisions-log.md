# Decisions Log — Tài Sản Đấu Giá

> Living document. Every significant design/business decision is logged here with rationale.
> Date format: YYYY-MM-DD. Add new entries at the top.

---

## 2026-05-21 — Credit Deduction Is Client-Trusted (Not Atomic)

**Decision:** The `deductCredits` function in `src/lib/credits.ts` reads balance → subtracts → writes back in two separate DB calls. There is no DB-level atomicity (no `SELECT FOR UPDATE`, no RPC with a transaction).

**Why:** Supabase free tier lacks row locking primitives easily accessible from the JS client. Implementing an atomic RPC requires a Postgres function and Edge Function scaffolding. The current user base and usage patterns make concurrent double-deduction extremely unlikely.

**How to apply:** Accept this as a known limitation for now. If concurrent unlock issues are reported in production, the fix is a Postgres RPC: `PERFORM deduct_credits(user_id, amount) RETURNING new_balance` with `SELECT ... FOR UPDATE` inside a transaction.

---

## 2026-05-21 — Organization Roles Are Seeded, Not User-Configurable

**Decision:** The three roles (`Owner`, `Manager`, `Agent`) are seeded via migration `20260521000001_seed_organization_roles.sql` and inserted with `ON CONFLICT (name) DO NOTHING`. There is no UI for creating custom roles.

**Why:** The MVP scope targets a single-tier marketplace where company permissions are simple. Custom role management is a future enterprise feature.

**How to apply:** When building company member management features, hardcode role selection to the three seeded names. Do not design a generic role CRUD.

---

## 2026-05-20 — Report Data Uses Mock Files, Not Live DB

**Decision:** `MarketReport`, `MarketReportCategory`, and `MarketReportOutcomes` render data from `src/lib/mock*Report.ts` files rather than live Supabase queries.

**Why:** The report schema (`listing_price_sessions`, etc.) landed in migration `20260520160943` but the aggregation queries and RPC functions haven't been built yet. Mock data allows the UI to be designed and tested first.

**How to apply:** When implementing real data for a report section, define the metric formula in `analytics-patterns.md` first, then replace only the relevant mock. Do not do a full-page "swap mock for real" — migrate section by section.

---

## 2026-05-20 — Credits System Is DB-Persisted, Not localStorage

**Decision:** Credit balances and unlock history are persisted in Supabase (`user_credits`, `user_asset_unlocks`, etc.) rather than localStorage.

**Why:** Credits have monetary value (purchased with real VND). Losing credit state on browser clear or across devices would be a critical user trust issue. The `user_report_unlocks` table also enables cross-device report access.

**How to apply:** Never cache credit state beyond React Query's `staleTime: 30_000`. Never read credit state from localStorage.

---

## (Template for future entries)

## YYYY-MM-DD — [Short Decision Title]

**Decision:** [What was decided]

**Why:** [The reason — constraint, user request, technical limitation, business rule]

**How to apply:** [How this decision affects future work — what to do, what to avoid]
