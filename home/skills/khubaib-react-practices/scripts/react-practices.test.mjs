// Tests for the React practices guard. Run: node --test home/skills/khubaib-react-practices/scripts/
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  checkHookInput,
  findArbitraryClasses,
  findComponentHookViolations,
  findMultipleComponents,
  isReactRepo,
  isReactTarget,
  newViolations,
} from './react-practices.mjs';

const script = fileURLToPath(new URL('./react-practices.mjs', import.meta.url));
const REACT_PKG = JSON.stringify({ dependencies: { react: '19.0.0' } });
const yes = () => true;
const no = () => false;

function tempRepo(files) {
  const root = mkdtempSync(join(tmpdir(), 'rp-'));
  for (const [name, text] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, text);
  }
  return root;
}

/** Run the hook as Claude Code does: the payload on stdin. */
function runHook(payload) {
  const input = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return spawnSync(process.execPath, [script, '--hook'], { input, encoding: 'utf8' });
}

/** A PostToolUse payload shaped like the one Claude Code 2.1 sends (captured from a live run). */
function editCall(root, file, originalFile, extra = {}) {
  return {
    cwd: root,
    hook_event_name: 'PostToolUse',
    tool_name: 'Edit',
    tool_input: { file_path: join(root, file), old_string: 'x', new_string: 'y', replace_all: false, ...extra },
    tool_response: { filePath: join(root, file), originalFile },
  };
}

function writeCall(root, file, content, originalFile) {
  return {
    cwd: root,
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: join(root, file), content },
    tool_response: { type: originalFile === null ? 'create' : 'update', filePath: join(root, file), content, originalFile },
  };
}

test('isReactRepo: react or next in package.json, or a next config', () => {
  assert.equal(isReactRepo(tempRepo({ 'package.json': REACT_PKG })), true);
  assert.equal(isReactRepo(tempRepo({ 'package.json': JSON.stringify({ devDependencies: { next: '16.0.0' } }) })), true);
  assert.equal(isReactRepo(tempRepo({ 'next.config.ts': 'export default {};' })), true);
  assert.equal(isReactRepo(tempRepo({ 'package.json': JSON.stringify({ dependencies: { zod: '4.0.0' } }) })), false);
  assert.equal(isReactRepo(tempRepo({})), false);
  assert.throws(() => isReactRepo(tempRepo({ 'package.json': '{ broken' })), /package\.json is not valid JSON/);
});

test('isReactTarget: a react file is always checked, other files only in a react repo or when they import react', () => {
  assert.equal(isReactTarget('a/card.tsx', '', no), true);
  assert.equal(isReactTarget('a/card.jsx', '', no), true);
  assert.equal(isReactTarget('lib/date.ts', 'export const x = 1;', no), false);
  assert.equal(isReactTarget('lib/hook.ts', "import { useState } from 'react';", no), true);
  assert.equal(isReactTarget('lib/hook.ts', "import Link from 'next/link';", no), true);
  assert.equal(isReactTarget('lib/date.ts', 'export const x = 1;', yes), true);
  assert.equal(isReactTarget('README.md', '', yes), false);
  assert.equal(isReactTarget('card.test.tsx', '', yes), false);
  assert.equal(isReactTarget('types.d.ts', '', yes), false);
  assert.equal(isReactTarget('next.config.ts', '', yes), false);
});

test('isReactTarget reads the repo only when it has to', () => {
  const boom = () => assert.fail('package.json should not be read');
  assert.equal(isReactTarget('README.md', '', boom), false);
  assert.equal(isReactTarget('card.tsx', '', boom), true);
});

test('findArbitraryClasses flags bracket values and properties, not scale classes', () => {
  assert.deepEqual(findArbitraryClasses('<p className="text-[11px] font-bold" />'), ['text-[11px]']);
  assert.deepEqual(findArbitraryClasses('"md:h-[190.6px]"'), ['md:h-[190.6px]']);
  assert.deepEqual(findArbitraryClasses('"[content-visibility:auto] p-2"'), ['[content-visibility:auto]']);
  assert.deepEqual(findArbitraryClasses('"grid-cols-[minmax(0,1fr)_auto]"'), ['grid-cols-[minmax(0,1fr)_auto]']);
  assert.deepEqual(findArbitraryClasses('"hover:!-mt-[2px] max-md:[transform:translateY(1px)]"'), ['hover:!-mt-[2px]', 'max-md:[transform:translateY(1px)]']);
  assert.deepEqual(findArbitraryClasses('"grid gap-3 text-13 gap-y-0.75 w-1/2 bg-black/50"'), []);
});

test('findArbitraryClasses ignores brackets in plain code, comments and regex literals', () => {
  assert.deepEqual(findArbitraryClasses('throw new Error("Row [index] is missing")'), []);
  assert.deepEqual(findArbitraryClasses('const first = items[0];'), []);
  assert.deepEqual(findArbitraryClasses('// was text-[11px] before the token\nconst a = 1;'), []);
  assert.deepEqual(findArbitraryClasses('/* old: w-[1px] */ const a = 1;'), []);
  assert.deepEqual(findArbitraryClasses('const ok = /a-[0-9]+/.test(s) && s.replace(/x-[a-z]/g, "");'), []);
  assert.deepEqual(findArbitraryClasses('const url = "https://example.com"; const c = "w-[1px]";'), ['w-[1px]']);
});

test('arbitrary variants pass, an arbitrary value after a variant still counts', () => {
  const variants = '"data-[state=open]:border-accent aria-[current=page]:text-accent has-[[aria-invalid=true]]:border-overdue min-[400px]:p-2 [&>p]:mt-2"';
  assert.deepEqual(findArbitraryClasses(variants), []);
  assert.deepEqual(findArbitraryClasses('"forced-colors:text-[HighlightText] data-[state=open]:w-[1px]"'), ['forced-colors:text-[HighlightText]', 'data-[state=open]:w-[1px]']);
});

test('comment markers inside strings, and a // comment before a block comment, hide nothing', () => {
  const doc = '// see src/*.ts\nexport function P() { return <p className="gap-[3px]" />; }\n/** doc */\n';
  assert.deepEqual(findArbitraryClasses(doc), ['gap-[3px]']);
  assert.deepEqual(findArbitraryClasses('const a = "x /* "; const c = "w-[1px]"; /* h-[2px] */'), ['w-[1px]']);
  assert.deepEqual(findArbitraryClasses("<p>Don't</p>\nconst c = 'w-[1px]'; // h-[2px]\n"), ['w-[1px]']);
});

test('findMultipleComponents counts top-level components of every common shape', () => {
  assert.deepEqual(findMultipleComponents('export function A() {}\nfunction B() {}\n'), ['A', 'B']);
  assert.deepEqual(findMultipleComponents('export function A(p) { return helper(p); }\nfunction helper(n) { return n; }\n'), ['A']);
  assert.deepEqual(findMultipleComponents('export const Card = memo(function Card() { return null; });\n'), ['Card']);
  assert.deepEqual(findMultipleComponents('export default async function Page() {}\n'), ['Page']);
  assert.deepEqual(findMultipleComponents('export const Row = props => <tr />;\n'), ['Row']);
  assert.deepEqual(findMultipleComponents('export const Field = forwardRef<HTMLInputElement, Props>((p, ref) => null);\n'), ['Field']);
  assert.deepEqual(findMultipleComponents('export const Page = async () => null;\n'), ['Page']);
});

test('findMultipleComponents skips constants in capitals and counts generic arrows', () => {
  assert.deepEqual(findMultipleComponents('export const MAX = (1 + 2) * 3;\nexport const API_URL = (x) => x;\n'), []);
  assert.deepEqual(findMultipleComponents('export const List = <T,>(p: Props<T>) => null;\n'), ['List']);
});

test('a .ts file has no components, so PascalCase factories in a util never block', () => {
  const util = 'export const Schema = (v) => v;\nexport const Config = (p) => p;\nexport function Pick() { useMemo(() => 1, []); }\n';
  assert.deepEqual(newViolations('lib/schemas.ts', null, util), []);
  assert.equal(newViolations('lib/schemas.tsx', null, util).length, 3, 'the same text in a .tsx is three components; the hook passes in a file this small');
});

test('findComponentHookViolations allows plain state and use- module hooks, flags the rest', () => {
  assert.deepEqual(
    findComponentHookViolations("import { useEffect } from 'react';\nexport function A() { useEffect(() => {}); }\n"),
    ['useEffect'],
  );
  assert.deepEqual(
    findComponentHookViolations(
      "import { useState } from 'react';\nimport { useCards } from './use-cards';\nexport function A() { const [x] = useState<number>(0); useCards(); }\n",
    ),
    [],
  );
  assert.deepEqual(findComponentHookViolations("import { useThing } from './things';\nexport function A() { useThing(); }\n"), ['useThing']);
});

test('findComponentHookViolations allows aliased and default imports from a use- module', () => {
  const src = [
    "import useFoo from './use-foo';",
    "import { useBar as useBaz } from './use-bar';",
    "import useQux, { useQuux } from '@/features/x/use-qux';",
    'export function A() { useFoo(); useBaz(); useQux(); useQuux(); return null; }',
  ].join('\n');
  assert.deepEqual(findComponentHookViolations(src), []);
});

test('findComponentHookViolations catches React.useX and a hook written in the component file', () => {
  assert.deepEqual(findComponentHookViolations('export function A() { React.useEffect(() => {}); }\n'), ['useEffect']);
  const local = 'function useTicker() { return 1; }\nexport function A() { const t = useTicker(); return t; }\n';
  assert.deepEqual(findComponentHookViolations(local), ['useTicker']);
});

/** A component file with `hooks` logic hook calls, padded with JSX lines to `lines` non-blank lines. */
function component(hooks, lines) {
  const head = ["import { useRouter, usePathname, useSearchParams } from 'next/navigation';", 'export function Nav() {'];
  const calls = ['  const router = useRouter();', '  const path = usePathname();', '  const query = useSearchParams();'].slice(0, hooks);
  const tail = ['  return <nav />;', '}'];
  const pad = Array.from({ length: lines - head.length - calls.length - tail.length }, (_, i) => `  // line ${i}`);
  return [...head, ...calls, ...pad, ...tail, ''].join('\n');
}

test('a small component may call up to two logic hooks itself', () => {
  const hooks = (text) => newViolations('nav.tsx', null, text).filter((v) => v.rule === 'logic-hook-in-component').map((v) => v.name);
  assert.deepEqual(hooks(component(2, 40)), [], '40 non-blank lines and two hooks is small');
  assert.deepEqual(hooks(component(3, 40)), ['useRouter', 'usePathname', 'useSearchParams'], 'three hooks is not');
  assert.deepEqual(hooks(component(1, 41)), ['useRouter'], '41 non-blank lines is not');
  const blankLines = component(2, 40).replace(/\n/g, '\n\n');
  assert.deepEqual(hooks(blankLines), [], 'blank lines do not count');
});

test('a small component that grows past the limit owns its hooks from then on', () => {
  const added = newViolations('nav.tsx', component(2, 40), component(2, 41)).map((v) => v.name);
  assert.deepEqual(added, ['useRouter', 'usePathname']);
});

test('newViolations reports only what a change added', () => {
  const before = 'export function A() { return <p className="text-[11px]" />; }\n';
  const after = 'export function A() { return <p className="text-[11px] grid-cols-[1fr_auto]" />; }\n';
  assert.deepEqual(newViolations('a.tsx', before, after).map((v) => v.token), ['grid-cols-[1fr_auto]']);
  assert.deepEqual(newViolations('a.tsx', before, before), []);
  assert.equal(newViolations('a.tsx', null, after).length, 2, 'a new file owns every violation in it');
});

test('hook: an Edit is judged against the original file, so old violations pass', () => {
  const original = 'export function Card() {\n  const z = 1;\n  return <p className="w-[1px]" />;\n}\n';
  const after = 'export function Card() {\n  return <p className="w-[1px]" />;\n}\n';
  const root = tempRepo({ 'package.json': REACT_PKG, 'card.tsx': after });
  // Deleting a line, which an empty new_string does, keeps the old w-[1px] and adds nothing.
  assert.deepEqual(checkHookInput(editCall(root, 'card.tsx', original, { old_string: '  const z = 1;\n', new_string: '' })).violations, []);
  // replace_all and a new_string that appears more than once make no difference either.
  assert.deepEqual(checkHookInput(editCall(root, 'card.tsx', original, { new_string: 'w', replace_all: true })).violations, []);
});

test('hook: an Edit that adds a violation names only the new one', () => {
  const original = 'export function Card() { return <p className="text-[11px]" />; }\n';
  const after = 'export function Card() { return <p className="text-[11px] gap-[3px]" />; }\n';
  const root = tempRepo({ 'package.json': REACT_PKG, 'card.tsx': after });
  const result = checkHookInput(editCall(root, 'card.tsx', original));
  assert.deepEqual(result.violations.map((v) => v.token), ['gap-[3px]']);
  assert.equal(result.violations[0].file, 'card.tsx');
});

test('hook: a Write over an existing file keeps its old violations, a new file owns all of them', () => {
  const text = 'export function A() { return <p className="text-[11px]" />; }\n';
  const root = tempRepo({ 'package.json': REACT_PKG, 'a.tsx': text });
  assert.deepEqual(checkHookInput(writeCall(root, 'a.tsx', text, text)).violations, []);
  assert.equal(checkHookInput(writeCall(root, 'a.tsx', text, null)).violations.length, 1);
});

test('hook: exits 2 with the file and the rule when a call adds a violation', () => {
  const text = 'export function A() { return <p className="text-[11px]" />; }\n';
  const root = tempRepo({ 'package.json': JSON.stringify({ dependencies: { next: '16.0.0' } }), 'app/page.tsx': text });
  const run = runHook(writeCall(root, 'app/page.tsx', text, null));
  assert.equal(run.status, 2);
  assert.match(run.stderr, /app\/page\.tsx:1 tailwind-arbitrary: text-\[11px\]/);
});

test('hook: silent outside a react repo, on non-source files, and for other tools', () => {
  const plain = tempRepo({ 'package.json': JSON.stringify({ dependencies: { zod: '4.0.0' } }), 'lib/x.ts': 'const s = "text-[11px]";\n' });
  for (const payload of [
    writeCall(plain, 'lib/x.ts', 'const s = "text-[11px]";\n', null),
    { ...writeCall(plain, 'lib/x.ts', '', null), tool_name: 'NotebookEdit' },
  ]) {
    const run = runHook(payload);
    assert.equal(run.status, 0);
    assert.equal(run.stderr, '');
  }
  // A broken package.json does not matter for a file the guard never checks.
  const broken = tempRepo({ 'package.json': '{ broken', 'README.md': '# hi\n' });
  const md = runHook(writeCall(broken, 'README.md', '# hi\n', null));
  assert.equal(md.status, 0);
  assert.equal(md.stderr, '');
});

test('hook: in a monorepo, react in the root package.json covers a package without it', () => {
  const root = tempRepo({
    '.git/HEAD': 'ref: refs/heads/main\n',
    'package.json': REACT_PKG,
    'apps/web/package.json': JSON.stringify({ name: 'web' }),
    'apps/web/lib/x.ts': 'export const c = "w-[1px]";\n',
  });
  const result = checkHookInput(writeCall(root, 'apps/web/lib/x.ts', 'export const c = "w-[1px]";\n', null));
  assert.equal(result.applies, true);
  assert.deepEqual(result.violations.map((v) => v.file), ['apps/web/lib/x.ts']);
});

test('hook: bad input fails with one clear message and exit 1, never a stack trace or a block', () => {
  const root = tempRepo({ 'package.json': '{ broken', 'lib/x.ts': 'export const a = 1;\n', 'card.tsx': 'export const a = 1;\n' });
  const noOriginal = writeCall(root, 'card.tsx', 'export const a = 1;\n', null);
  delete noOriginal.tool_response.originalFile;
  const cases = [
    ['not json', /could not read the tool call/],
    ['null', /not a JSON object/],
    [{ tool_name: 'Edit', tool_input: { file_path: 7 } }, /no file_path/],
    [writeCall(root, 'lib/x.ts', 'export const a = 1;\n', null), /package\.json is not valid JSON/],
    [noOriginal, /no tool_response\.originalFile/],
  ];
  for (const [payload, message] of cases) {
    const run = runHook(payload);
    assert.equal(run.status, 1, `exit for ${JSON.stringify(payload).slice(0, 60)}`);
    assert.match(run.stderr, message);
    assert.doesNotMatch(run.stderr, /\n\s+at /, 'no stack trace');
  }
});

test('--files prints every violation in a react file and exits 1', () => {
  const root = tempRepo({ 'package.json': REACT_PKG, 'a.tsx': 'export function A() {}\nexport function B() { return <p className="w-[1px]" />; }\n' });
  const run = spawnSync(process.execPath, [script, '--files', join(root, 'a.tsx')], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stdout, /a\.tsx:1 one-component-per-file: A/);
  assert.match(run.stdout, /a\.tsx:2 tailwind-arbitrary: w-\[1px\]/);
  const clean = tempRepo({ 'package.json': REACT_PKG, 'b.tsx': 'export function B() { return <p className="p-2" />; }\n' });
  assert.equal(spawnSync(process.execPath, [script, '--files', join(clean, 'b.tsx')], { encoding: 'utf8' }).status, 0);
});

test('the hook runs when its folder is reached through a symlink, as setup installs it', () => {
  const text = 'export function A() { return <p className="text-[11px]" />; }\n';
  const root = tempRepo({ 'package.json': REACT_PKG, 'a.tsx': text });
  const linked = join(mkdtempSync(join(tmpdir(), 'rp-link-')), 'scripts');
  symlinkSync(dirname(script), linked);
  const run = spawnSync(process.execPath, [join(linked, 'react-practices.mjs'), '--hook'], {
    input: JSON.stringify(writeCall(root, 'a.tsx', text, null)),
    encoding: 'utf8',
  });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /a\.tsx:1 tailwind-arbitrary: text-\[11px\]/);
});

test('a file in a folder whose name starts with two dots is still shown relative to the session', () => {
  const text = 'export function A() { return <p className="w-[1px]" />; }\n';
  const root = tempRepo({ 'package.json': REACT_PKG, '..notes/a.tsx': text });
  assert.deepEqual(checkHookInput(writeCall(root, '..notes/a.tsx', text, null)).violations.map((v) => v.file), ['..notes/a.tsx']);
});
