---
name: log-decision
description: Capture a design/business/technical decision in the taisandaugia knowledge base — a TERSE entry prepended to .agents/knowledge/decisions-log.md PLUS an update to the canonical rule file it affects. Use PROACTIVELY at the end of any task that introduces a new pattern, adds a table/RLS policy, changes a credit/KYC/lifecycle rule, or where you were corrected. Trigger phrases "we decided", "from now on", "going forward", "changed the rule", "actually do it this way".
---

# /log-decision — capture a decision (terse + canonical)

`decisions-log.md` is **history (the why)**; the rule files are **current truth (the what)**. Agents *grep* the log — they don't auto-read it — so a decision that lives only in the log is effectively lost. Always do BOTH steps.

## 1. Terse entry — prepend to `.agents/knowledge/decisions-log.md`
The log is **reverse-chronological (newest first)** — insert directly below the top `---`, above the previous newest entry. First `git status` the file — if another agent or the user is mid-edit, coordinate or hold (never clobber an in-flight entry). Use the project's three-part shape:

```md
## <YYYY-MM-DD> — <short title>

**Context:** <1-2 lines: the problem / why now>
**Decision:** <bulleted, terse — what was chosen + key file refs>
**Consequences:** <follow-ups / obligations / what it now makes true (e.g. an ops task, a new RLS invariant)>
```
Keep it **under ~15 lines**. No essays — that bloat is exactly what this split avoids.

## 2. Update the canonical rule file — REQUIRED if it changes a rule
Route the *what* to the right current-truth file in `.agents/knowledge/`:
- credit costs/tiers, unlock lifecycle (permanent vs time-limited/stacking), KYC status flow, org roles → `business-rules.md`
- pattern / hook / routing / Supabase-query / RLS / provider-order / architecture → `architecture.md`
- gotcha / footgun (e.g. `asChild` Button+Link, parallel auth subscription) → `common-pitfalls.md`
- colors / tokens / Button API / composition → `design-system.md`
- a custom component or hook worth registering → `component-registry.md`

## 3. (Optional) durable project fact → MEMORY.md
If future sessions need it, add ONE terse index line to `MEMORY.md`. Do not paste detail into the index line.

Remember: **log = history/why, rule-file = current truth/what.** Skipping step 2 is the failure mode.
