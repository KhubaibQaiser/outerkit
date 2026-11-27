# outerkit

My Claude Code setup: the same rules, skills, commands, hooks and plugins on every machine, in a
Docker dev container and in a Lima VM.

The name joins "outer harness" and "kit". An
[outer harness](https://www.martinfowler.com/articles/harness-engineering.html) is what a team adds
around a coding agent for its own work: the instructions it reads, the checks on its work and the
limits on what it may do. This kit is mine. The repo was `claude-setup` until 2026-11-23.

Public. The design and every decision are in [docs/SPEC.md](docs/SPEC.md).

## New machine

1. Install [Homebrew](https://brew.sh) and run the commands its installer prints under "Next
   steps", which put `brew` on the PATH. Then install the GitHub CLI and sign in, so this
   machine can push edits back:
   ```bash
   brew install gh && gh auth login
   ```
2. Clone, then install the rest of the tools:
   ```bash
   gh repo clone KhubaibQaiser/outerkit ~/outerkit && brew bundle --file ~/outerkit/Brewfile
   ```
3. Node 24 and pnpm, through nvm and corepack. nvm first needs a folder and a few lines in the
   shell profile, which `brew info nvm` prints. Then, in a new terminal:
   ```bash
   nvm install 24 && nvm alias default 24 && corepack enable
   ```
4. Install [Claude Code](https://code.claude.com/docs/en/setup) and the desktop app, then sign in.
5. Link:
   ```bash
   ~/outerkit/setup install
   ```

`install` backs up anything it replaces into `~/.claude-setup-backup/<time>/`, links the managed
files into `~/.claude` and `~/.agent-guard`, then runs `doctor`. If `git`, `gh`, `jq`, `rg`,
`gitleaks`, `claude`, `pnpm` or `node` is missing, the links are still made and `install` exits
non-zero with the list of what to install.

The backup folder keeps the repo's old name, so `uninstall` still finds backups made before the
rename. A clone made under the old name keeps working from its old folder.

## Commands

| Command | What it does |
|---|---|
| `./setup install` | Backs up and links the managed files, then runs `doctor` |
| `./setup doctor` | Checks links, tools and `settings.json`. Prints a fix per problem, exits non-zero if any. |
| `./setup adopt <path>` | When an app replaced a link with a real file, moves that file into the repo and relinks it |
| `./setup uninstall` | Removes the links and puts back each original from the earliest backup that has it |

Edits to linked files change the repo working copy. Commit and push them yourself. An agent gets a
prompt before it changes `agent-guard/` or `home/settings.json` through the file tools or the
common shell writers (see [agent-guard/README.md](agent-guard/README.md)). The guard is a seatbelt,
not a sandbox: a determined command can still get past it.

## Tests

```bash
bash tests/run.sh && node --test agent-guard/guard.test.mjs
```

CI runs both on Linux and macOS, plus shellcheck on Linux. To run the Linux job locally in Docker:

```bash
docker run --rm -v "$PWD":/src:ro node:24-bookworm bash -c 'apt-get update -qq && apt-get install -y -qq --no-install-recommends jq rsync shellcheck >/dev/null && cp -r /src /w && cd /w && bash tests/run.sh && node --test agent-guard/guard.test.mjs && shellcheck setup tests/run.sh agent-guard/run.sh'
```

## Status

Install, links, doctor, adopt and uninstall are done. Next: the skills lock and `update`.
