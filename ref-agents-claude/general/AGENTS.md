# AGENTS.md — Tài Sản Đấu Giá

This file provides guidance to Codex and similar AI coding agents when working with the `taisandaugia` repository.

## Project Overview

**Tài Sản Đấu Giá** — a Vietnamese real estate auction marketplace and broker portal. Single React + Supabase portal. Buyers unlock auction listings with credits; auction companies onboard via KYC.

## MANDATORY: Read Knowledge Base Before Any Work

Before writing code, read the relevant files in `ref-agents-claude/knowledge/`:

| Task Type | Read First |
|-----------|-----------|
| Any coding task | `architecture.md` |
| Business logic, credits, KYC | `business-rules.md` |
| UI/components/styling | `design-system.md` |
| Market report / analytics | `analytics-patterns.md` |
| New feature / schema change | All of the above |

## Commands

```bash
npm run dev      # Dev server on localhost:8080
npm run build    # Production build (Phase 4 gate)
npm run lint     # Linter (Phase 4 gate)

# Supabase
npx supabase db push
npx supabase migration list
npx supabase gen types typescript --project-id bcusbpkfnydqcvxxjvew > src/integrations/supabase/types.ts
```

## Critical Rules

1. **Never `<Button asChild><Link>`** — buttons disappear silently. Use `useNavigate()`.
2. **Single Supabase client** — `import { supabase } from "@/integrations/supabase/client"`. No versioned client.
3. **Never edit `types.ts` directly** — regenerate after schema changes.
4. **Credits via `useCredits()` hook** — never call `src/lib/credits.ts` directly from components.
5. **Auth modal via context** — `useAuthDialog()` only. Never mount `AuthDialog` twice.
6. **PaywallProvider must be inside BrowserRouter** — it uses `useNavigate()`.
7. **Vietnamese strings are hardcoded** — no i18n library. Match existing tone.

## Development Workflow

Full details: `ref-agents-claude/workflows/development.md`

| Tier | Process |
|------|---------|
| Trivial | Phase 3 → Phase 4 (lint + build) |
| Small | Phase 1 (self-analysis) → Phase 3 → Phase 4 |
| Medium | Full 4-phase |
| Large | Full 4-phase + System Architect |

Phase 4 (lint + build) is always required.

## Expert Subagents

| Agent | Role | SKILL.md |
|-------|------|---------|
| `cpo` | Product strategy | `ref-agents-claude/skills/cpo/SKILL.md` |
| `domain-expert` | Real estate/auction domain | `ref-agents-claude/skills/ld-expert/SKILL.md` |
| `cto` | Code quality, architecture | `ref-agents-claude/skills/cto/SKILL.md` |
| `ui-ux` | Design consistency | `ref-agents-claude/skills/ui-ux-designer/SKILL.md` |
| `data-analyst` | Market analytics | `ref-agents-claude/skills/data-analyst/SKILL.md` |
| `system-architect` | Schema, migrations, RLS | `ref-agents-claude/skills/system-architect/SKILL.md` |
| `qa` | Test strategy, Phase 4 | `ref-agents-claude/skills/qa-qc/SKILL.md` |

## Knowledge Base

`ref-agents-claude/knowledge/`:
- `architecture.md` — tech stack, patterns, DB tables
- `business-rules.md` — credits, KYC, access gating
- `design-system.md` — color tokens, buttons, layouts
- `common-pitfalls.md` — known bugs and gotchas
- `decisions-log.md` — design decisions
- `analytics-patterns.md` — report metrics, chart conventions

**After completing any task** that introduces a new pattern or makes an architectural decision — update the relevant knowledge file.

