# Tài Sản Đấu Giá — Knowledge Base

This folder contains structured project knowledge that agents read at the start of every conversation. These files are **living documents** — update them after completing any task that establishes new patterns, changes business rules, or discovers pitfalls.

## Files

| File | Purpose |
|------|---------|
| `architecture.md` | Tech stack, Supabase client pattern, routing, DB tables, directory structure |
| `business-rules.md` | KYC flow, credit system, organization status, access gating rules |
| `design-system.md` | Color tokens, button API, page layout patterns, component conventions |
| `analytics-patterns.md` | Market report metric definitions, chart conventions, report period helpers |
| `common-pitfalls.md` | Known bugs, gotchas, and things that are easy to get wrong |
| `decisions-log.md` | Timestamped design/business decisions with rationale |
| `component-registry.md` | Inventory of custom components with props and usage context |

## Subagent Integration

Each agent's skill file includes instructions to read the relevant knowledge files:

| Agent | Reads |
|-------|-------|
| `cpo` | `business-rules.md` |
| `domain-expert` | `business-rules.md`, `analytics-patterns.md` |
| `cto` | `architecture.md`, `common-pitfalls.md` |
| `data-analyst` | `architecture.md`, `business-rules.md`, `analytics-patterns.md` |
| `system-architect` | `architecture.md`, `business-rules.md`, `common-pitfalls.md` |
| `ui-ux` | `design-system.md`, `architecture.md` |
| `qa` | `architecture.md`, `common-pitfalls.md`, `business-rules.md` |

Updates to these files automatically propagate to all agents on their next invocation.

## Usage Protocol

1. **Start of conversation:** Read files relevant to the current task
2. **After completing a task:** Update relevant files with new knowledge
3. **When corrected by user:** Log the correction in `decisions-log.md` and update the relevant rule file
