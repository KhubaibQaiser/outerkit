---
name: khubaib-react-practices
description: Khubaib's React and Next.js structure rules. Use when writing or changing React or Next.js code, in a repo that depends on react or next, or in a .tsx or .jsx file. Covers one React component per file, UI-only components with logic in use-*.ts hooks, and native Tailwind classes only (no arbitrary values). A guard runs after edits and applies only to React or Next targets.
---

# khubaib-react-practices

These rules keep components small and readable, and keep logic testable and out of the UI.

## When this applies

The rules apply when one of these is true:
- a `package.json` from the file's folder up to the git root depends on `react` or `next`, or that folder has a `next.config.*` file (so a monorepo root counts), or
- the file is `.tsx` or `.jsx`, or it imports from `react` or `next`.

Otherwise the rules don't apply. Say so and skip them. Test files, `.d.ts` files and `*.config.*` files are never checked.

## The rules

1. **One React component per file.** Name the file after the component, in kebab-case: `contact-card.tsx` holds `ContactCard`. Plain helper functions may sit beside it.
2. **A component file holds UI only.** Business logic, effects, data fetching and derived state go in a `use-*.ts` hook beside the feature. Shared hooks go in the repo's shared hooks folder. Plain state may stay in the component: `useState`, `useId`, `useContext` and `useRef`. A component may call a hook imported from a `use-*` module. A very small component may call up to two other hooks itself: 40 non-blank lines or fewer in the file, effects included. Past that, the logic moves to a hook.
3. **Native Tailwind classes only.** Use the theme's scale steps, breakpoint variants and tokens. No arbitrary values or properties such as `text-[11px]`, `h-[98px]` or `[content-visibility:auto]`. Pick the closest scale step or variant. If none fits, add a token to the theme. Don't add a bracket value. Arbitrary variants are fine (`data-[state=open]:`, `aria-[current=page]:`, `has-[[aria-invalid=true]]:`), because Radix and ARIA states often have no built-in variant. The utility after them still follows the rule.

## Examples

Logic in a component (breaks rule 2):

```tsx
export function ContactList({ rows }: Props) {
  const [sorted, setSorted] = useState<Row[]>([]);
  useEffect(() => setSorted(sortByUrgency(rows)), [rows]);
  return <ul>{sorted.map(...)}</ul>;
}
```

Fixed: the sort lives in `use-contact-list.ts`, and the component only renders.

```tsx
export function ContactList({ rows }: Props) {
  const sorted = useContactList(rows);
  return <ul>{sorted.map(...)}</ul>;
}
```

Arbitrary value (breaks rule 3): `text-[11px]` becomes `text-xs`, or the nearest scale step. `gap-[3px]` becomes `gap-0.75`.

## How the guard enforces it

A Claude Code PostToolUse hook runs `scripts/react-practices.mjs --hook` after `Edit` and `Write`. On a React target, it compares the file before the call (Claude Code sends it as `tool_response.originalFile`) with the file after it, and blocks only the violations the call adds. Violations the file already had don't block, so older files stay editable, and a Write that creates a file owns every violation in it. A block exits 2 and lists each violation as `file:line rule: token`, with the fix.

If the guard itself fails (bad hook input, a broken `package.json`, a Claude Code that doesn't send `originalFile`), it prints one line and exits 1. Claude Code shows that to you without blocking the edit.

Run it by hand on any files:

```bash
node ~/.claude/skills/khubaib-react-practices/scripts/react-practices.mjs --files app/page.tsx components/card.tsx
```

## Workflow

- Before you write a component, decide which hook holds its logic, and name the files.
- When the guard blocks an edit, fix each reported line. Don't work around it with an arbitrary value or by adding a component to the same file.
- If a design really needs a value the scale lacks, ask Khubaib before you add a bracket value.

## Limits

- The guard checks structure, not design. Use `fe-quality-bar` for states, accessibility and visual checks.
- It reads text with patterns, not a parser. It skips comments. Bracket text that isn't shaped like a class (`items[0]`, a regex literal such as `/a-[0-9]/`) is ignored, but a bracket value in a plain string (`"a-[0-9]"`) still counts, and so does a tight tuple type such as `[k:string]`.
- Outside a small component, rule 2 is strict: any hook other than the four plain-state ones, or one imported from a `use-*` module, counts as logic. That includes `useMemo`, `useCallback`, `useTransition` and Next's `useRouter`, `usePathname` and `useSearchParams`. Wrap them in the feature's `use-*.ts` hook.
- "Small" counts the whole file's non-blank lines, comments included. An edit that takes a small file past 40 lines, or adds a third hook, makes all its hook calls count as new.
- Components are counted in `.tsx`, `.jsx` and `.js` files. A `.ts` file can't hold JSX, so it never has a component.
- An unnamed default export (`export default () => ...`) is not counted as a component.
- A repo can run the same three rules in its own lint, as Caseflow does with `scripts/check-frontend-structure.mjs`. Keep the two in step when a rule changes.
