---
description: 4-phase development workflow for EduLMS. Must follow for every coding task.
---

# Development Workflow (MANDATORY)

**CRITICAL:** Follow this workflow for EVERY coding task. Do NOT skip to coding — always start with analysis.

### Cross-Agent Compatibility

This workflow references "delegating to agents" (e.g., `cpo`, `ld-expert`, `cto`, `ui-ux`, `data-analyst`, `qa`). Different AI coding tools implement this differently:

| AI Tool | How to Execute "Delegate to Agent X" |
|---------|--------------------------------------|
| **Claude Code** | Spawn a sub-agent using Claude's native agent delegation |
| **Antigravity (Gemini)** | Read `.agents/skills/{agent}/SKILL.md`, adopt the expert's perspective, and produce their structured assessment inline |
| **Other tools** | Read the SKILL.md file and simulate the expert's analysis |

The output quality should be identical regardless of mechanism — same expert knowledge, same structured assessments, same quality gates.

---

## Task Sizing (Determine First)

Before starting any task, classify its size. This determines which phases and agents are required.

| Tier | Examples | Required Phases | Agents |
|------|----------|----------------|--------|
| **Trivial** | Typo fix, add translation key, rename variable, fix lint error, update comment | Phase 3 → Phase 4 only | QA in Phase 4 only |
| **Small** | Single component bugfix, add field to existing form, simple style change, add missing test | Phase 1 (self-analysis, no agents) → Phase 3 → Phase 4 | QA in Phase 4 only |
| **Medium** | New component, new hook, modify feature, add page section | Full 4-phase | Phase 1: CPO + L&D Expert. Phase 2: CTO + UI/UX. Phase 4: QA |
| **Medium (analytics)** | New report hook, dashboard widget, chart implementation | Full 4-phase | Phase 1: CPO + L&D Expert. Phase 2: CTO + UI/UX + Data Analyst. Phase 4: QA |
| **Large** | New feature, schema change, cross-portal work, new module | Full 4-phase + System Architect | Phase 1: CPO + L&D Expert. Phase 2: CTO + UI/UX + System Architect. Phase 4: QA |
| **Large (analytics)** | New report page, metrics redesign, sample-to-real-data migration | Full 4-phase + System Architect | Phase 1: CPO + L&D Expert + Data Analyst. Phase 2: CTO + UI/UX + System Architect + Data Analyst. Phase 4: QA |

**Rules:**
- Default to **Medium** when uncertain — it's safer to over-analyze than to miss something
- User can override: "treat this as trivial" or "full analysis please"
- If user says "skip analysis" or "just do it" → treat as Trivial
- **Phase 4 (verification) is ALWAYS required** regardless of tier — lint and build must pass. Tests and coverage are no longer gated; run them on demand.

---

## Phase 1: Analysis (via CPO + L&D Expert Agents)

**For Medium/Large tasks:** ALWAYS delegate to `cpo` and `ld-expert` agents **in parallel** at the start of Phase 1.
**For Small tasks:** Perform a brief self-analysis (use cases, impact) without spawning agents.
**For Trivial tasks:** Skip to Phase 3.

1. **Delegate to `cpo` and `ld-expert` agents in parallel:**
   - **CPO** analyzes: problem definition, user personas, strategic fit, MVP scope, RICE prioritization
   - **L&D Expert** validates: learning outcomes, compliance requirements, pedagogy, domain correctness
2. **Synthesize expert results** using the Conflict Resolution Rules in root CLAUDE.md
3. **Then deepen the analysis yourself:**
   - **Map use cases:** main flow, alternative flows, edge cases, error states
   - **Analyze impact on other modules** — check status conventions, business rules, cross-portal effects
   - **Check existing patterns** — search the codebase for similar functionality to reuse
   - **Consider data flow** — DB tables, status transitions, RLS policies involved

**MANDATORY:** Present the synthesized expert analysis + your own analysis to the user before proceeding. Show:
- CPO assessment (strategic fit, priority, MVP scope)
- L&D Expert assessment (learning impact, compliance, domain validation)
- Your use cases (main flow, alternatives, edge cases)
- Impact analysis on other modules
- Any concerns or open questions

**Do NOT start coding until the user confirms the analysis.**

---

## Phase 2: Solution Design (with Expert Review)

After analysis is confirmed:

1. **Propose the approach** — Outline which files to create/modify and why
2. **Component design** — Prioritize reusability, single responsibility, keep pages under 300 lines by extracting components
3. **Data model changes** — Plan any migrations, type regeneration, or schema updates
4. **Identify test cases upfront** — Based on the use cases from Phase 1, list what tests need to be written
5. **Delegate design review to `cto` and `ui-ux` agents in parallel:**
   - **CTO** reviews architecture, data layer, scalability, and versioned client compliance
   - **UI/UX** reviews component composition, accessibility, and design system consistency
   - **If the task involves reports, dashboards, metrics, or analytics:** Also delegate to `data-analyst` in parallel. The Data Analyst reviews metric definitions, query architecture, and visualization design
6. **Present the design to the user for approval before implementation**

---

## Phase 3: Implementation

After design is approved:

1. Write code following the patterns in the portal-specific `CLAUDE.md`
2. Write tests **alongside** code — not as an afterthought
3. Every new/modified hook, utility, service, or store must have corresponding tests. Tests are optional for components and pages.
4. **Admin Portal specific:** ALL hooks must use `useVersionedSupabase()` and `useVersionedQueryKey()` — NEVER the raw `supabase` client
5. **Admin Portal specific:** Default to editing `.new.tsx` files unless told otherwise
6. **Learner Portal specific:** Tests are co-located next to source files (not centralized)
7. **i18n (MANDATORY):** ALL user-facing text MUST use `t()` with proper i18n keys. When adding any new component or modifying UI text:
   - Add translation keys to BOTH `vi/*.json` and `en/*.json` locale files
   - Use the correct namespace (e.g., `content`, `training`, `common`)
   - Never hardcode UI text strings — always use translation functions
   - Check that any reused components (like `SkillsSelector`, `TagsInput`) have their i18n keys present in the relevant locale files

---

## Phase 4: Verification (via QA Agent)

After implementation, delegate to the `qa` agent for verification. For cross-portal changes, QA runs both portals.

Run these checks for the affected portal(s):

**Admin Portal (`vsf-lms/`):**
```bash
// turbo-all
npm run lint              # 1. Run linter
npm run build             # 2. Verify production build
```

**Learner Portal (`vsf-learner/`):**
```bash
// turbo-all
npm run lint              # 1. Run linter
npm run build             # 2. Verify production build
```

**Both steps must pass before considering the change complete.**

`npm run test` and `npm run test:coverage` are no longer Phase 4 gates. Run them on demand when you want to verify specific test suites or check coverage — they are not required to ship a change.

---

## Test Coverage Requirements

- **Aspirational target: 100% line coverage** for hooks, utils, services, and stores. This is no longer a Phase 4 gate — run `npm run test:coverage` on demand when you want to check.
- Coverage measured by Vitest + v8 provider
- **Excluded:** `src/components/ui/**`, `*.stories.tsx`, test infra, `*.test.{ts,tsx}`, `src/types/**`, auto-generated Supabase types, bootstrap files, `src/i18n/**`
- Components and pages are not held to a coverage target.

## Test Location Conventions

| Portal | Convention | Example |
|--------|-----------|---------|
| **Admin** (`vsf-lms`) | Centralized in `src/tests/` | `src/hooks/useX.ts` → `src/tests/hooks/useX.test.ts` |
| **Learner** (`vsf-learner`) | Co-located next to source | `src/hooks/useX.ts` → `src/hooks/useX.test.ts` |

## UI File Editing Rule

When pages have version-specific files (`.current.tsx` and `.new.tsx`):

| Action | Which File to Edit |
|--------|-------------------|
| **Default** (any edit request) | `.new.tsx` (New Version) |
| User explicitly requests Current | `.current.tsx` |
| Merge New → Current | Copy `.new.tsx` content to `.current.tsx` |
| Critical production bug | `.current.tsx` (user must confirm) |
