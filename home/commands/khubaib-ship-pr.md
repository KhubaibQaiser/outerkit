---
description: Take a PR or branch through fresh review, fixes, green CI, merge and cleanup
argument-hint: "[PR number or branch, defaults to current branch]"
---
Load the `pr-pipeline` skill and take this through it from wherever it currently stands: open the PR if none exists, run a fresh independent review, fix real findings, wait for green CI, merge with a merge commit, confirm the main-branch deploy, then clean up.

Target (PR number or branch, empty means the current branch): $ARGUMENTS

If I said "ask me first" for this PR earlier, stop before merging and ask.
