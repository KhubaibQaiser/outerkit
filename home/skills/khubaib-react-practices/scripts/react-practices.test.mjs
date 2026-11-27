// Tests for the React practices guard. Run: node --test home/skills/khubaib-react-practices/scripts/
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  findArbitraryClasses,
  findComponentHookViolations,
  findMultipleComponents,
  isReactRepo,
  isReactTarget,
  newViolations,
  checkHookInput,
} from './react-practices.mjs';

const script = fileURLToPath(new URL('./react-practices.mjs', import.meta.url));

function tempRepo(files) {
  const root = mkdtempSync(join(tmpdir(), 'rp-'));
  for (const [name, text] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, text);
  }
  return root;
}

test('isReactRepo: react or next in package.json, or a next config', () => {
  const react = tempRepo({ 'package.json': JSON.stringify({ dependencies: { react: '19.0.0' } }) });
  const next = tempRepo({ 'package.json': JSON.stringify({ devDependencies: { next: '16.0.0' } }) });
  const cfg = tempRepo({ 'next.config.ts': 'export default {};' });
  const plain = tempRepo({ 'package.json': JSON.stringify({ dependencies: { zod: '4.0.0' } }) });
  const none = tempRepo({});
  assert.equal(isReactRepo(react), true);
  assert.equal(isReactRepo(next), true);
  assert.equal(isReactRepo(cfg), true);
  assert.equal(isReactRepo(plain), false);
  assert.equal(isReactRepo(none), false);
});

test('isReactTarget: a react file is always checked, other files only in a react repo or when they import react', () => {
  assert.equal(isReactTarget('a/card.tsx', '', false), true);
  assert.equal(isReactTarget('a/card.jsx', '', false), true);
  assert.equal(isReactTarget('lib/date.ts', 'export const x = 1;', false), false);
  assert.equal(isReactTarget('lib/hook.ts', "import { useState } from 'react';", false), true);
  assert.equal(isReactTarget('lib/hook.ts', "import Link from 'next/link';", false), true);
  assert.equal(isReactTarget('lib/date.ts', 'export const x = 1;', true), true);
  assert.equal(isReactTarget('README.md', '', true), false);
  assert.equal(isReactTarget('card.test.tsx', '', true), false);
  assert.equal(isReactTarget('types.d.ts', '', true), false);
});

test('findArbitraryClasses flags bracket values and properties, not scale classes', () => {
  assert.deepEqual(findArbitraryClasses('<p className="text-[11px] font-bold" />'), ['text-[11px]']);
  assert.deepEqual(findArbitraryClasses('"md:h-[190.6px]"'), ['md:h-[190.6px]']);
  assert.deepEqual(findArbitraryClasses('"[content-visibility:auto] p-2"'), ['[content-visibility:auto]']);
  assert.deepEqual(findArbitraryClasses('"grid gap-3 text-13 gap-y-0.75"'), []);
  assert.deepEqual(findArbitraryClasses('throw new Error("Row [index] is missing")'), []);
});

test('findMultipleComponents counts top-level components only', () => {
  assert.deepEqual(findMultipleComponents('export function A() {}\nfunction B() {}\n'), ['A', 'B']);
  assert.deepEqual(findMultipleComponents('export function A(p) { return helper(p); }\nfunction helper(n) { return n; }\n'), ['A']);
  assert.deepEqual(findMultipleComponents('export const C = memo(function C() { return null; });\n'), ['C']);
});

test('findComponentHookViolations allows plain state and use- module hooks, flags the rest', () => {
  assert.deepEqual(
    findComponentHookViolations("import { useEffect } from 'react';\nexport function A() { useEffect(() => {}); }\n"),
    ['useEffect'],
  );
  assert.deepEqual(
    findComponentHookViolations(
      "import { useState } from 'react';\nimport { useCards } from './use-cards';\nexport function A() { const [x] = useState(0); useCards(); }\n",
    ),
    [],
  );
});

test('newViolations reports only what an edit added', () => {
  const before = 'export function A() { return <p className="text-[11px]" />; }\n';
  const after = 'export function A() { return <p className="text-[11px] grid-cols-[1fr_auto]" />; }\n';
  const added = newViolations('a.tsx', before, after);
  assert.deepEqual(added.map((v) => v.token), ['grid-cols-[1fr_auto]']);
  assert.deepEqual(newViolations('a.tsx', before, before), []);
  // Without a before text, every violation in the file counts as new: two here.
  assert.equal(newViolations('a.tsx', null, after).length, 2);
});

test('checkHookInput: an Edit is judged by what it adds, not by the old text it keeps', () => {
  const root = tempRepo({
    'package.json': JSON.stringify({ dependencies: { react: '19.0.0' } }),
    'card.tsx': 'export function Card() { return <p className="text-[11px] gap-[3px]" />; }\n',
  });
  // The file already had text-[11px]; the edit only added gap-[3px].
  const result = checkHookInput({
    cwd: root,
    tool_name: 'Edit',
    tool_input: {
      file_path: join(root, 'card.tsx'),
      old_string: 'className="text-[11px]"',
      new_string: 'className="text-[11px] gap-[3px]"',
    },
  });
  assert.deepEqual(result.violations.map((v) => v.token), ['gap-[3px]']);
});

test('the hook is silent outside a react repo for a plain ts file', () => {
  const root = tempRepo({ 'package.json': JSON.stringify({ dependencies: { zod: '4.0.0' } }), 'lib/x.ts': 'const s = "text-[11px]";\n' });
  const run = spawnSync(process.execPath, [script, '--hook'], {
    input: JSON.stringify({ cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, 'lib/x.ts'), content: 'const s = "text-[11px]";\n' } }),
    encoding: 'utf8',
  });
  assert.equal(run.status, 0);
  assert.equal(run.stderr, '');
});

test('the hook blocks a react edit that adds a violation, and names the file and the rule', () => {
  const root = tempRepo({
    'package.json': JSON.stringify({ dependencies: { next: '16.0.0' } }),
    'app/page.tsx': 'export function A() { return <p className="text-[11px]" />; }\n',
  });
  const run = spawnSync(process.execPath, [script, '--hook'], {
    input: JSON.stringify({ cwd: root, tool_name: 'Write', tool_input: { file_path: join(root, 'app/page.tsx'), content: 'export function A() { return <p className="text-[11px]" />; }\n' } }),
    encoding: 'utf8',
  });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /app\/page\.tsx/);
  assert.match(run.stderr, /text-\[11px\]/);
});
