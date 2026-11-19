# agent-guard

Global guard for Cursor and Claude Code tool calls. `guard.mjs` is a copy of
`scripts/agent-hooks/guard.mjs` from KhubaibQaiser/fitness-app (branch feature/agent-hooks, commit 3ecc645).
`run.sh` finds Node and starts it. Wired from `~/.cursor/hooks.json` and `~/.claude/settings.json`.

Policy: denies reading secrets, force-push, any push to main or master, `curl | sh`, `chmod 777`
and adding dependencies; asks before destructive commands; fails open on errors.
The dependency rule is off since 2026-11-17 (`POLICY.checkDependencyAdds: false`), so its three
tests fail by design. To turn it back on, copy `guard.mjs.bak-2026-11-17` over `guard.mjs`.
Allow dependency adds for one session: start Cursor or Claude Code with AGENT_GUARD_ALLOW_INSTALL=1.
Tests: `node --test ~/.agent-guard/guard.test.mjs`
Undo: ~/ai-config-backup-2026-10-24/restore.sh
