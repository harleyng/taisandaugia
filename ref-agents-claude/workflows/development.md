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
| **Medium** | New component, new hook, modify feature, add page section | Full 4-phase | Phase 1: CPO + Domain Expert. Phase 2: CTO + UI/UX. Phase 4: QA |
| **Medium (analytics)** | New report hook, dashboard widget, chart implementation | Full 4-phase | Phase 1: CPO. Phase 2: CTO + UI/UX + Data Analyst. Phase 4: QA |
| **Large** | New feature, schema change, credits/KYC modification, new page | Full 4-phase + System Architect | Phase 1: CPO + Domain Expert. Phase 2: CTO + UI/UX + System Architect. Phase 4: QA |

**Rules:**
- Default to **Medium** when uncertain
- User can override: "treat this as trivial" or "full analysis please"
- **Phase 4 (verification) is ALWAYS required** — lint and build must pass

---

## Phase 1: Analysis

**For Medium/Large tasks:** Delegate to `cpo` and `domain-expert` agents **in parallel**.
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
5. Delegate design review to `cto` and `ui-ux` in parallel (add `data-analyst` for analytics tasks; add `system-architect` for Large tasks)
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

## When Agents Are Involved

Different AI tools implement agent delegation differently:

| AI Tool | How to "delegate to agent X" |
|---------|------------------------------|
| **Claude Code** | Spawn a sub-agent using native agent delegation |
| **Other tools** | Read the SKILL.md file and simulate the expert's analysis inline |

Output quality should be identical regardless of mechanism.
