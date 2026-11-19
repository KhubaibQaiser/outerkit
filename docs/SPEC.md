# claude-setup spec

One private repo that makes Claude Code behave the same on every machine I use. Clone it, run one
command, and the rules, skills, commands, hooks and plugins match the other machine. It also runs
the same workflow inside a Docker dev container or a Lima VM.

Status: approved by Khubaib on 2026-11-19.

## Goals

- Switching from the M3 Pro to the Intel Mac mid-project has no disconnect.
- A fresh machine is ready with one clone and one command.
- The same workflow runs in a tight sandbox for daily dev and unattended runs.
- Nothing secret ever lands in the repo or an image.

## Non-goals

- Syncing memories, chat history or sessions. Each machine keeps its own.
- Windows support.
- Desktop app preferences (auto-archive, notifications). `doctor` lists them to set by hand.

## Decisions

| Topic | Decision |
|---|---|
| Machines | M3 Pro (arm64, user `khubaib-work`), Intel i9 2019 (x86_64, fresh, different username), Linux VMs |
| Client | Desktop app and CLI. Plugins from the claude.ai catalog arrive through the account on both. |
| Repo | Private `KhubaibQaiser/claude-setup`, cloned to `~/claude-setup`, symlinked into `~/.claude` |
| Third-party skills | Reinstalled from their source repos at pinned commits. No vendored copies. |
| Versions | A lock file pins skills and plugins. `./setup update` bumps them and shows the diff. |
| Sync | Auto-pull at session start, fast-forward only. Pushing is manual. |
| Concurrency | One machine at a time. A pull that can't fast-forward is skipped with a warning. |
| Memories | Not synced. Durable rules move into skills, or into `CLAUDE.md` when they must apply every turn. Each move is approved one by one. |
| Secrets | macOS Keychain. Launch scripts read them and pass them as env vars at run time only. |
| Guard | agent-guard globally (moved into this repo), harness guard per repo where `/harness:init` ran |
| Sandbox use | Daily dev sessions and unattended runs |
| Network in sandboxes | Strict allowlist: Anthropic, GitHub, npm, plus a per-project list |
| Projects that need Docker | Run in the Lima VM, which has its own Docker |
| Sandboxes | Multi-arch dev container (arm64 and amd64) and a Lima VM |

Confirmed assumptions:

1. A sandbox pushes with a fine-grained GitHub token scoped to one repo. The guard still blocks
   pushes to `main`.
2. My own claude.ai skills (for example `khubaibs-core-communication-standards`) are copied into
   the repo so containers have them. On the Macs they still come from the account.
3. Catalog plugins (superpowers, engineering, design, figma, caveman) come from the claude.ai
   account in both the app and the CLI. Any that a signed-in container can't load is flagged, not
   guessed.
4. The Claude Code CLI stays on auto-update and is not pinned.
5. Desktop app preferences are not synced.

## What the repo manages

| Repo path | Linked to | Notes |
|---|---|---|
| `home/CLAUDE.md` | `~/.claude/CLAUDE.md` | Global rules |
| `home/settings.json` | `~/.claude/settings.json` | Hooks, plugins, marketplaces, model. Paths use `$HOME`. |
| `home/commands/` | `~/.claude/commands` | `khubaib-*` commands |
| `home/skills/<name>/` | `~/.claude/skills/<name>` | My own skills, linked one by one |
| `agent-guard/` | `~/.agent-guard` | Also used by Cursor's hooks |
| `skills.lock` | | Third-party skills: repo, commit, path |
| `Brewfile` | | node 24, pnpm 10, gh, gitleaks, lima, ripgrep, jq |

Never in the repo: `~/.claude.json` (tokens and account state), `projects/` (sessions and
memories), `sessions/`, `history.jsonl`, `cache/`, `plugins/` (installed copies), `skills/synced`
(managed by the app), `ssh/`, `session-env/`.

## Commands

| Command | What it does |
|---|---|
| `./setup install` | Backs up anything it would replace into `~/.claude-setup-backup/<timestamp>/`, links the managed files, installs locked skills and plugins, then runs `doctor` |
| `./setup doctor` | Checks every link, the lock against what's installed, the hooks, the tools and the guards. Prints a fix for each problem and exits non-zero if any. |
| `./setup update` | Moves the lock to the latest upstream commits and versions, shows the diff, installs. You commit and push. |
| `./setup pull` | Fast-forward pull, run by the SessionStart hook |
| `./setup uninstall` | Removes the links and restores the latest backup |

## Edge cases

- **Different username or folder.** Every path is `$HOME`-based. Memories aren't synced, so their
  path-keyed folders don't matter.
- **A link replaced by a real file.** An app or tool may rewrite `settings.json` in place of the
  link. `doctor` detects it, shows the diff against the repo and offers to copy it in and relink.
- **Existing files on install.** Backed up, never deleted. A second install backs up again.
- **Third-party skills already installed by hand.** Replaced by the locked version, with a backup.
  The duplicate `ponytail` skill folder is removed because the plugin provides it.
- **Auto-pull.** Fast-forward only. It skips with a warning when offline, when there are local
  changes or unpushed commits, or when it can't fast-forward. It never merges. A pull failure never
  blocks the session.
- **Hook changes** take effect from the next session.
- **Leaks.** A gitleaks pre-commit hook and a CI scan. `.gitignore` covers the never-list above.
- **Two guards.** `doctor` checks agent-guard and the harness guard don't double-prompt or conflict.
- **Intel Mac.** Images are multi-arch. Lima works on Intel. Tart is out because it needs Apple
  Silicon.
- **Container.** Non-root user with UID mapping on the mounted repo. The firewall needs
  `NET_ADMIN`. Playwright browsers are baked in. Projects mount at `/workspace/<name>`. The host's
  `~/.claude`, `~/.ssh` and Keychain are never mounted.
- **Unattended runs.** Permissions are skipped only inside a sandbox. Auth uses a
  `claude setup-token` token from the Keychain.
- **Claude's own sandbox (`srt`)** is off inside containers and the VM, which are the sandbox.
- **Lima VM.** Runs its own Docker for projects like Caseflow's local Supabase. Same firewall and
  secret handling as the container.
- **macOS-only hooks.** agent-guard and the statusline get Linux-safe paths.

## Build order

Each step is one small PR, reviewed by a fresh agent and merged with a merge commit.

1. This spec
2. `install`, links, Brewfile, `doctor`, `uninstall`
3. `skills.lock` and `update`
4. Auto-pull hook and gitleaks
5. Memory rules into skills, with per-item approval
6. Dev container
7. Lima VM
