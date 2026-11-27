#!/usr/bin/env node
// Guard for Khubaib's React and Next practices (see ../SKILL.md). No dependencies.
//
// It runs only where the rules apply: in a project whose package.json depends on react or next,
// or on a target file that is React (.tsx or .jsx, or a file that imports react or next).
// Anywhere else it stays silent.
//
// Modes:
//   --hook           Claude Code PostToolUse hook for Edit and Write. Reads the tool call on stdin.
//                    Exits 2 with feedback for Claude when the call adds a violation. Violations the
//                    file already had pass, so older files stay editable.
//   --files <paths>  Check named files and print every violation. Exits 1 if there are any.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const SIMPLE_HOOKS = new Set(['useState', 'useId', 'useContext', 'useRef']);
// A component this small may call a couple of logic hooks itself (ruled by Khubaib, 2026-11-27).
const SMALL_COMPONENT_LINES = 40;
const SMALL_COMPONENT_HOOKS = 2;
const TOKEN_SPLIT = /[\s'"`{};<>]+/;
// One capital, or PascalCase with a lower-case letter, so constants such as MAX or API_URL are not components.
const PASCAL = '[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*)?';
const COMPONENT_DECL = new RegExp(
  `^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?(?:function\\s+(${PASCAL})\\s*[<(]|const\\s+(${PASCAL})\\s*(?::[^=\\n]+)?=\\s*(?:memo\\s*(?:<[^>\\n]*>)?\\(|forwardRef\\s*(?:<[^>\\n]*>)?\\(|<[^>\\n]*>\\s*\\(|\\(|function\\b|async\\s*\\(|[a-z_$][\\w$]*\\s*=>))`,
  'gm',
);
// A hook call: useX(...), React.useX(...) or useX<T>(...). A `function useX(` declaration is not a call.
const HOOK_CALL = /(?<![\w.$])(?<!function\s+)(?:React\.)?(use[A-Z]\w*)\s*(?:<[^>()\n]*>)?\s*\(/g;

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/**
 * Blank out comments with spaces, so offsets and line numbers still match the original text.
 * Quotes are tracked so `//` and `/*` inside strings stay. A ' or " string ends at the line break,
 * so an apostrophe in JSX text can't swallow the rest of the file.
 */
function stripComments(text) {
  let out = '';
  let quote = null;
  for (let i = 0; i < text.length; ) {
    const c = text[i];
    const next = text[i + 1];
    if (quote) {
      if (c === '\\') {
        out += text.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === quote || (c === '\n' && quote !== '`')) quote = null;
      out += c;
      i += 1;
    } else if (c === '/' && (next === '/' || next === '*')) {
      const close = next === '/' ? text.indexOf('\n', i) : text.indexOf('*/', i + 2);
      const stop = close === -1 ? text.length : next === '/' ? close : close + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else {
      if (c === '"' || c === "'" || c === '`') quote = c;
      out += c;
      i += 1;
    }
  }
  return out;
}

/** Split a class on the colons that separate variants, ignoring colons inside brackets. */
function segments(token) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i += 1) {
    if (token[i] === '[') depth += 1;
    else if (token[i] === ']') depth -= 1;
    else if (token[i] === ':' && depth === 0) {
      out.push(token.slice(start, i));
      start = i + 1;
    }
  }
  out.push(token.slice(start));
  return out;
}

/**
 * Arbitrary value (`text-[11px]`) or arbitrary property (`[content-visibility:auto]`) in the utility,
 * the part after the last variant. Arbitrary variants such as `data-[state=open]:` pass.
 */
function isArbitrary(token) {
  const utility = segments(token).pop() ?? '';
  return /^!?-?[a-z][a-z0-9-]*-\[[^\]]+\]/.test(utility) || /^!?\[[^\]]*:[^\]]*\]!?$/.test(utility);
}

export function findArbitraryClasses(text) {
  return stripComments(text)
    .split(TOKEN_SPLIT)
    .filter((token) => token && isArbitrary(token));
}

function arbitraryHits(text) {
  const hits = [];
  stripComments(text)
    .split('\n')
    .forEach((line, i) => {
      for (const token of line.split(TOKEN_SPLIT)) if (token && isArbitrary(token)) hits.push({ token, line: i + 1 });
    });
  return hits;
}

function componentHits(text) {
  return [...stripComments(text).matchAll(COMPONENT_DECL)].map((m) => ({ name: m[1] ?? m[2], line: lineOf(text, m.index) }));
}

export function findMultipleComponents(text) {
  return componentHits(text).map((c) => c.name);
}

/** Local names of hooks imported from a module whose file name starts with use-: named, aliased or default. */
function importedUseNames(text) {
  const names = new Set();
  for (const m of text.matchAll(/import\s+(?:type\s+)?([^'"]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    if (!(m[2].split('/').pop() ?? '').startsWith('use-')) continue;
    const clause = m[1];
    const named = clause.match(/\{([^}]*)\}/);
    const defaultName = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim();
    if (/^[A-Za-z_$][\w$]*$/.test(defaultName)) names.add(defaultName);
    for (const spec of named ? named[1].split(',') : []) {
      const local = spec.trim().split(/\s+as\s+/).pop()?.trim();
      if (local) names.add(local);
    }
  }
  return names;
}

function hookHits(text) {
  const allowed = importedUseNames(text);
  const hits = [];
  for (const m of stripComments(text).matchAll(HOOK_CALL)) {
    const name = m[1];
    if (SIMPLE_HOOKS.has(name) || allowed.has(name)) continue;
    hits.push({ name, line: lineOf(text, m.index) });
  }
  return hits;
}

export function findComponentHookViolations(text) {
  return hookHits(text).map((h) => h.name);
}

/** Every violation in one file's text, with its line. A .ts file can't hold JSX, so it has no components. */
export function analyze(text, file = '') {
  const violations = [];
  for (const h of arbitraryHits(text)) {
    violations.push({ rule: 'tailwind-arbitrary', key: `tailwind:${h.token}`, token: h.token, line: h.line });
  }
  const components = /\.ts$/.test(file) ? [] : componentHits(text);
  if (components.length > 1) {
    for (const c of components) violations.push({ rule: 'one-component-per-file', key: `component:${c.name}`, name: c.name, line: c.line });
  }
  const hooks = components.length > 0 ? hookHits(text) : [];
  const nonBlankLines = text.split('\n').filter((line) => line.trim() !== '').length;
  const small = nonBlankLines <= SMALL_COMPONENT_LINES && hooks.length <= SMALL_COMPONENT_HOOKS;
  if (!small) {
    for (const h of hooks) violations.push({ rule: 'logic-hook-in-component', key: `hook:${h.name}`, name: h.name, line: h.line });
  }
  return violations.sort((a, b) => a.line - b.line);
}

/** Violations in `after` that `before` did not already have. `before` null means a new file. */
export function newViolations(file, before, after) {
  const counts = new Map();
  if (before !== null) for (const v of analyze(before, file)) counts.set(v.key, (counts.get(v.key) ?? 0) + 1);
  const added = [];
  for (const v of analyze(after, file)) {
    const left = counts.get(v.key) ?? 0;
    if (left > 0) counts.set(v.key, left - 1);
    else added.push({ ...v, file });
  }
  return added;
}

export function isReactRepo(root) {
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    } catch (error) {
      throw new Error(`${pkgPath} is not valid JSON (${error.message})`, { cause: error });
    }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    if (deps.react || deps.next) return true;
  }
  return ['js', 'mjs', 'cjs', 'ts'].some((ext) => existsSync(join(root, `next.config.${ext}`)));
}

/** Any package.json from the file's folder up to the git root says React or Next, so monorepo roots count. */
function inReactProject(file) {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    if (isReactRepo(dir)) return true;
    if (existsSync(join(dir, '.git')) || dirname(dir) === dir) return false;
  }
}

const SKIP_FILE = /\.(test|spec)\.[jt]sx?$|\.d\.ts$|\.config\.[cm]?[jt]s$/;
const SOURCE_FILE = /\.[jt]sx?$/;

/** `repoIsReact` is a function, so package.json is read only for source files that need it. */
export function isReactTarget(file, content, repoIsReact) {
  const name = basename(file);
  if (SKIP_FILE.test(name) || !SOURCE_FILE.test(name)) return false;
  if (/\.[jt]sx$/.test(name)) return true;
  if (/from\s+['"](react|next(\/[^'"]*)?)['"]/.test(content)) return true;
  return repoIsReact();
}

/** The path as the session sees it: relative to its folder when inside it, absolute otherwise. */
function shown(abs, cwd) {
  const rel = relative(cwd, abs);
  return rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel) ? abs : rel;
}

/** Check an Edit or Write call. Returns whether the rules apply and what the call added. */
export function checkHookInput(input) {
  if (typeof input !== 'object' || input === null) throw new Error('the hook input is not a JSON object');
  if (input.tool_name !== 'Edit' && input.tool_name !== 'Write') return { applies: false, violations: [] };
  const path = input.tool_input?.file_path;
  if (typeof path !== 'string' || path === '') throw new Error(`${input.tool_name} call has no file_path`);
  const abs = isAbsolute(path) ? path : resolve(input.cwd ?? process.cwd(), path);
  const name = basename(abs);
  if (SKIP_FILE.test(name) || !SOURCE_FILE.test(name)) return { applies: false, violations: [] };
  const after = readFileSync(abs, 'utf8');
  if (!isReactTarget(abs, after, () => inReactProject(abs))) return { applies: false, violations: [] };
  // Claude Code sends the file as it was before the call: a string, or null for a new file.
  const response = input.tool_response;
  if (typeof response !== 'object' || response === null || !('originalFile' in response)) {
    throw new Error(`${input.tool_name} result has no tool_response.originalFile, so old and new violations cannot be told apart. Update Claude Code.`);
  }
  const before = response.originalFile;
  if (before !== null && typeof before !== 'string') throw new Error('tool_response.originalFile is neither text nor null');
  const violations = newViolations(shown(abs, input.cwd ?? process.cwd()), before, after);
  return { applies: true, violations };
}

const GUIDANCE = [
  'Fix these before you go on (khubaib-react-practices):',
  '- One React component per file, named after the component. Split the others out.',
  '- A component file holds UI only. Move logic and effects into a use-*.ts hook. Plain state (useState, useId, useContext, useRef) can stay, and a component of 40 non-blank lines or fewer may call up to two logic hooks itself.',
  '- Tailwind: native classes and the theme scale only. No arbitrary values such as text-[11px]. Use a scale step or a token. Arbitrary variants such as data-[state=open]: are fine.',
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
      throw new Error(`could not read the tool call on stdin (${error.message})`, { cause: error });
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
      if (!isReactTarget(abs, text, () => inReactProject(abs))) continue;
      for (const v of analyze(text, abs)) {
        found += 1;
        console.log(describe({ ...v, file: shown(abs, process.cwd()) }));
      }
    }
    if (found) console.log(GUIDANCE);
    return found ? 1 : 0;
  }
  console.error('usage: react-practices.mjs --hook | --files <paths...>');
  return 1;
}

// Compare real paths: setup links the skill folder into ~/.claude, and Node resolves the symlink in
// import.meta.url but not in argv[1].
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    // Exit 1, not 2: Claude Code shows exit 1 to the user without blocking the edit, while exit 2
    // would hand a guard failure to Claude as if it were a rule violation.
    console.error(`khubaib-react-practices: ${error.message}`);
    process.exitCode = 1;
  }
}
