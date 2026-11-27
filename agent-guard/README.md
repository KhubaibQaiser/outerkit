# agent-guard

Global guard for Cursor and Claude Code tool calls. `guard.mjs` started as a copy of
`scripts/agent-hooks/guard.mjs` from KhubaibQaiser/fitness-app (branch feature/agent-hooks, commit 3ecc645).
`run.sh` finds Node and starts it. Wired from `~/.cursor/hooks.json` and `~/.claude/settings.json`.
In Claude Code it checks the shell (`Bash`) and every file tool: `Read`, `Grep`, `Glob`, `Edit`,
`Write`, `MultiEdit` and `NotebookEdit`.

Policy: denies touching secrets files (the one exemption is writing a name such as `.env` into
`.gitignore`), force-push, any push to main or master, `curl | sh`, `chmod 777` and adding
dependencies; asks before destructive commands and before a shell command changes the guard or
the settings that run it. `permissions.ask` rules in `home/settings.json` do the same for the file
tools. A deny anywhere in a command wins over an ask (Khubaib's call, 2026-11-28).
When the guard itself fails (input that isn't hook JSON, a bug, no Node found), the call gets the
answer `ON_GUARD_ERROR` sets at the top of `guard.mjs`: `ask`, Khubaib's call on 2026-11-28, because
it is neither silent nor a lockout. `deny` or `allow` is a one-line change. The reason goes to stderr.
The dependency rule was off from 2026-11-17 to 2026-11-19 for the Caseflow deadline and is on
again. Use AGENT_GUARD_ALLOW_INSTALL=1 for a session that needs installs.
Allow dependency adds for one session: start Cursor or Claude Code with AGENT_GUARD_ALLOW_INSTALL=1.
Tests: `node --test ~/.agent-guard/guard.test.mjs`
Undo: ~/ai-config-backup-2026-10-24/restore.sh
