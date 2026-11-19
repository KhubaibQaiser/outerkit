---
name: fe-quality-bar
description: Khubaib's frontend quality bar for building or fixing UI. Use whenever writing or changing components, pages, forms, tables, loading skeletons, empty or error states, styling, or fixing a visual or layout bug such as a layout shift, jump or flicker, in any of Khubaib's web projects, even for a "small UX tweak".
---

# Frontend quality bar

Khubaib reviews UI at the level of one pixel and one word. Fewer features done properly beat many
done roughly. Every state, every edge case and every affordance should look deliberate.

## Before writing visual code

- Mock first, as a hard stop. Any change to how something looks (layout, header, component
  structure, copy placement, a design review fix) gets an updated static mockup before any code.
  Edit no component or style file until Khubaib approves the mock.
  - Put it where the project keeps its mockups, as a new version that reuses the existing mockup CSS
    and tokens (Caseflow: `design/mockups/screens-vN.html` on a `design/...` branch).
  - Send screenshots at phone and desktop widths, then ask and wait.
  - When a review mixes visual and non-visual items, hold the visual ones for the mock and keep pure
    bug and security fixes that don't change the look going.
- Read the project's design docs (DESIGN.md, PRODUCT.md, tokens file) and the framework's own docs
  for the installed version. Framework APIs change between majors.

## Fixing a UI bug

1. Reproduce it first, under the conditions the user described (slow network, a part that loads
   earlier than another, mobile width, dark mode). Tell Khubaib whether the repro worked before fixing.
2. Find the root cause. For a jump between a placeholder and real content, compare the two layouts
   rather than tweaking spacing until it looks right.
3. Lock it with a test that fails on the old behaviour (for example an e2e test that delays the lazy
   chunk and asserts the placeholder geometry matches the loaded form within 1px).

## Checklist for every screen

**States.** Loading, empty, error and success all exist and look intentional. Skeletons mirror the
final layout exactly: same blocks, same positions, nothing the real content won't have (a skeleton
header above a form whose header already rendered is a layout shift). Keep CLS near zero.

**Forms.** Every required field shows the same muted lowercase `required` label. Conditionally
required fields say the condition ("required if no phone"). Validate at the boundary with a schema.
Errors say what to do next.

**Affordances.** Things that look actionable are actionable, and the same data behaves the same
everywhere (a phone number that's a `tel:` link on the detail page is also one in the table).
Inputs with content get a clear button where it saves effort. Avoid spinners where the result is fast.

**Accessibility.** WCAG 2.2 AA: 4.5:1 contrast, 24px targets, visible focus, no colour-only meaning,
labelled icon buttons, a menu alternative to any drag interaction.

**Styling.** Design tokens only, no colour literals or arbitrary values where a token or scale step
exists. Light and dark both work.

**Responsive.** Check phone and desktop widths. No horizontal scroll.

**Copy.** Use the product's own terminology and voice. Short, specific, no filler.

**Performance.** Respect the project's budgets (bundle size, Lighthouse). Import icons one at a time.
Lazy-load heavy parts with a placeholder that matches their size.

## Verify in the real app

Run the app and look at the change at both widths and in both themes before calling it done.
Screenshots go in the PR.
