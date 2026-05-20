# EduLMS Knowledge Base

This folder contains structured project knowledge that agents read at the start of every conversation. These files are **living documents** — update them after completing any task that establishes new patterns, changes business rules, or discovers pitfalls.

## Files

| File | Purpose |
|------|---------|
| `business-rules.md` | Entity status lifecycles, activation requirements, delivery modes, course edit rules |
| `design-system.md` | Color tokens, typography, button API, page composition patterns, component conventions |
| `architecture.md` | Project structure, tech stack, versioned client pattern, testing, routing, database |
| `analytics-patterns.md` | Metric definitions, chart conventions, analytics query patterns, report data migration status |
| `decisions-log.md` | Timestamped design/business decisions with rationale |
| `common-pitfalls.md` | Known bugs, gotchas, and things that are easy to get wrong |

## Subagent Integration

These knowledge files are referenced by the expert subagents in `.claude/agents/`. Each agent's system prompt includes instructions to read the relevant files on their first turn:

| Agent | Reads |
|-------|-------|
| `cpo` | `business-rules.md` |
| `cto` | `architecture.md`, `common-pitfalls.md` |
| `data-analyst` | `architecture.md`, `business-rules.md`, `analytics-patterns.md` |
| `system-architect` | `architecture.md`, `business-rules.md`, `common-pitfalls.md` |
| `ld-expert` | `business-rules.md` |
| `ui-ux` | `design-system.md` |
| `qa` | `architecture.md`, `common-pitfalls.md`, `business-rules.md` |

Updates to these files automatically propagate to all agents on their next invocation — no need to update agent definitions.

## Usage Protocol

1. **Start of conversation:** Read the files relevant to the current task
2. **After completing a task:** Update relevant files with new knowledge
3. **When corrected by user:** Log the correction in `decisions-log.md` and update the relevant rule file
