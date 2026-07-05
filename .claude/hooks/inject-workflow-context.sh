#!/bin/bash
# inject-workflow-context.sh
# UserPromptSubmit hook for taisandaugia.
#  - Injects the full 4-phase Development Workflow reminder ONLY for coding/implementation prompts.
#    (Questions, discussions, research, reviews get nothing — the 4-phase rule already lives
#     in CLAUDE.md, so re-injecting it on every turn would be pure context noise.)
#  - Nudges the right project skill (/migration, /add-query, /new-page, /add-unlock,
#    /log-decision) when a scenario matches.
#  - Emits JSON only when something matched; silent on pure questions.

INPUT=$(cat)
# jq-free JSON read (this repo ships node; jq is not guaranteed on the machine).
PROMPT=$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).prompt||""))}catch(e){}})')

CONTEXT=""

# ── Intent detection: does this look like a coding/implementation request? ──
# Trigger on ACTION VERBS or explicit file refs — NOT on domain nouns alone
# (a question like "what is the credit cost to unlock an asset?" must stay silent).
CODING_INTENT=false
# English action verbs
if echo "$PROMPT" | grep -qiE '\b(add|create|implement|build|make|fix|bug|refactor|change|update|modify|rename|delet(e|ing)|remov(e|ing)|writ(e|ing)|edit|generat(e|ing)|scaffold|wire|integrat(e|ion)|revert|patch|rewrite|install|extract|split|move)\b'; then
  CODING_INTENT=true
fi
# Vietnamese action verbs (BSD grep \b is unreliable on diacritics → match without word boundary)
if echo "$PROMPT" | grep -qiE '(thêm|tạo|sửa|chỉnh|đổi|thay đổi|viết|xoá|xóa|xây dựng|tách|gộp|cập nhật|triển khai|dựng|làm lại|gắn|nối)'; then
  CODING_INTENT=true
fi
# Explicit code/file references
if echo "$PROMPT" | grep -qiE '\.(tsx?|ts|json)\b'; then
  CODING_INTENT=true
fi

# ── Coding prompts: inject the full 4-phase workflow reminder ──
if [ "$CODING_INTENT" = true ]; then
  CONTEXT="[4-PHASE WORKFLOW — MANDATORY] Before writing ANY code, follow the 4-phase Development Workflow from CLAUDE.md:
  Phase 1 — ANALYSIS: identify the end user (buyer / auction-company rep / anonymous visitor / asset owner), map main/alt/edge/error flows, note whether the change touches the auth gate, paywall, credit deduction, or KYC flow, list open questions. Wait for confirmation.
  Phase 2 — DESIGN: files to create/modify, component design (pages < 300 lines, single responsibility), data contract (Supabase tables/RLS/query keys), plan any DB migration. Wait for approval.
  Phase 3 — IMPLEMENTATION: only after Phase 2 approved; write code following the patterns above (typed supabase client, React Query invalidate, Vietnamese strings, useNavigate not asChild+Link).
  Phase 4 — VERIFICATION: npm run lint && npm run build must both pass.
  Touches credit deduction / unlock / paywall / KYC / RLS? Loop in credits-paywall-expert or kyc-expert as advisory (see .agents/skills/). Default to the full 4-phase flow when uncertain.
  You MUST NOT Write/Edit source files until Phase 1 is confirmed AND Phase 2 approved. If this is not a coding task, ignore this. "
fi

# ── Skill nudges (only for coding tasks): point at the right skill ──
SKILL_NUDGE=""
if [ "$CODING_INTENT" = true ]; then
if echo "$PROMPT" | grep -qiE '\b(migrat(e|ion)|supabase db push|schema|rls|table|sql|policy)\b'; then
  SKILL_NUDGE="${SKILL_NUDGE}/migration (real Supabase — add a timestamped file under supabase/migrations, RLS \"own rows\" (auth.uid() = user_id), apply with npx supabase db push, then regenerate src/integrations/supabase/types.ts); "
fi
if echo "$PROMPT" | grep -qiE '\b(query|useQuery|fetch|supabase select|read data|load data|data source)\b'; then
  SKILL_NUDGE="${SKILL_NUDGE}/add-query (typed supabase client from @/integrations/supabase/client, useQuery with a stable queryKey, mutations invalidate the key + toast; reads respect RLS); "
fi
if echo "$PROMPT" | grep -qiE '\b(new page|add (a )?page|screen|new route|App\.tsx|new section)\b'; then
  SKILL_NUDGE="${SKILL_NUDGE}/new-page (page under src/pages, <Route> in App.tsx respecting the provider order, protected route where needed, useNavigate not asChild+Link); "
fi
if echo "$PROMPT" | grep -qiE '\b(unlock|credit-?gate|paywall|credit deduct|gate|tier|deep report)\b'; then
  SKILL_NUDGE="${SKILL_NUDGE}/add-unlock (go through useCredits — unlockAsset permanent vs unlockCompany/unlockOwner time-limited & stacking, unlockDeepReportPeriod key \"{slug}:{periodId}\" + expandUnlock, append-only credit_transactions, invalidate [\"user-credits\", userId]); "
fi
if echo "$PROMPT" | grep -qiE '\b(decid(e|ed)|decision|chose|choose|rationale|why|from now on|going forward)\b'; then
  SKILL_NUDGE="${SKILL_NUDGE}/log-decision (terse reverse-chron entry in the decisions log + update the affected current-truth file); "
fi
if [ -n "$SKILL_NUDGE" ]; then
  CONTEXT="${CONTEXT}[SKILLS — invoke proactively via the Skill tool, don't wait for the user to type a slash command] This scenario matches: ${SKILL_NUDGE}"
fi
fi  # end: skill nudges only for coding tasks

# ── Output only if there is something to inject (silence on pure questions) ──
if [ -n "$CONTEXT" ]; then
  CTX="$CONTEXT" node -e 'process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:process.env.CTX}}))'
fi
exit 0
