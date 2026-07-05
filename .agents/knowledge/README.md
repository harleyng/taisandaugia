# Tài Sản Đấu Giá Knowledge Base (taisandaugia)

Structured project knowledge for the AI-agent panel. Two kinds of file live here — know which is which:

- **Current truth (auto-read):** the small, curated rule files below. These are the canonical "what is true now." Agents read the relevant ones at the start of a task.
- **History (grep-only):** `decisions-log.md`. This is the chronological "why" — an audit trail, **not** a source of current truth. `grep` it by date or keyword when you need the rationale behind a specific past decision; never auto-read it wholesale.

These are **living documents** — update them after any task that establishes a new pattern, changes a business rule, or discovers a pitfall.

> Context: taisandaugia is a **real production app**, not a prototype — a Vietnamese real-estate auction marketplace on **Supabase (PostgreSQL, RLS, versioned migrations, project `bcusbpkfnydqcvxxjvew`)** + **TanStack React Query** for server state, React Hook Form + Zod for forms, shadcn-ui + Tailwind, deployed on **Vercel**. There is a real backend, real auth (AuthDialog + `AuthProvider`), real credit ledger, and real RLS. Do NOT import mock-store / no-database / hand-rolled-state assumptions — reads respect RLS, writes go through the typed Supabase client and invalidate React Query keys. Mock files under `src/lib/mock*.ts` are legacy scaffolding, not the data layer. UI strings are hardcoded Vietnamese (no i18n library).

## Files

| File | Kind | Purpose |
|------|------|---------|
| `architecture.md` | current truth | Tech stack, `src/` structure, 23-page route table, provider order (`QueryClient`→`Tooltip`→`AuthDialog`→Router→`Paywall`), Supabase typed-client + React Query data layer, RLS "own rows" convention, migration workflow, `useCredits`/`useAssetPosting`/`useAuth`/`useProfile` hooks, `orgMatching`, path aliases |
| `business-rules.md` | current truth | KYC 3-milestone lifecycle (`kyc_status` PENDING_KYC→APPROVED\|REJECTED), org roles Owner/Manager/Agent permissions, CCCD/passport/phone-OTP validation, credit costs & tiers, `unlockAsset` (permanent) vs `unlockCompany`/`unlockOwner` (time-limited, stacking) vs `unlockDeepReportPeriod` (`{slug}:{periodId}` + `expandUnlock`), credit packages, paywall gating |
| `design-system.md` | current truth | HSL color tokens (`--primary` navy, `--accent` amber, `--success`, `--warning`, `--muted-foreground`, `--radius`), `rounded-2xl` cards, Button API (+ Button+Link footgun), Recharts chart conventions, badge/dialog patterns, Vietnamese UI tone |
| `component-registry.md` | current truth (hand-curated) | Catalog of notable custom components & hooks by feature folder (`company-onboarding/`, `owner-portal/`, `paywall/`, `asset-posting/`, `report/`, `profile/`) |
| `common-pitfalls.md` | current truth | Known bugs & gotchas — newest-first, dated |
| `decisions-log.md` | **history (grep-only)** | Timestamped design/business decisions with rationale. Grep it; don't auto-read. |

## The current-truth ↔ history split (important)

The decisions-log is the **audit trail**, not the rulebook. When you make a decision that establishes or changes a rule, the **rule file is canonical** — you MUST update `business-rules.md` / `architecture.md` / `design-system.md` / `common-pitfalls.md` so the current truth stays discoverable without reading history. The decisions-log entry records *why*; the rule file records *what*. **If a rule lives only in the decisions-log, it is effectively lost** — agents won't find it.

> Tip: the `/log-decision` skill writes a terse decisions-log entry AND nudges you to update the relevant rule file in one pass.

## Which files each subagent auto-reads

Each expert subagent (thin wrappers at `.claude/agents/*.md`, personas at `.agents/skills/<slug>/SKILL.md`) reads the relevant current-truth files on its first turn. No agent auto-reads `decisions-log.md`.

| Agent | Reads (current-truth only) |
|-------|----------------------------|
| `cpo` | `business-rules.md` |
| `credits-paywall-expert` | `business-rules.md` |
| `kyc-expert` | `business-rules.md`, `architecture.md` |
| `cto` | `architecture.md`, `common-pitfalls.md` |
| `ui-ux-designer` | `design-system.md`, `component-registry.md` |
| `data-analyst` | `architecture.md`, `business-rules.md`, `design-system.md` (Recharts conventions) |
| `system-architect` | `architecture.md`, `business-rules.md`, `common-pitfalls.md` |
| `qa-qc` | `architecture.md`, `common-pitfalls.md`, `business-rules.md` |

Updates to the current-truth files automatically propagate to all agents on their next invocation — no need to edit agent definitions.

## Usage protocol

1. **Start of a task:** read the **current-truth** files relevant to it. Do NOT read `decisions-log.md` wholesale — grep it only if you need the rationale behind a specific past decision.
2. **After completing a task:** update the relevant current-truth file(s) with new knowledge.
3. **When you make / are corrected on a decision:** log it in `decisions-log.md` (use `/log-decision`) **and** update the canonical rule file so the current truth stays current.
4. **After any schema migration:** regenerate `src/integrations/supabase/types.ts` (`npx supabase gen types …`) and reflect the new tables/columns/RLS in `architecture.md` + `business-rules.md`.

## Archival policy (maintenance)

`decisions-log.md` is reverse-chronological (newest first). To keep greps fast, when it exceeds ~3,000 lines **and the file is quiescent** (`git status` clean on it):

1. Move entries older than the rolling window (keep ~the last 20) into `.agents/knowledge/decisions-archive/decisions-<year>.md`.
2. Keep a one-line-per-decision **TOC** (date · title) at the top of the live log.
3. Confirm any still-true rules from archived entries already exist in the current-truth files.

This is a **manual, quiescent-only** operation — never restructure the log while another agent or the user is mid-edit on it.
