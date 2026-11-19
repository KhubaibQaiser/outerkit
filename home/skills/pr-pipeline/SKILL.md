---
name: pr-pipeline
description: Khubaib's branch, PR, review and merge workflow. Use whenever starting a task that will end in a PR, creating a branch or worktree, opening, reviewing, fixing or merging a pull request, or cleaning up after a merge, in any of Khubaib's repositories, even if he only says "ship it", "open a PR" or "merge 55".
---

# PR pipeline

Small PRs that a reviewer can read in one sitting, each one reviewed by a fresh pair of eyes,
merged with history intact. The point is a legible history that Khubaib can defend line by line.

## 1. Branch

- Prefix by kind: `feature/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`. Add the task id when
  there is one (`feature/t16-contact-detail`).
- One worktree per branch when work runs in parallel. Never commit to `main`.
- Never rename a branch that has an open PR. GitHub closes the PR when its head branch disappears.
  Rename only before the PR exists.

## 2. Scope the change

- One task per PR, or a tiny group of closely related tasks. If two tasks need the same new component,
  split that component into its own small PR first so both can proceed in parallel.
- Read the project's spec, plan and ADR index before starting. Check the change against the brief.
- Visual changes need an approved mockup before code (see `fe-quality-bar`).

## 3. Build test first

- Write the failing test, see it fail for the right reason, then make it pass.
- Commits are small and imperative ("Pin Save by right edge"), each ending with the project's
  attribution line if it has one.
- Run the project's full local gate before pushing: typecheck, lint, format check, unit tests, and
  integration or e2e when the change touches them. Use the project's pinned runtime version.

## 4. Open the PR

- Update README.md in every PR that changes behaviour, setup, scripts or scope. Keep its length and
  structure unless told otherwise.
- PR body: what changed and why, how it was tested, screenshots for anything visual. Store screenshots
  on a separate orphan branch (for example `screenshots`) and link them, so `main` stays clean.
- Record any ruling made during the task in the docs within the same PR or a companion docs PR.

## 5. Independent review

- Dispatch a fresh reviewer agent (Sonnet by default) that did not write the code. Give it the diff and
  the relevant spec, not my conclusions, so its read isn't anchored on mine.
- Fix everything real that it finds, then re-check. Push back with evidence on findings that are wrong.

## 6. Merge

- Merge only when the review is clean and CI is green. Use a merge commit
  (`gh pr merge N --merge`), never squash or rebase.
- If Khubaib said "ask me first" for this PR, stop and ask even when everything is green.
- When several PRs touch the same files, merge them in order and resolve conflicts by combining both
  intents, never by dropping one side. Renumber colliding log rows instead of overwriting them.
- After merging, wait for the main-branch CI and deploy to finish and confirm they passed before
  calling it shipped.

## 7. Clean up

Delete the remote branch, the local branch and the worktree. Leave long-lived branches like
`screenshots` alone. Report anything left over (stale branches, worktrees from other sessions)
instead of deleting what I didn't create.

## Common traps

- A scheduled workflow's check run attaches to whatever commit was on `main` when it ran, so a red X
  on a merged PR may not be that PR's fault. Check the run's trigger before blaming the code.
- Stale `node_modules` in the main checkout after switching branches breaks builds. Reinstall first.
- Integration tests that wipe seed data make the e2e suite fail afterwards. Reseed before e2e.
