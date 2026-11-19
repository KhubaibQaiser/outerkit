---
name: ship-readiness-audit
description: Recommend-only release readiness audit for Khubaib's projects. Use whenever he asks "is it ready", "ready to share", "final check", "final audit", "do a checkup", or before submitting a project, sharing it with reviewers, a client or a company, or cutting a release. Changes nothing, reports findings and asks about each one. Does not draft handoff emails.
---

# Ship readiness audit

Khubaib wants a straight answer to "can I send this?", backed by evidence he can repeat. The audit
changes nothing. Every finding comes with a recommendation, and he decides each one.

## Rules

- Read-only. No edits, commits, settings changes or "quick fixes". If something is clearly broken,
  report it with the fix I'd make.
- Every claim comes from a command I ran or a page I loaded this session. Note what I couldn't check.
- Check the live deployment, not only the local build. Reviewers will see the live one.

## What to check

**Code health.** Typecheck, lint, format check, unit, integration and e2e tests on `main` with the
pinned runtime. Production dependency audit. Build output and bundle sizes against budgets.

**Hygiene.** Dead code, duplicate code, arbitrary styling values where a token exists, leftover debug
or dev-only routes, TODOs, stale branches and worktrees. Swallowed errors: empty or
default-returning `catch` blocks, ignored promise rejections, fallbacks that hide missing config,
and `|| true` in scripts or CI.

**Security.**
- Response headers on the live site (CSP, HSTS and friends).
- Dev routes return 404 in production.
- Public sign-up is off if it should be. Probe it, don't trust the dashboard.
- Database advisors (RLS, security-definer functions, missing indexes).
- No secrets in the repo or its history.

**Live operations.** The deployed commit matches `main` or differs only by docs. Scheduled jobs
(keep-alive, crons) have recent successful runs. Environment variables are set for production.

**Docs consistency.**
- ADR statuses match reality.
- Spec, plan, README and decision log agree with each other and with the shipped code.
- Nothing claims a number a reviewer can't reproduce.
- Deferred work is labelled deferred.
- The README explains setup, architecture and trade-offs.

**Fresh-clone walkthrough.** Clone into a clean directory and follow the README exactly as a stranger
would: install, environment setup, seed, run, test. Any documented command that fails or needs
knowledge the README doesn't give is a must-fix, because it's the first thing a reviewer hits.

**Brief traceability.** Build a table mapping each requirement in the brief or ticket to the screen,
code and test that meets it. Flag requirements with no evidence, and anything built that no
requirement asked for.

**Every role on the live site.** Sign in as each demo account and walk the main flows. Confirm each
role sees and can do exactly what it should, and that forbidden actions are blocked in the UI and on
the server, not only hidden.

**The public repo as a stranger sees it.**
- Recent commits and the PRs a reviewer will open show green checks. A red mark from an unrelated
  scheduled job still looks like a failure, so explain or clear it.
- The default branch is the one to review.
- `.env.example` exists and is complete.
- No personal data, test accounts or secrets in files or history.
- A licence, if the project should have one.

**Expiry during the review window.** List anything that could stop the project working while
reviewers have it:
- free tiers that pause on inactivity
- scheduled workflows that get disabled after a quiet period
- trial plans, tokens, certificates or domains that expire
- seed data that goes stale with time, such as "due today" dates already in the past

Give each one a date and a mitigation.

**Live error paths.** On the live site, check the 404 page, a failed request, and loading states on
a throttled network. Read the hosting platform's runtime error logs for the last day or two.

**Production data state.** Demo data is realistic and makes the product look good. No leftover test
rows, screenshot users or debug records.

**Accessibility on the live site.** Run an automated scan (axe or Lighthouse) on the key pages and
do one keyboard-only pass through the main flow. Report live numbers only, never local ones.

## Report

Start with the verdict in one line: ready, ready with caveats, or not ready.

Then list findings, most important first. For each one:
- what I saw, with the evidence
- why it matters to the person receiving the project
- my recommendation

Group as must-fix, should-fix and fine-as-is. End with what I didn't verify. Ask about the findings
in one batch and act only on his answers.
