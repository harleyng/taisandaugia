#!/bin/bash
# check-safety.sh
# PostToolUse hook for Write|Edit. When a credit/unlock/paywall or asset-posting/org-matching
# module is written/edited, inject a taisandaugia self-review checklist as advisory context so
# the model self-checks the ledger-integrity, unlock-lifecycle, RLS, and paywall traps for this
# kind of code.
#
# Why PostToolUse: only PostToolUse supports a non-blocking
# `hookSpecificOutput.additionalContext` that reaches the model. The write has
# already happened; this prompts a self-check rather than blocking.

INPUT=$(cat)
# jq-free JSON read (this repo ships node; jq is not guaranteed on the machine).
FILE_PATH=$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const o=JSON.parse(s);process.stdout.write(String((o.tool_input&&o.tool_input.file_path)||""))}catch(e){}})')

# Skip test files.
case "$FILE_PATH" in
  *.test.*) exit 0 ;;
esac

# Only fire for the credit/unlock/paywall + asset-posting/org-matching modules.
if ! echo "$FILE_PATH" | grep -qE 'src/hooks/useCredits|src/lib/credits|src/hooks/useAssetPosting|src/lib/orgMatching|src/contexts/Paywall'; then
  exit 0
fi

# Capture the literal checklist, then let node do the JSON encoding
# (robust against quotes, apostrophes, backticks, and Vietnamese diacritics).
ADV=$(cat <<'ADVISORY'
[TAISANDAUGIA SELF-REVIEW — check the credit/unlock/paywall code you just wrote against these rules]
1. LEDGER APPEND-ONLY: every credit change writes a new row to credit_transactions — never UPDATE/DELETE an existing entry. Balance moves only through inserts to the ledger; keep user_credits and the ledger consistent.
2. PERMANENT vs TIME-LIMITED unlocks: unlockAsset is PERMANENT (user_asset_unlocks). unlockCompany/unlockOwner are TIME-LIMITED and STACK — a new purchase extends from the existing expires_at, never resets it. unlockDeepReportPeriod is permanent per period. Don't cross the wires.
3. INVALIDATE THE QUERY KEY: every mutation must call invalidate() / queryClient.invalidateQueries on ["user-credits", userId] so balance, transactions, and access recompute. Missing invalidate = stale UI (wrong balance, still-locked content).
4. RLS "OWN ROWS": all credit/unlock tables enforce USING (auth.uid() = user_id). Never read or write another user's credit/unlock rows; never widen a policy cross-user.
5. NO `asChild` Button + Link (silent render failure) — use useNavigate() for navigation from a paywall/CTA action.
6. PERMISSION GATES: gate spend behind an authenticated user (openAuthDialog when anonymous); route unlock UI through the paywall context / useCredits — never deduct credits from a component that bypasses useCredits.
7. VIETNAMESE-FIRST COPY: all user-facing strings (toasts, dialogs, labels) inline Vietnamese, consistent with existing wording (no i18n library).
8. expandUnlock FOR YEAR PURCHASES: buying a deep-report YEAR must expandUnlock() to cover every quarter/month within it (key "{slug}:{periodId}"); a year purchase that only unlocks the year row is a bug.
Then Phase 4: `npm run lint && npm run build` must both pass; run the co-located *.test.ts (e.g. orgMatching.test.ts) for the matching/credit math.
ADVISORY
)
CTX="$ADV" node -e 'process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:process.env.CTX}}))'
exit 0
