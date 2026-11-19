#!/bin/sh
# Starts guard.mjs with whatever Node is installed, even when the app was launched with a bare PATH
# (Cursor from the Dock does not load nvm). If no Node is found it allows the action and says so on
# stderr, so a missing Node can never lock a tool up.
dir=$(dirname "$0")
for node in "$(command -v node 2>/dev/null)" /opt/homebrew/bin/node /usr/local/bin/node \
  "$(ls -d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | tail -1)"; do
  [ -n "$node" ] && [ -x "$node" ] && exec "$node" "$dir/guard.mjs" "$@"
done
echo "agent-guard: no Node found, guard is inactive" >&2
case "$*" in *claude*) ;; *) printf '{"permission":"allow"}' ;; esac
exit 0
