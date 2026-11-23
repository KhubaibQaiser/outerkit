# outerkit spec

One public repo that makes Claude Code behave the same on every machine I use. Clone it, run one
command, and the rules, skills, commands, hooks and plugins match the other machine. It also runs
the same workflow inside a Docker dev container or a Lima VM.

Status: plan approved by Khubaib on 2026-11-19 ("Approve, build it"). Moving memory rules into
skills still needs his approval per item.

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
| Machines | M3 Pro (arm64, user `khubaib-work`), Intel i9 2019 (x86_64, fresh, different username), a Docker dev container and a Lima VM |
| Client | Desktop app and CLI. Catalog plugins (superpowers, engineering, design, figma, caveman, cowork-plugin-management) are not in `settings.json`. They sync from the claude.ai account, in the CLI too: `claude plugin list` shows them as "Synced from claude.ai" on the M3. |
| Repo | Public `KhubaibQaiser/outerkit`, cloned to `~/outerkit` on a new machine and symlinked into `~/.claude`. `setup` works from whatever folder it sits in, so the M3's clone can stay in `~/claude-setup`. |
| Name | Ruled on 2026-11-23: this repo is my kit, my own outer harness (the instructions, checks and limits around a coding agent), and its name is outerkit. It was `claude-setup` before, and the old address redirects for as long as no new repo takes that name. It was private until 2026-11-23, when I made it public so CI can run. GitHub Actions doesn't start jobs on my private repos. |
| Third-party skills | Reinstalled from their source repos at pinned commits. No vendored copies. |
| Versions | `skills.lock` pins third-party skills to a repo commit. Plugins from GitHub marketplaces are pinned in the same lock by version. Claude Code has no documented commit pin for marketplaces, so step 3 first checks whether a git ref on the marketplace source works. If it doesn't, `doctor` reports any plugin whose version differs from the lock. `./setup update` bumps the lock and shows the diff. |
| Sync | Auto-pull at session start, fast-forward only. Pushing is manual. |
| Concurrency | One machine at a time. A pull that can't fast-forward is skipped with a warning. |
| Memories | Not synced. Durable rules move into skills, or into `CLAUDE.md` when they must apply every turn. Each move is approved one by one. |
| Secrets | macOS Keychain on the host. The launch scripts run on the Mac, read the Keychain and pass values as env vars when they start a container (`docker run -e`) or open a shell in the VM. Nothing is written to an image, a VM disk or the repo. |
| Guard | agent-guard globally (moved into this repo), harness guard per repo where `/harness:init` ran. Its dependency rule is on everywhere. `AGENT_GUARD_ALLOW_INSTALL=1` lifts it for one session. |
| Merge gate | CI on Linux and macOS. Until 2026-11-23 the repo was private and GitHub Actions didn't start jobs on it, so a PR merged on a local macOS run plus a Linux run in Docker. |
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
| `home/settings.json` | `~/.claude/settings.json` | Hooks, plugins, marketplaces, model. `$HOME` appears only in hook commands, which run in a shell. Other fields don't expand variables, so `doctor` fails on `$HOME` anywhere else. |
| `home/commands/` | `~/.claude/commands` | `khubaib-*` commands |
| `home/skills/<name>/` | `~/.claude/skills/<name>` | My own skills, linked one by one |
| `agent-guard/` | `~/.agent-guard` | Also used by Cursor's hooks |
| `skills.lock` | | Third-party skills: repo, commit, path |
| `Brewfile` | | git, gh, jq, ripgrep, gitleaks, nvm, lima. Node 24 comes through nvm. pnpm comes through corepack, at the version each project pins in its `packageManager` field. Ruled on 2026-11-23: no kit-wide pnpm version. |

Never in the repo: `~/.claude.json` (tokens and account state), `projects/` (sessions and
memories), `sessions/`, `history.jsonl`, `cache/`, `plugins/` (installed copies), `skills/synced`
(managed by the app), `ssh/`, `session-env/`.

## Commands

| Command | What it does |
|---|---|
| `./setup install` | Backs up anything it would replace into `~/.claude-setup-backup/<timestamp>/`, links the managed files, installs locked skills and plugins, then runs `doctor` |
| `./setup adopt <path>` | Moves a file that replaced its link into the repo, then relinks it |
| `./setup doctor` | Checks every link, the lock against what's installed, the hooks, the tools and the guards. Prints a fix for each problem and exits non-zero if any. |
| `./setup update` | Moves the lock to the latest upstream commits and versions, shows the diff, installs. You commit and push. |
| `./setup pull` | Fast-forward pull, then a quick link check. Run by the SessionStart hook. |
| `./setup uninstall` | Removes the links and puts back each path from the earliest backup that has it, which is its state before setup. The backups stay on disk. |

## Edge cases

- **Different username or folder.** Every path is `$HOME`-based. Memories aren't synced, so their
  path-keyed folders don't matter.
- **A link replaced by a real file.** An app or tool may rewrite `settings.json` in place of the
  link, for example when `/config` saves. `./setup pull` (every session start) and `doctor` detect
  it and show the diff against the repo. `./setup adopt <path>` moves the file into the repo and
  relinks it.
- **Existing files on install.** Backed up, never deleted. A second install backs up again.
- **The old name.** The backup folder is still `~/.claude-setup-backup`. `uninstall` restores from
  it, so renaming it would strand the backups made before the rename.
- **Third-party skills already installed by hand.** Replaced by the locked version, with a backup.
  The duplicate `ponytail` skill folder is removed because the plugin provides it.
- **Auto-pull.** Fast-forward only. It skips with a warning when offline, when there are local
  changes or unpushed commits, or when it can't fast-forward. It never merges. A pull failure never
  blocks the session.
- **Hook changes** take effect from the next session.
- **Trust.** Auto-pull runs code from this repo at every session start, so only I push to it.
  Sandboxes don't auto-pull. They get the setup when the image or VM is built, and a rebuild
  updates them. The repo-scoped token inside a sandbox never has access to this repo.
- **Leaks.** A gitleaks pre-commit hook and a CI scan. `.gitignore` covers the never-list above.
- **Two guards.** `doctor` checks agent-guard and the harness guard don't double-prompt or conflict.
- **Intel Mac.** Images are multi-arch. Lima works on Intel. Tart is out because it needs Apple
  Silicon.
- **Container.** Non-root user with UID mapping on the mounted repo. The firewall needs
  `NET_ADMIN`. It resolves the allowlist domains to IPs when the container starts, and takes
  GitHub's ranges from its meta API, so a restart refreshes them. A project adds hosts in an
  optional `sandbox-allowlist.txt` at its root. Playwright browsers are baked in. Projects mount at `/workspace/<name>`. The host's
  `~/.claude`, `~/.ssh` and Keychain are never mounted.
- **Unattended runs.** Permissions are skipped only inside a sandbox. Auth uses a
  `claude setup-token` token from the Keychain.
- **Claude's own sandbox (`srt`)** is off inside containers and the VM, which are the sandbox.
- **Lima VM.** Ubuntu LTS with `vmType: vz` on both Macs. Lima picks the native image (aarch64 on
  the M3, x86_64 on the Intel Mac). It runs its own Docker for projects like Caseflow's local
  Supabase, with the same firewall and per-project allowlist. Secrets arrive as env vars on each
  shell opened from the Mac. On the 2019 Intel Mac the VM plus Docker is heavy, so give it at most
  half the cores and memory.
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
