#!/bin/sh
# Starts guard.mjs with whatever Node is installed, even when the app was launched with a bare PATH
# (Cursor from the Dock does not load nvm). If no Node is found, the call gets the answer that
# ON_GUARD_ERROR in guard.mjs sets for a guard error, and the reason goes to stderr.
dir=$(dirname "$0")
# nvm version folders are plain names like v24.11.1, so ls is safe.
# shellcheck disable=SC2012
for node in "$(command -v node 2>/dev/null)" /opt/homebrew/bin/node /usr/local/bin/node \
  "$(ls -d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | tail -1)"; do
  [ -n "$node" ] && [ -x "$node" ] && exec "$node" "$dir/guard.mjs" "$@"
done
why="agent-guard: no Node found, the guard could not check this call"
echo "$why" >&2
decision=$(sed -n "s/^const ON_GUARD_ERROR = '\([a-z]*\)';\$/\1/p" "$dir/guard.mjs")
# guard.mjs unreadable or the line changed: nothing says to let the call through, so block it.
[ -n "$decision" ] || decision=deny
case "$*" in
  *claude*)
    [ "$decision" = allow ] ||
      printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"%s","permissionDecisionReason":"%s"}}' "$decision" "$why"
    ;;
  *) printf '{"permission":"%s","user_message":"%s","agent_message":"%s"}' "$decision" "$why" "$why" ;;
esac
exit 0
