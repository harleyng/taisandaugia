#!/bin/bash
# guard-main-push.sh
# PreToolUse hook (matcher: Bash). ADVISORY guard for the branch/PR policy.
#  - taisandaugia policy: nobody pushes directly to `main` except the repo owner; everyone else
#    works on a feature branch (or fork) and opens a PR.
#  - This hook does NOT hard-block. When a Bash command would push/force-push to `main`, it returns
#    permissionDecision "ask" so the user must consciously confirm (approve only if you are the owner
#    intentionally publishing to main; otherwise cancel and branch + PR instead).
#  - Anything that is not a push to `main` passes through silently.

INPUT=$(cat)
# jq-free JSON read (this repo ships node; jq is not guaranteed on the machine).
CMD=$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const o=JSON.parse(s);process.stdout.write(String((o.tool_input&&o.tool_input.command)||""))}catch(e){}})')
[ -z "$CMD" ] && exit 0

# Only care about `git push`.
echo "$CMD" | grep -qE 'git[[:space:]]+push' || exit 0

# Does the push target `main`? Match an explicit main ref; avoid false hits like `main-fix` / `feature/main`.
if echo "$CMD" | grep -qE '(origin[[:space:]]+main([[:space:]]|$|"|'\'')|HEAD:main([[:space:]]|$)|:main([[:space:]]|$)|[[:space:]]main([[:space:]]|$))'; then
  REASON="⚠️ taisandaugia policy: do NOT push directly to \`main\`. Only the repo owner (@harleyng) publishes to main; everyone else branches + opens a PR — git checkout -b <type>/<desc> → git push -u origin <branch> → gh pr create --base main --fill. Approve ONLY if you are the owner intentionally updating main."
  # Emit JSON for a soft confirm (advisory, not a hard deny).
  CTX="$REASON" node -e 'process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:process.env.CTX}}))'
  exit 0
fi

exit 0
