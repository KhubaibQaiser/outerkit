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
files into `~/.claude` and `~/.agent-guard`, then runs `doctor`. If a tool from step 1 or 2 is
missing, the links are still made and `install` exits non-zero with the list of what to install.

## Commands

| Command | What it does |
|---|---|
| `./setup install` | Backs up and links the managed files, then runs `doctor` |
| `./setup doctor` | Checks links, tools and `settings.json`. Prints a fix per problem, exits non-zero if any. |
| `./setup adopt <path>` | When an app replaced a link with a real file, moves that file into the repo and relinks it |
| `./setup uninstall` | Removes the links and puts back each original from the earliest backup that has it |

Edits to linked files change the repo working copy. Commit and push them yourself.

## Tests

```bash
bash tests/run.sh && node --test agent-guard/guard.test.mjs
```

CI runs both on Linux and macOS, plus shellcheck. While GitHub Actions is blocked on this account,
each PR is merged on a local macOS run plus a Linux run in Docker:

```bash
docker run --rm -v "$PWD":/src:ro node:24-bookworm bash -c 'apt-get update -qq && apt-get install -y -qq --no-install-recommends jq rsync shellcheck >/dev/null && cp -r /src /w && cd /w && bash tests/run.sh && node --test agent-guard/guard.test.mjs && shellcheck setup tests/run.sh agent-guard/run.sh'
```

## Status

Install, links, doctor, adopt and uninstall are done. Next: the skills lock and `update`.
