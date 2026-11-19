# agent-guard

Global guard for Cursor and Claude Code tool calls. `guard.mjs` is a copy of
`scripts/agent-hooks/guard.mjs` from KhubaibQaiser/fitness-app (branch feature/agent-hooks, commit 3ecc645).
`run.sh` finds Node and starts it. Wired from `~/.cursor/hooks.json` and `~/.claude/settings.json`.

Policy: denies reading secrets, force-push, any push to main or master, `curl | sh`, `chmod 777`
and adding dependencies; asks before destructive commands; fails open on errors.
The dependency rule was off from 2026-11-17 to 2026-11-19 for the Caseflow deadline and is on
again. Use AGENT_GUARD_ALLOW_INSTALL=1 for a session that needs installs.
Allow dependency adds for one session: start Cursor or Claude Code with AGENT_GUARD_ALLOW_INSTALL=1.
Tests: `node --test ~/.agent-guard/guard.test.mjs`
Undo: ~/ai-config-backup-2026-10-24/restore.sh
