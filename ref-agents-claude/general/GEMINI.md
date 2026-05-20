# GEMINI.md — Tài Sản Đấu Giá

This file provides guidance to Gemini (Antigravity) and other AI coding agents when working with the `taisandaugia` repository.

## Project Overview

**Tài Sản Đấu Giá** — a Vietnamese real estate auction marketplace. Single React + Supabase portal. Buyers unlock auction listings with credits; auction companies onboard via KYC.

## MANDATORY: Read Knowledge Base Before Any Work

Before writing code, read the relevant files in `ref-agents-claude/knowledge/`:

| Task Type | Read First |
|-----------|-----------|
| Any coding task | `architecture.md` |
| Business logic, credits, KYC | `business-rules.md` |
| UI/components/styling | `design-system.md` |
| Market report / analytics | `analytics-patterns.md` |

## Commands

```bash
npm run dev      # Dev server on localhost:8080
npm run build    # Production build (Phase 4 gate)
npm run lint     # Linter (Phase 4 gate)

# Supabase
npx supabase db push
npx supabase gen types typescript --project-id bcusbpkfnydqcvxxjvew > src/integrations/supabase/types.ts
```

## Critical Rules

1. **Never `<Button asChild><Link>`** — buttons disappear silently. Use `useNavigate()`.
2. **Single Supabase client** — `import { supabase } from "@/integrations/supabase/client"`. No versioned client.
3. **Never edit `types.ts` directly** — regenerate after schema changes.
4. **Credits via `useCredits()` hook only** — never call `src/lib/credits.ts` from components.
5. **Auth modal via `useAuthDialog()` context** — singleton, never mount `AuthDialog` manually.
6. **Vietnamese UI strings** — hardcoded, no i18n library. Match existing tone.

## Expert Agent Simulation

When the workflow says "delegate to agent X", read the SKILL.md and simulate that expert's analysis inline:

| Agent | SKILL.md |
|-------|----------|
| CPO | `ref-agents-claude/skills/cpo/SKILL.md` |
| Domain Expert | `ref-agents-claude/skills/ld-expert/SKILL.md` |
| CTO | `ref-agents-claude/skills/cto/SKILL.md` |
| UI/UX | `ref-agents-claude/skills/ui-ux-designer/SKILL.md` |
| Data Analyst | `ref-agents-claude/skills/data-analyst/SKILL.md` |
| System Architect | `ref-agents-claude/skills/system-architect/SKILL.md` |
| QA | `ref-agents-claude/skills/qa-qc/SKILL.md` |

Produce each expert's structured assessment format (as defined in their SKILL.md) inline, then synthesize into a unified recommendation.

## Development Workflow

Full details: `ref-agents-claude/workflows/development.md`

Phase 4 (`npm run lint && npm run build`) is always required.

## Knowledge Base

`ref-agents-claude/knowledge/`:
- `architecture.md` — tech stack, patterns, DB tables
- `business-rules.md` — credits, KYC, access gating
- `design-system.md` — color tokens, buttons, layouts
- `common-pitfalls.md` — known bugs and gotchas
- `decisions-log.md` — design decisions
- `analytics-patterns.md` — report metrics, chart conventions

**After completing any task** that introduces a new pattern or makes an architectural decision — update the relevant knowledge file.
