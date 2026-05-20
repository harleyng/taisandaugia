# AGENTS.md

> Generated from `CLAUDE.md` by `node scripts/sync-guide-files.mjs`.
> Edit the Claude guide and re-run the sync script to keep Codex guidance aligned.

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**EduLMS** — A two-portal Learning Management System for enterprise training. Built with React + TypeScript + Supabase. UI is primarily Vietnamese with English support.

| Portal | Directory | Purpose | Runtime | React |
|--------|-----------|---------|---------|-------|
| **Admin Portal** | `vsf-lms/` | Content management, training operations, user admin, reporting | npm | React 18 |
| **Learner Portal** | `vsf-learner/` | Course consumption, progress tracking, assessments, certificates | npm | React 19 |

Both portals share a single Supabase PostgreSQL database.

## MANDATORY: Read Portal-Specific AGENTS.md Before Any Work

**BLOCKING REQUIREMENT:** Before writing ANY code in either portal directory, you MUST first read the portal-specific AGENTS.md:

1. Working in `vsf-lms/` → Read `vsf-lms/AGENTS.md` first
2. Working in `vsf-learner/` → Read `vsf-learner/AGENTS.md` first
3. Working across both → Read BOTH AGENTS.md files first

## Quick Reference

### Admin Portal (`vsf-lms/`)
```bash
cd vsf-lms
npm run dev          # Dev server at localhost:8080
npm run build        # Production build (Phase 4 gate)
npm run lint         # Linter (Phase 4 gate)
npm run test         # Run tests (on demand — not gated)
npm run test:coverage  # Coverage report (on demand — not gated)
```

### Learner Portal (`vsf-learner/`)
```bash
cd vsf-learner
npm run dev          # Dev server at localhost:5173
npm run build        # Production build (Phase 4 gate)
npm run lint         # Linter (Phase 4 gate)
npm run test         # Run tests (on demand — not gated)
npm run test:coverage  # Coverage report (on demand — not gated)
```

### Supabase (run from `vsf-lms/`)
```bash
npx supabase db push                    # Apply migrations to remote
npx supabase db push --include-all      # Apply all including out-of-order
npx supabase migration list             # Check migration status
npx supabase db diff                    # Show schema differences
npx supabase gen types typescript --project-id neszdqqqnouawsysbxrn > src/integrations/supabase/types.ts
```

### Guide Sync (run from either portal)
```bash
npm run guides:check    # Fail if generated guide files drift from their source guides
npm run guides:sync     # Regenerate guide files for Codex from the source guides
```

## Shared Architecture

- **UI**: shadcn-ui + Tailwind CSS + Radix primitives + "Be Vietnam Pro" font
- **State**: TanStack React Query v5 for server state, React Hook Form + Zod for forms
- **Routing**: React Router v6
- **i18n**: i18next with Vietnamese default. Namespaced translation files in `src/i18n/locales/`
- **Path alias**: `@/` maps to `src/` in both projects
- **Database**: Both portals connect to the same Supabase instance. Auto-generated types at `src/integrations/supabase/types.ts` — never edit directly.

### Key Differences Between Portals

| Aspect | Admin Portal (`vsf-lms`) | Learner Portal (`vsf-learner`) |
|--------|--------------------------|-------------------------------|
| Dev port | 8080 | 5173 |
| Test location | Centralized in `src/tests/` | Co-located next to source files |
| Version system | Dual schema (public + v2) with versioned Supabase client | Single schema (public) |
| Storybook | Yes | No |
| Migrations | 225+ in `supabase/migrations/` | 4 in `supabase/migrations/` |

## Critical Patterns (Both Portals)

1. **Never use `asChild` with Button + Link** — causes silent rendering failures. Use `useNavigate()` instead. See `decisions-log.md`.
2. **Admin versioned client** — ALL vsf-lms source files must use `useVersionedSupabase()` and `useVersionedQueryKey()` — never the raw `supabase` client. Enforced by PreToolUse hook.
3. **Coverage is aspirational, not gated.** Aim for 100% on hooks/utils/services/stores in both projects, but `npm run test:coverage` is no longer a Phase 4 requirement.
4. **Supabase types are auto-generated** — never edit `types.ts` directly. Regenerate after schema changes.
5. **Check component registry before creating components** — Read `.agents/knowledge/component-registry-admin.md` or `component-registry-learner.md`. Regenerate with `node scripts/generate-component-registry.mjs`.
6. **Status values**: Content uses `draft`/`published`/`archived`. Classes use `draft`/`active`/`in_progress`/`finished`/`cancelled`. See `.agents/knowledge/business-rules.md`.

## Development Workflow (MANDATORY)

**Full workflow details: `.agents/workflows/development.md`**

Every coding task follows a **4-phase workflow** with **task sizing**:

| Tier | Process | Agent Involvement |
|------|---------|-------------------|
| **Trivial** (typo, translation key) | Phase 3+4 only | QA only |
| **Small** (single bugfix, add field) | Phase 1 (self) → 3 → 4 | QA only |
| **Medium** (new component, feature mod) | Full 4-phase | CPO+L&D → CTO+UI/UX → QA |
| **Large** (new feature, schema change) | Full 4-phase | CPO+L&D → CTO+UI/UX+Architect → QA |

**Key rules:**
- Default to **Medium** when uncertain
- Phase 4 (lint + build) is **ALWAYS required**. Tests and coverage run on demand only — they are no longer Phase 4 gates.
- Do NOT skip to coding without analysis (for Medium/Large tasks)
- User can override tier: "skip analysis" = Trivial, "full analysis" = Medium/Large

## Working Across Both Portals

When a feature touches both portals:
1. Database migration goes in `vsf-lms/supabase/migrations/`
2. Regenerate types in both projects after schema changes
3. Admin side handles CRUD operations; Learner side handles read/display
4. Test and build both projects independently

## Expert Subagent Team

7 specialized subagents in `.claude/agents/` act as a virtual expert panel. Full routing guide, conflict resolution rules, and synthesis format are in `.agents/skills/orchestrator/SKILL.md`.

| Agent | Role | When to Use |
|-------|------|-------------|
| `cpo` | Product strategy, MVP scoping | Phase 1 (Medium/Large tasks) |
| `ld-expert` | Training compliance, pedagogy | Phase 1 (Medium/Large tasks) |
| `cto` | Code quality, security, versioned client | Phase 2 design review |
| `ui-ux` | Design consistency, accessibility | Phase 2 design review |
| `data-analyst` | Analytics accuracy, metric design, visualization | Phase 2 for analytics tasks; Phase 1+2 for Large analytics |
| `system-architect` | Schema design, migrations, RLS | Large tasks with data model changes |
| `qa` | Test strategy, coverage, Phase 4 verification | Phase 4 (ALL tasks) |

### Conflict Resolution (when experts disagree)

1. **Safety/Compliance wins** — L&D Expert's concerns always take priority
2. **User outcome over tech elegance** — CPO beats CTO's architecture purism
3. **Data accuracy over visual polish** — Data Analyst's metric correctness beats UI/UX's aesthetic preferences
4. **Simplicity wins ties** — Pick the simpler approach
5. **Data beats opinions** — Real user behavior wins
6. **Reversibility matters** — Prefer easier-to-change options

## Knowledge Base

All agents reference shared knowledge in `.agents/knowledge/`:
- `architecture.md` — Tech stack, version system, key patterns
- `business-rules.md` — Entity lifecycles, status conventions
- `design-system.md` — Colors, typography, button API, composition patterns
- `common-pitfalls.md` — Known bugs and gotchas
- `decisions-log.md` — Timestamped design/business decisions
- `analytics-patterns.md` — Metric definitions, chart conventions, query patterns, report data migration status

**After completing any task** that introduces a new pattern, fixes a bug, or makes an architectural decision — update the relevant knowledge file. This applies to ALL AI tools (Claude Code, Codex, etc.).

