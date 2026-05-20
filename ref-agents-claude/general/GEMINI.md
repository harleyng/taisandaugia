# GEMINI.md

This file provides guidance to Antigravity (Google's AI coding agent) when working with code in this repository.

## Project Overview

**EduLMS** — A two-portal Learning Management System for enterprise training. Built with React + TypeScript + Supabase. UI is primarily Vietnamese with English support.

This workspace contains two separate codebases for one product:

| Portal | Directory | Purpose | Runtime | React |
|--------|-----------|---------|---------|-------|
| **Admin Portal** | `vsf-lms/` | Content management, training operations, user admin, reporting | npm | React 18 |
| **Learner Portal** | `vsf-learner/` | Course consumption, progress tracking, assessments, certificates | npm | React 19 |

Both portals share a single Supabase PostgreSQL database.

## MANDATORY: Read Portal-Specific CLAUDE.md Before Any Work

**BLOCKING REQUIREMENT:** Before writing ANY code, creating ANY file, or modifying ANY file in either portal directory, you MUST first read the portal-specific CLAUDE.md:

1. Working in `vsf-lms/` → Read `vsf-lms/CLAUDE.md` first
2. Working in `vsf-learner/` → Read `vsf-learner/CLAUDE.md` first
3. Working across both → Read BOTH CLAUDE.md files first

The portal CLAUDE.md files contain **critical portal-specific patterns** (version system rules, test location conventions, hook patterns, etc.) that differ between portals. Skipping this step leads to broken code.

## Quick Reference

### Admin Portal (`vsf-lms/`)
```bash
cd vsf-lms
npm run dev          # Dev server at localhost:8080
npm run build        # Production build
npm run test         # Run tests
npm run test:coverage
npm run lint
```

### Learner Portal (`vsf-learner/`)
```bash
cd vsf-learner
npm run dev          # Dev server at localhost:5173
npm run build        # Production build
npm run test         # Run tests
npm run test:coverage
npm run lint
```

### Supabase (run from `vsf-lms/`)
```bash
npx supabase db push                    # Apply migrations to remote
npx supabase db push --include-all      # Apply all including out-of-order
npx supabase migration list             # Check migration status
npx supabase db diff                    # Show schema differences
npx supabase gen types typescript --project-id neszdqqqnouawsysbxrn > src/integrations/supabase/types.ts
```

## Shared Architecture

### Database
Both portals connect to the same Supabase instance. Credentials are in each project's `.env` file. Auto-generated types live at `src/integrations/supabase/types.ts` in each project — do not edit directly.

### Tech Stack (shared across both)
- **UI**: shadcn-ui + Tailwind CSS + Radix primitives + "Be Vietnam Pro" font
- **State**: TanStack React Query v5 for server state, React Hook Form + Zod for forms
- **Routing**: React Router v6
- **i18n**: i18next with Vietnamese default. Namespaced translation files in `src/i18n/locales/`
- **Path alias**: `@/` maps to `src/` in both projects

### Key Differences Between Portals

| Aspect | Admin Portal (`vsf-lms`) | Learner Portal (`vsf-learner`) |
|--------|--------------------------|-------------------------------|
| Package manager | npm | npm |
| Dev port | 8080 | 5173 |
| Test location | Centralized in `src/tests/` | Co-located next to source files |
| Version system | Dual schema (public + v2) with versioned Supabase client | Single schema (public) |
| Storybook | Yes (73 stories) | No |
| Rich text editor | Tiptap | No |
| Drag & drop | @dnd-kit | No |
| Migrations | 225+ in `supabase/migrations/` | 4 in `supabase/migrations/` |

### Admin Portal Version System
The admin portal has a dual-schema version system (`public` = Current/Stable, `v2` = New/Dev). All hooks in vsf-lms **must** use `useVersionedSupabase()` and `useVersionedQueryKey()` — never the raw `supabase` client. See `vsf-lms/CLAUDE.md` for full details.

Pages with version-specific files (`.current.tsx` and `.new.tsx`): default to editing `.new.tsx` unless explicitly told otherwise.

## Critical Patterns (Both Portals)

1. **Never use `asChild` with Button + Link** — causes silent rendering failures. Use `useNavigate()` instead.
2. **Status values**: Content uses `draft`/`published`/`archived`. Classes use `draft`/`active`/`in_progress`/`finished`/`cancelled` with manual activation required.
3. **100% test coverage required** in both projects.
4. **4-phase workflow**: See the "Development Workflow" section below. NEVER skip to coding.
5. **Supabase types are auto-generated** — never edit `types.ts` directly. Regenerate after schema changes.
6. **Check component registry before creating components** — Before creating ANY new component, read `.agents/knowledge/component-registry-admin.md` (for vsf-lms) or `.agents/knowledge/component-registry-learner.md` (for vsf-learner) to check if a similar component already exists. Reuse/extend existing components when possible.

---

## Development Workflow (MANDATORY — 4-Phase)

**CRITICAL:** Follow this 4-phase workflow for EVERY coding task. Do NOT skip to coding — always start with expert analysis.

**SELF-ENFORCEMENT:** There are no automated blocks — you MUST self-enforce this workflow. The entire value of this process is in the analysis and design phases that prevent rework.

### How Antigravity Simulates Expert Agents

This workflow was designed with a multi-expert panel (CPO, CTO, L&D Expert, UI/UX Designer, QA). Antigravity implements this by:

1. **Reading each expert's SKILL.md** from `.agents/skills/{expert}/SKILL.md`
2. **Adopting their perspective** — thinking through the task using their evaluation criteria, checklists, and frameworks
3. **Producing their assessment** inline in the analysis output
4. **Synthesizing across perspectives** using the Conflict Resolution Rules

This is functionally equivalent to sub-agent delegation — the same expert knowledge, same structured output, same quality gates.

---

### Phase 1: Analysis (via CPO + L&D Expert Perspectives)

**MANDATORY EXPERT ANALYSIS:** At the start of Phase 1, you MUST:

1. **Read the CPO SKILL.md** (`.agents/skills/cpo/SKILL.md`) and adopt the CPO perspective:
   - Analyze: problem definition, user personas, strategic fit, MVP scope, RICE prioritization
   - Use the CPO's "Should We Build This?" checklist and UX Strategy Principles
   - Produce a structured CPO assessment

2. **Read the L&D Expert SKILL.md** (`.agents/skills/ld-expert/SKILL.md`) and adopt the L&D perspective:
   - Validate: learning outcomes, compliance requirements, pedagogy, domain correctness
   - Check Vietnamese training compliance (if relevant)
   - Produce a structured L&D assessment

3. **Read knowledge files** for context:
   - `.agents/knowledge/business-rules.md` — Entity lifecycles, status conventions
   - `.agents/knowledge/architecture.md` — Module overview, tech stack
   - `.agents/knowledge/common-pitfalls.md` — Known gotchas

4. **Synthesize expert results** using the Conflict Resolution Rules (see below)

5. **Deepen the analysis yourself:**
   - **Map use cases:** main flow, alternative flows, edge cases, error states
   - **Analyze impact on other modules** — check status conventions, business rules, cross-portal effects
   - **Check existing patterns** — search the codebase for similar functionality to reuse
   - **Consider data flow** — DB tables, status transitions, RLS policies involved

**MANDATORY OUTPUT:** Present the synthesized analysis to the user before proceeding. Show:
- 📊 CPO assessment (strategic fit, priority, MVP scope)
- 🎓 L&D Expert assessment (learning impact, compliance, domain validation)
- Your use cases (main flow, alternatives, edge cases)
- Impact analysis on other modules
- Any concerns or open questions

**Do NOT start Phase 2 until the user confirms the analysis.**

---

### Phase 2: Solution Design (with Expert Review)

After analysis is confirmed:

1. **Propose the approach** — Outline which files to create/modify and why
2. **Check component registry** — Search `.agents/knowledge/component-registry-*.md` for existing components. List which will be reused vs. created new, with justification.
3. **Component design** — Prioritize reusability, single responsibility, keep pages under 300 lines
4. **Data model changes** — Plan any migrations, type regeneration, or schema updates
5. **Identify test cases upfront** — Based on the use cases from Phase 1

6. **Read CTO and UI/UX SKILL.md files** and review the design from their perspectives:
   - **CTO** (`.agents/skills/cto/SKILL.md`): architecture, data layer, scalability, versioned client compliance
   - **UI/UX** (`.agents/skills/ui-ux-designer/SKILL.md`): component composition, accessibility, design system consistency
   - If schema changes are involved, also read **System Architect** (`.agents/skills/system-architect/SKILL.md`)

7. **Present the design to the user for approval before implementation**

---

### Phase 3: Implementation

After design is approved:

1. Write code following the patterns in the portal-specific `CLAUDE.md`
2. Write tests **alongside** code — not as an afterthought
3. Every new/modified hook, utility, service, store, or component must have corresponding tests
4. **Admin Portal specific:** ALL hooks must use `useVersionedSupabase()` and `useVersionedQueryKey()` — NEVER the raw `supabase` client
5. **Admin Portal specific:** Default to editing `.new.tsx` files unless told otherwise
6. **Learner Portal specific:** Tests are co-located next to source files (not centralized)
7. **i18n (MANDATORY):** ALL user-facing text MUST use `t()` with proper i18n keys:
   - Add translation keys to BOTH `vi/*.json` and `en/*.json` locale files
   - Use the correct namespace (e.g., `content`, `training`, `common`)
   - Never hardcode UI text strings

---

### Phase 4: Verification (via QA Perspective)

After implementation:

1. **Read the QA SKILL.md** (`.agents/skills/qa-qc/SKILL.md`) and adopt the QA perspective
2. Review your implementation against the QA checklist (functional testing, edge cases, UI/UX quality, data integrity, i18n quality)
3. Run ALL verification commands for the affected portal(s):

**Admin Portal (`vsf-lms/`):**
```bash
cd vsf-lms && npm run test              # 1. Run all tests
cd vsf-lms && npm run test:coverage     # 2. Check coverage (must be 100%)
cd vsf-lms && npm run lint              # 3. Run linter
cd vsf-lms && npm run build             # 4. Verify production build
```

**Learner Portal (`vsf-learner/`):**
```bash
cd vsf-learner && npm run test              # 1. Run all tests
cd vsf-learner && npm run test:coverage     # 2. Check coverage (must be 100%)
cd vsf-learner && npm run lint              # 3. Run linter
cd vsf-learner && npm run build             # 4. Verify production build
```

**All four steps must pass before considering the change complete.**

---

## Expert Routing Guide

| Task Type | Read These SKILL.md Files | When |
|-----------|--------------------------|------|
| Feature request | `cpo` + `ld-expert` | Phase 1 |
| UI review | `ui-ux-designer` | Phase 2 |
| Code/architecture review | `cto` | Phase 2 |
| Schema/data model design | `system-architect` | Phase 2 |
| Design review | `cto` + `ui-ux-designer` | Phase 2 |
| Full feature pipeline | `cpo` + `ld-expert` → `system-architect` → `cto` + `ui-ux-designer` | Phase 1 → Phase 2 |
| Verification | `qa-qc` | Phase 4 |

## Conflict Resolution Rules

When expert perspectives disagree, apply these rules in order:

1. **Safety/Compliance wins** — L&D Expert's compliance concerns always take priority
2. **User outcome over tech elegance** — CPO's user-centered reasoning beats CTO's architecture purism
3. **Simplicity wins ties** — When two approaches are equally valid, pick the simpler one
4. **Data beats opinions** — If someone can point to real user behavior, that wins
5. **Reversibility matters** — Prefer the option that's easier to change later

## Synthesis Format

When multiple expert perspectives are consulted, present findings as:

```markdown
## Expert Panel Review: [Topic]

### Experts Consulted
- [List which experts and why]

### Individual Assessments
#### 📊 CPO: [summary]
#### 🏗️ CTO: [summary]
#### 🎓 L&D Expert: [summary]
#### 🎨 UI/UX: [summary]

### Conflicts & Resolutions
| Conflict | Expert A | Expert B | Resolution |
|----------|----------|----------|------------|

### Unified Recommendation
[Synthesized recommendation balancing all perspectives]
```

## Agent Knowledge Base

All expert perspectives reference shared knowledge files in `.agents/knowledge/`:
- `architecture.md` — Tech stack, version system, key patterns
- `business-rules.md` — Entity lifecycles, status conventions
- `design-system.md` — Colors, typography, button API, composition patterns
- `common-pitfalls.md` — Known bugs and gotchas
- `decisions-log.md` — Timestamped design/business decisions
- `component-registry-admin.md` — Full component registry for Admin Portal
- `component-registry-learner.md` — Full component registry for Learner Portal

## Test Coverage Requirements

- **Target: 100% line coverage** for all source files under `src/`
- Coverage measured by Vitest + v8 provider
- **Excluded:** `src/components/ui/**`, `*.stories.tsx`, test infra, `*.test.{ts,tsx}`, `src/types/**`, auto-generated Supabase types, bootstrap files, `src/i18n/**`
- **Must have 100% coverage:** All hooks, lib utilities, services, stores, constants, custom components, and pages

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

## Working Across Both Portals

When a feature touches both portals (e.g., new course field, enrollment flow change):
1. Database migration goes in `vsf-lms/supabase/migrations/`
2. Regenerate types in both projects after schema changes
3. Admin side handles CRUD operations; Learner side handles read/display
4. Test and build both projects independently
