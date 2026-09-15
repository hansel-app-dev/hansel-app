import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('sign-photos REQ-001: API development uses live contracts rather than stale build output', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { scripts: { dev: string } };
  const conditions = manifest.scripts.dev.match(/--conditions=\S+/g) ?? [];
  const result = spawnSync(
    process.execPath,
    [
      ...conditions,
      '--input-type=module',
      '-e',
      'console.log(import.meta.resolve("@hansel/contracts"))',
    ],
    { cwd: new URL('..', import.meta.url), encoding: 'utf8' },
  );
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toMatch(/\/contracts\/src\/index\.ts$/);
});
