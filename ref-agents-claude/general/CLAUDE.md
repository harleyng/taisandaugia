# CLAUDE.md — Tài Sản Đấu Giá

This file provides guidance to Claude Code when working with the `taisandaugia` repository.

## Project Overview

**Tài Sản Đấu Giá** — a Vietnamese real estate auction marketplace and broker portal. Buyers browse and unlock auction listings; auction companies onboard via a KYC flow to list assets. Single-portal React + Supabase application built on the Lovable platform.

## MANDATORY: Read Knowledge Base Before Any Work

Before writing code, read the relevant files in `ref-agents-claude/knowledge/`:

| Task Type | Read First |
|-----------|-----------|
| Any coding task | `architecture.md` |
| Business logic, status flows, credits | `business-rules.md` |
| UI components, styling | `design-system.md` |
| Market report / analytics | `analytics-patterns.md` |
| New feature / schema change | All of the above |

## Quick Reference

```bash
npm run dev      # Dev server on localhost:8080
npm run build    # Production build (Phase 4 gate)
npm run lint     # Linter (Phase 4 gate)
```

### Supabase CLI
```bash
npx supabase db push
npx supabase migration list
npx supabase gen types typescript --project-id bcusbpkfnydqcvxxjvew > src/integrations/supabase/types.ts
```

## Critical Rules (All Tasks)

1. **Never use `asChild` with Button + Link** — causes silent rendering failures. Use `useNavigate()` instead.
2. **Single Supabase client** — `import { supabase } from "@/integrations/supabase/client"` — no versioned client in this project.
3. **Never edit `types.ts` directly** — regenerate after schema changes.
4. **Credits via `useCredits()` hook only** — never call `src/lib/credits.ts` functions directly from components.
5. **Auth modal via context** — `const { openAuthDialog } = useAuthDialog()` — never mount AuthDialog twice.
6. **Vietnamese UI strings are hardcoded** — no i18n library; match the existing tone and style.

## Development Workflow (MANDATORY)

Full details: `ref-agents-claude/workflows/development.md`

| Tier | Examples | Process |
|------|----------|---------|
| **Trivial** | Typo, rename, lint fix | Phase 3 → Phase 4 only |
| **Small** | Single bugfix, add field | Phase 1 (self) → 3 → 4 |
| **Medium** | New component, feature mod, hook | Full 4-phase |
| **Large** | New feature, schema change, credits/KYC change | Full 4-phase + System Architect |

Phase 4 (lint + build) is **always required**.

## Expert Subagent Team

| Agent | Role | When to Use |
|-------|------|-------------|
| `cpo` | Product strategy, MVP scoping | Phase 1 (Medium/Large) |
| `domain-expert` | Real estate / auction domain knowledge | Phase 1 (Medium/Large) |
| `cto` | Code quality, architecture, Supabase patterns | Phase 2 design review |
| `ui-ux` | Design consistency, accessibility, Vietnamese UX | Phase 2 design review |
| `data-analyst` | Market report metrics, chart design, query performance | Phase 2 for analytics tasks |
| `system-architect` | Schema design, migrations, RLS | Large tasks with DB changes |
| `qa` | Test strategy, edge cases, Phase 4 verification | Phase 4 (all tasks) |

### Conflict Resolution
1. **Business integrity wins** — if domain expert flags a rule violation, it takes priority
2. **User outcome over tech elegance** — CPO beats CTO's architecture purism
3. **Data accuracy over visual polish** — Data Analyst's metric correctness beats UI/UX aesthetics
4. **Simplicity wins ties** — pick the simpler approach
5. **Reversibility matters** — prefer easier-to-change options

## Knowledge Base

All agents read shared knowledge from `ref-agents-claude/knowledge/`:
- `architecture.md` — tech stack, patterns, Supabase integration
- `business-rules.md` — credits, KYC flow, organization status, paywall
- `design-system.md` — color tokens, button API, layout patterns
- `common-pitfalls.md` — known bugs and gotchas
- `decisions-log.md` — timestamped design decisions
- `analytics-patterns.md` — market report metric definitions, chart conventions

**After completing any task** that introduces a new pattern, fixes a bug, or makes an architectural decision — update the relevant knowledge file.
