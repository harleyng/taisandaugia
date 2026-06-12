---
description: 4-phase development workflow for Tài Sản Đấu Giá. Follow for every coding task.
---

# Development Workflow (MANDATORY)

**CRITICAL:** Follow this workflow for EVERY coding task. Do NOT skip to coding — always start with analysis.

---

## Task Sizing (Determine First)

| Tier | Examples | Phases | Agents |
|------|----------|--------|--------|
| **Trivial** | Typo fix, rename variable, lint error, update comment | Phase 3 → 4 only | QA in Phase 4 only |
| **Small** | Single component bugfix, add form field, simple style change | Phase 1 (self, no agents) → 3 → 4 | QA in Phase 4 only |
| **Backend / Schema** | Migration, RPC, trigger, RLS policy, data backfill, DB function — **no new UI or product surface** | Phase 1 (self-analysis) → Phase 2 (design) → Phase 3 → Phase 4 | Phase 2: **System Architect**. Phase 4: QA. **Skip CPO / Domain Expert / UI-UX** |
| **Medium** | New component, new hook, modify feature, add page section | Full 4-phase | Phase 1: CPO + Domain Expert. Phase 2: CTO + UI/UX. Phase 4: QA |
| **Medium (analytics)** | New report hook, dashboard widget, chart implementation | Full 4-phase | Phase 1: CPO. Phase 2: CTO + UI/UX + Data Analyst. Phase 4: QA |
| **Large** | New feature, schema change, credits/KYC modification, new page | Full 4-phase + System Architect | Phase 1: CPO + Domain Expert. Phase 2: CTO + UI/UX + System Architect. Phase 4: QA |

**Rules:**
- Default to **Medium** when uncertain
- **Backend/Schema work** (migrations, RPCs, triggers, RLS policies) skips the product panel: brief self-analysis → System Architect design → QA. Don't spin up CPO/Domain Expert/UI-UX for a backend-only change with no UI or product surface. If the change *does* add UI or alter product behavior, treat it as Medium/Large instead.
- User can override: "treat this as trivial" or "full analysis please"
- **Phase 4 (verification) is ALWAYS required** — lint and build must pass

---

## Parallelizing Large Work (Multi-Agent Orchestration)

For **Large** tasks and broad sweeps, consider fanning work out across multiple agents instead of doing it serially in one context — it cuts wall-clock time and improves thoroughness.

**Reach for orchestration when:**
- A **Large multi-surface feature** spans new components + RPC/migration + types + credits logic (e.g., a new KYC tier or credit product) — fan out independent surfaces.
- An **RPC/trigger signature change** needs a *find-every-caller* sweep (the class of bug where a stale call fails silently). Fan out: one agent per caller-site cluster, then reconcile.
- A **broad audit**, large **refactor / dead-code sweep**, or **comprehensive review** (`/code-review ultra`).

**How:**
- **Claude Code:** use the `Agent` tool; verify findings adversarially before acting on them.
- **Other tools:** run the same decomposition as sequential sub-tasks.

**Caveat:** orchestration is opt-in and token-heavy. Use it for genuinely parallel or large work — not routine Small/Medium tasks, where a single context is faster and cheaper.

---

## Phase 1: Analysis

**For Medium/Large tasks:** Delegate to `cpo` and `domain-expert` agents **in parallel**.
**For Backend/Schema tasks:** Brief self-analysis only (data flow, impacted RPCs/triggers/policies, migration safety) — no CPO/Domain Expert. Design review goes to `system-architect` in Phase 2.
**For Small tasks:** Self-analysis only (no agents needed).
**For Trivial tasks:** Skip to Phase 3.

### CPO analyzes:
- Who benefits? (anonymous visitor / authenticated buyer / auction company rep)
- What outcome does the user get?
- What's the simplest version? MVP scope vs. v2?
- What are we explicitly NOT doing?

### Domain Expert analyzes:
- Does this match how Vietnamese real estate auctions actually work?
- Are there regulatory / compliance considerations?
- What edge cases exist in the auction / credit / KYC domain?

### Self-analysis (all Medium/Large):
- Map use cases: main flow → alternative flows → edge cases → error states
- Check impact on: auth gate, paywall/credits, KYC flow, other pages
- Search codebase for existing patterns to reuse (check `component-registry.md`)
- Identify DB tables and RLS policies involved

**MANDATORY:** Present synthesis to user before proceeding. Show:
- CPO assessment (who benefits, MVP scope)
- Domain Expert assessment (domain correctness, edge cases)
- Use cases (main flow, alternatives, edge cases)
- Impact analysis

**Do NOT start coding until the user confirms the analysis.**

---

## Phase 2: Solution Design

After analysis is confirmed:

1. Outline files to create/modify and why
2. Follow component design guidelines (single responsibility, pages < 300 lines)
3. Plan DB migrations if needed
4. Identify test cases upfront based on Phase 1 use cases
5. Delegate design review to the right experts in parallel:
   - **For Backend/Schema tasks:** delegate to **`system-architect`** — skip `cto` / `ui-ux` (no product or UX surface). The System Architect reviews schema design, RPC/trigger correctness, RLS, and migration safety.
   - **For Medium/Large tasks:** delegate to `cto` and `ui-ux` in parallel (add `data-analyst` for analytics tasks; add `system-architect` for Large tasks)
6. Present design to user for approval before implementation

---

## Phase 3: Implementation

After design is approved:

1. Write code following patterns in the root `CLAUDE.md` and `ref-agents-claude/knowledge/`
2. All UI strings in Vietnamese — match existing tone
3. Credits via `useCredits()` hook only
4. Auth modal via `useAuthDialog()` context only
5. Navigation via `useNavigate()` — never `<Button asChild><Link>`
6. No versioned client — always `import { supabase } from "@/integrations/supabase/client"`

---

## Phase 4: Verification

```bash
npm run lint    # Must pass
npm run build   # Must pass
```

Both must pass before considering the change complete.

---

## After the Task: Capture the Decision

If the task introduced a new pattern, fixed a non-obvious bug, or made an architectural/business decision that isn't obvious from the code, add a terse entry to `ref-agents-claude/knowledge/decisions-log.md` so the current truth stays discoverable.

---

## When Agents Are Involved

Different AI tools implement agent delegation differently:

| AI Tool | How to "delegate to agent X" |
|---------|------------------------------|
| **Claude Code** | Spawn a sub-agent using native agent delegation |
| **Other tools** | Read the SKILL.md file and simulate the expert's analysis inline |

Output quality should be identical regardless of mechanism.
