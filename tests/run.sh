#!/usr/bin/env bash
# Runs ./setup against a throwaway HOME and a throwaway copy of the repo.
set -euo pipefail

SRC=$(cd "$(dirname "$0")/.." && pwd)
pass=0
fail=0

ok() { pass=$((pass + 1)); echo "  ok   $1"; }
bad() { fail=$((fail + 1)); echo "  FAIL $1"; }
check() { if eval "$2"; then ok "$1"; else bad "$1"; fi; }

# Fake tools so doctor's tool checks pass without installing anything.
# jq and git are real, because setup's own logic runs them.
JQ=$(command -v jq) || { echo "tests need jq" >&2; exit 1; }
GIT=$(command -v git) || { echo "tests need git" >&2; exit 1; }
stub_tools() {
  mkdir -p "$1"
  ln -sf "$JQ" "$1/jq"
  ln -sf "$GIT" "$1/git"
  for t in gh rg gitleaks claude pnpm; do
    printf '#!/bin/sh\nexit 0\n' >"$1/$t"
    chmod +x "$1/$t"
  done
  printf '#!/bin/sh\necho v24.11.0\n' >"$1/node"
  chmod +x "$1/node"
}

# Each case gets a fresh HOME, repo copy and PATH.
fresh() {
  T=$(mktemp -d)
  export HOME="$T/home"
  mkdir -p "$HOME"
  REPO="$T/repo"
  rsync -a --exclude .git "$SRC/" "$REPO/"
  stub_tools "$T/bin"
  export PATH="$T/bin:/usr/bin:/bin"
  S="$REPO/setup"
}

echo "install on an empty HOME"
fresh
"$S" install >/dev/null
check "CLAUDE.md is linked" '[ "$(readlink "$HOME/.claude/CLAUDE.md")" = "$REPO/home/CLAUDE.md" ]'
check "settings.json is linked" '[ "$(readlink "$HOME/.claude/settings.json")" = "$REPO/home/settings.json" ]'
check "commands is linked" '[ "$(readlink "$HOME/.claude/commands")" = "$REPO/home/commands" ]'
check "each own skill is linked" '[ "$(readlink "$HOME/.claude/skills/pr-pipeline")" = "$REPO/home/skills/pr-pipeline" ]'
check "agent-guard is linked" '[ "$(readlink "$HOME/.agent-guard")" = "$REPO/agent-guard" ]'
check "doctor passes" '"$S" doctor >/dev/null'

echo "install backs up existing files"
fresh
mkdir -p "$HOME/.claude/skills/pr-pipeline"
echo "old rules" >"$HOME/.claude/CLAUDE.md"
echo "old skill" >"$HOME/.claude/skills/pr-pipeline/SKILL.md"
"$S" install >/dev/null
b=$(ls -d "$HOME"/.claude-setup-backup/* | head -1)
check "old CLAUDE.md is in the backup" '[ "$(cat "$b/.claude/CLAUDE.md")" = "old rules" ]'
check "old skill is in the backup" '[ "$(cat "$b/.claude/skills/pr-pipeline/SKILL.md")" = "old skill" ]'

echo "install twice is safe"
"$S" install >/dev/null
check "no second backup when nothing changed" '[ "$(ls "$HOME/.claude-setup-backup" | wc -l | tr -d " ")" = 1 ]'

echo "doctor finds a link replaced by a file"
fresh
"$S" install >/dev/null
rm "$HOME/.claude/settings.json"
echo '{"theme":"dark"}' >"$HOME/.claude/settings.json"
out=$("$S" doctor 2>&1) && code=0 || code=$?
check "doctor fails" '[ "$code" -ne 0 ]'
check "doctor names adopt" 'echo "$out" | grep -q "setup adopt"'

echo "adopt copies the file into the repo and relinks"
"$S" adopt "$HOME/.claude/settings.json" >/dev/null
check "repo has the new content" 'grep -q dark "$REPO/home/settings.json"'
check "settings.json is a link again" '[ -L "$HOME/.claude/settings.json" ]'

echo "doctor finds problems"
fresh
"$S" install >/dev/null
rm "$T/bin/gitleaks"
check "a missing tool fails" '! "$S" doctor >/dev/null 2>&1'
stub_tools "$T/bin"
jq '.model = "$HOME/x"' "$REPO/home/settings.json" >"$T/s.json" && cp "$T/s.json" "$REPO/home/settings.json"
check "\$HOME outside a hook command fails" '! "$S" doctor >/dev/null 2>&1'
fresh
"$S" install >/dev/null
echo "{" >"$REPO/home/settings.json"
check "invalid settings.json fails" '! "$S" doctor >/dev/null 2>&1'
fresh
"$S" install >/dev/null
rm "$REPO/agent-guard/run.sh"
check "a hook command that doesn't exist fails" '! "$S" doctor >/dev/null 2>&1'

echo "uninstall restores the state before setup"
fresh
mkdir -p "$HOME/.claude"
echo "old rules" >"$HOME/.claude/CLAUDE.md"
"$S" install >/dev/null
"$S" uninstall >/dev/null
check "CLAUDE.md is the original file" '[ ! -L "$HOME/.claude/CLAUDE.md" ] && [ "$(cat "$HOME/.claude/CLAUDE.md")" = "old rules" ]'
check "links with no original are removed" '[ ! -e "$HOME/.claude/settings.json" ] && [ ! -L "$HOME/.agent-guard" ]'

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
