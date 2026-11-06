import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import prettier from 'prettier';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const eslint = new ESLint({ cwd: repoRoot });

async function lintText(code, relativePath) {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(repoRoot, relativePath),
  });

  return result;
}

const prettierOptions = await prettier.resolveConfig(path.join(repoRoot, 'apps/web/src/App.tsx'));

await test('eslint accepts clean API code', async () => {
  const result = await lintText(
    'export function add(left: number, right: number): number {\n  return left + right;\n}\n',
    'apps/api/src/health.controller.ts',
  );

  assert.equal(result.errorCount, 0);
});

await test('eslint accepts clean web code', async () => {
  const result = await lintText(
    'export function Hello() {\n  return <p>Hello</p>;\n}\n',
    'apps/web/src/App.tsx',
  );

  assert.equal(result.errorCount, 0);
});

await test('eslint rejects unsafe TypeScript', async () => {
  const result = await lintText(
    'export const value: any = 1;\n',
    'apps/api/src/health.controller.ts',
  );

  assert.ok(result.errorCount > 0, 'expected an error for an explicit any');
});

await test('eslint rejects a conditional React hook', async () => {
  const result = await lintText(
    [
      "import { useState } from 'react';",
      '',
      'export function Broken({ flag }: { flag: boolean }) {',
      '  if (flag) {',
      '    useState(0);',
      '  }',
      '  return null;',
      '}',
      '',
    ].join('\n'),
    'apps/web/src/App.tsx',
  );

  assert.ok(result.errorCount > 0, 'expected an error for a conditional hook');
});

await test('eslint ignores build output', async () => {
  const ignored = await eslint.isPathIgnored(path.join(repoRoot, 'apps/web/dist/index.js'));

  assert.equal(ignored, true);
});

await test('prettier accepts formatted code', async () => {
  const formatted = "const greeting = 'hello';\n";

  assert.equal(
    await prettier.check(formatted, { ...prettierOptions, filepath: 'fixture.ts' }),
    true,
  );
});

await test('prettier rejects and rewrites misformatted code', async () => {
  const misformatted = 'const greeting = "hello"\n';
  const options = { ...prettierOptions, filepath: 'fixture.ts' };

  assert.equal(await prettier.check(misformatted, options), false);
  assert.equal(await prettier.format(misformatted, options), "const greeting = 'hello';\n");
});

await test('prettier ignores the lockfile', async () => {
  const info = await prettier.getFileInfo(path.join(repoRoot, 'package-lock.json'), {
    ignorePath: path.join(repoRoot, '.prettierignore'),
  });

  assert.equal(info.ignored, true);
});
