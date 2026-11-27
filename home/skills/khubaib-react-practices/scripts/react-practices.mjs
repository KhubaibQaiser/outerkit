#!/usr/bin/env node
// Guard for Khubaib's React and Next practices (see ../SKILL.md). No dependencies.
//
// It runs only where the rules apply: in a repo whose package.json depends on react or next, or
// on a target file that is React (.tsx or .jsx, or a file that imports react or next). Anywhere
// else it stays silent.
//
// Modes:
//   --hook           Claude Code PostToolUse hook. Reads the tool call on stdin. Exits 2 with
//                    feedback for Claude when the edit adds a violation. Pre-existing ones pass.
//   --files <paths>  Check named files and print every violation. Exits 1 if there are any.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SIMPLE_HOOKS = new Set(['useState', 'useId', 'useContext', 'useRef']);
const TOKEN_SPLIT = /[\s'"`{};<>]+/;
const COMPONENT_DECL =
  /^(?:export\s+)?(?:default\s+)?(?:function\s+([A-Z]\w*)\s*\(|const\s+([A-Z]\w*)\s*(?::[^=\n]+)?=\s*(?:memo\(|forwardRef\(|\(|function\b))/gm;

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** Arbitrary value (`text-[11px]`), or arbitrary property or variant (`[content-visibility:auto]`). */
function isArbitrary(token) {
  if (/-\[[^\]]*\]/.test(token)) return true;
  return /^!?\[[^\]]*:[^\]]*\]/.test(token);
}

export function findArbitraryClasses(text) {
  return text.split(TOKEN_SPLIT).filter((token) => token && isArbitrary(token));
}

function arbitraryHits(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const token of line.split(TOKEN_SPLIT)) if (token && isArbitrary(token)) hits.push({ token, line: i + 1 });
  });
  return hits;
}

function componentHits(text) {
  return [...text.matchAll(COMPONENT_DECL)].map((m) => ({ name: m[1] ?? m[2], line: lineOf(text, m.index) }));
}

export function findMultipleComponents(text) {
  return componentHits(text).map((c) => c.name);
}

function importedUseNames(text) {
  const names = new Set();
  for (const m of text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g)) {
    const fileName = m[2].split('/').pop() ?? '';
    if (!fileName.startsWith('use-')) continue;
    for (const spec of m[1].split(',')) {
      const name = spec.trim().split(/\s+as\s+/)[0].trim();
      if (name) names.add(name);
    }
  }
  return names;
}

function hookHits(text) {
  const allowed = importedUseNames(text);
  const hits = [];
  for (const m of text.matchAll(/(?<![\w.])(use[A-Z]\w*)\s*\(/g)) {
    const name = m[1];
    if (SIMPLE_HOOKS.has(name) || allowed.has(name)) continue;
    if (new RegExp(`function\\s+${name}\\s*\\(`).test(text)) continue;
    hits.push({ name, line: lineOf(text, m.index) });
  }
  return hits;
}

export function findComponentHookViolations(text) {
  return hookHits(text).map((h) => h.name);
}

/** Every violation in one file's text, with its line. */
export function analyze(text) {
  const violations = [];
  for (const h of arbitraryHits(text)) {
    violations.push({ rule: 'tailwind-arbitrary', key: `tailwind:${h.token}`, token: h.token, line: h.line });
  }
  const components = componentHits(text);
  if (components.length > 1) {
    for (const c of components) violations.push({ rule: 'one-component-per-file', key: `component:${c.name}`, name: c.name, line: c.line });
  }
  if (components.length > 0) {
    for (const h of hookHits(text)) violations.push({ rule: 'logic-hook-in-component', key: `hook:${h.name}`, name: h.name, line: h.line });
  }
  return violations.sort((a, b) => a.line - b.line);
}

/** Violations in `after` that `before` did not already have. `before` null means nothing existed before. */
export function newViolations(file, before, after) {
  const counts = new Map();
  if (before !== null) for (const v of analyze(before)) counts.set(v.key, (counts.get(v.key) ?? 0) + 1);
  const added = [];
  for (const v of analyze(after)) {
    const left = counts.get(v.key) ?? 0;
    if (left > 0) counts.set(v.key, left - 1);
    else added.push({ ...v, file });
  }
  return added;
}

export function isReactRepo(root) {
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    if (deps.react || deps.next) return true;
  }
  return ['js', 'mjs', 'cjs', 'ts'].some((ext) => existsSync(join(root, `next.config.${ext}`)));
}

const SKIP_FILE = /\.(test|spec)\.[jt]sx?$|\.d\.ts$|\.config\.[cm]?[jt]s$/;
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);

export function isReactTarget(file, content, repoIsReact) {
  if (SKIP_FILE.test(basename(file))) return false;
  const ext = extname(file);
  if (!SOURCE_EXT.has(ext)) return false;
  if (ext === '.tsx' || ext === '.jsx') return true;
  if (/from\s+['"](react|next(\/[^'"]*)?)['"]/.test(content ?? '')) return true;
  return repoIsReact;
}

function findRepoRoot(file) {
  let dir = dirname(file);
  while (true) {
    if (existsSync(join(dir, 'package.json')) || existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return dirname(file);
    dir = parent;
  }
}

/** Undo the edits on the current text, so the file as it was before the tool call can be compared. */
function reverseEdits(after, edits) {
  let text = after;
  for (const e of [...edits].reverse()) {
    if (!e.new_string) return null;
    const at = text.indexOf(e.new_string);
    if (at === -1 || text.indexOf(e.new_string, at + 1) !== -1) return null;
    text = text.slice(0, at) + e.old_string + text.slice(at + e.new_string.length);
  }
  return text;
}

/** Check a file for a Claude Code tool call. Returns whether the rules apply and what the call added. */
export function checkHookInput(input) {
  const path = input.tool_input?.file_path;
  if (!path) return { applies: false, violations: [] };
  const abs = isAbsolute(path) ? path : resolve(input.cwd ?? process.cwd(), path);
  if (!existsSync(abs)) return { applies: false, violations: [] };
  const after = readFileSync(abs, 'utf8');
  const root = findRepoRoot(abs);
  if (!isReactTarget(abs, after, isReactRepo(root))) return { applies: false, violations: [] };
  let before = null;
  if (input.tool_name === 'Edit') before = reverseEdits(after, [input.tool_input]);
  if (input.tool_name === 'MultiEdit') before = reverseEdits(after, input.tool_input.edits ?? []);
  const violations = newViolations(abs, before, after).map((v) => ({ ...v, file: relative(root, abs) }));
  return { applies: true, violations };
}

const GUIDANCE = [
  'Fix these before you go on (khubaib-react-practices):',
  '- One React component per file, named after the component. Split the others out.',
  '- A component file holds UI only. Move logic and effects into a use-*.ts hook. Plain state (useState, useId, useContext, useRef) can stay.',
  '- Tailwind: native classes and the theme scale only. No arbitrary values such as text-[11px]. Use a scale step or a token.',
].join('\n');

function describe(v) {
  if (v.rule === 'tailwind-arbitrary') return `${v.file}:${v.line} tailwind-arbitrary: ${v.token}`;
  if (v.rule === 'one-component-per-file') return `${v.file}:${v.line} one-component-per-file: ${v.name}`;
  return `${v.file}:${v.line} logic-hook-in-component: ${v.name}`;
}

async function readStdin() {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

async function main(argv) {
  if (argv[0] === '--hook') {
    let input;
    try {
      input = JSON.parse(await readStdin());
    } catch (error) {
      console.error(`khubaib-react-practices: could not read the tool call (${error.message}).`);
      return 1;
    }
    const result = checkHookInput(input);
    if (result.violations.length === 0) return 0;
    console.error(`${GUIDANCE}\n${result.violations.map(describe).join('\n')}`);
    return 2;
  }
  if (argv[0] === '--files') {
    let found = 0;
    for (const f of argv.slice(1)) {
      const abs = resolve(f);
      const text = readFileSync(abs, 'utf8');
      const root = findRepoRoot(abs);
      if (!isReactTarget(abs, text, isReactRepo(root))) continue;
      for (const v of analyze(text)) {
        found += 1;
        console.log(describe({ ...v, file: relative(root, abs) }));
      }
    }
    if (found) console.log(GUIDANCE);
    return found ? 1 : 0;
  }
  console.error('usage: react-practices.mjs --hook | --files <paths...>');
  return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.argv.slice(2));
}
