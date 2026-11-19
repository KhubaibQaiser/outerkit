# claude-setup

My Claude Code setup: the same rules, skills, commands, hooks and plugins on every machine, in a
Docker dev container and in a Lima VM.

Private. The design and every decision are in [docs/SPEC.md](docs/SPEC.md).

## New machine

1. Install [Homebrew](https://brew.sh), then the tools:
   ```bash
   brew bundle --file ~/claude-setup/Brewfile
   ```
2. Node 24 and pnpm, through nvm and corepack:
   ```bash
   nvm install 24 && nvm alias default 24 && corepack enable
   ```
3. Install Claude Code and the desktop app, then sign in.
4. Clone and link:
   ```bash
   git clone https://github.com/KhubaibQaiser/claude-setup.git ~/claude-setup && ~/claude-setup/setup install
   ```

`install` backs up anything it replaces into `~/.claude-setup-backup/<time>/`, links the managed
files into `~/.claude` and `~/.agent-guard`, then runs `doctor`.

## Commands

| Command | What it does |
|---|---|
| `./setup install` | Backs up and links the managed files, then runs `doctor` |
| `./setup doctor` | Checks links, tools and `settings.json`. Prints a fix per problem, exits non-zero if any. |
| `./setup adopt <path>` | When an app replaced a link with a real file, moves that file into the repo and relinks it |
| `./setup uninstall` | Removes the links and restores the first backup |

Edits to linked files change the repo working copy. Commit and push them yourself.

## Tests

```bash
bash tests/run.sh && node --test --test-skip-pattern="dependency adds|AGENT_GUARD_ALLOW_INSTALL|Claude Code output format" agent-guard/guard.test.mjs
```

CI runs both on Linux and macOS, plus shellcheck. The skipped guard tests cover the dependency rule,
which is off (see `agent-guard/README.md`).

## Status

Install, links, doctor, adopt and uninstall are done. Next: the skills lock and `update`.
