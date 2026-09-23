import {
  mkdtempSync,
  realpathSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

describe('Sandbox release progression [lightsail-sandbox REQ-005]', () => {
  it.each([0, 1])(
    'migration exit %s gates service replacement',
    (migrationStatus) => {
      const scratch = realpathSync(
        mkdtempSync(join(tmpdir(), 'sandbox-release-')),
      );
      try {
        const config = join(scratch, 'config');
        const root = join(scratch, 'app');
        const bin = join(scratch, 'bin');
        const release = join(root, 'releases', 'a'.repeat(40));
        for (const path of [config, bin, release])
          mkdirSync(path, { recursive: true });
        writeFileSync(join(config, 'environment'), 'sandbox');
        writeFileSync(
          join(config, 'address.env'),
          'SANDBOX_ADDRESS=203.0.113.1\n',
        );
        let script = readFileSync(
          new URL('../../deploy/sandbox/activate.sh', import.meta.url),
          'utf8',
        );
        script = script
          .replaceAll('/etc/hansel-sandbox', config)
          .replaceAll('/opt/hansel-sandbox', root)
          .replace('/run/hansel-sandbox-release.lock', join(scratch, 'lock'));
        writeFileSync(join(scratch, 'activate.sh'), script);
        for (const command of ['flock', 'sha256sum', 'curl'])
          writeFileSync(join(bin, command), '#!/bin/sh\nexit 0\n', {
            mode: 0o755,
          });
        writeFileSync(
          join(bin, 'docker'),
          `#!/bin/sh\nprintf '%s\\n' "$*" >> "$CALL_LOG"\ncase "$*" in *'run --rm --no-deps api node scripts/migrate.mjs'*) exit ${String(migrationStatus)};; esac\nexit 0\n`,
          { mode: 0o755 },
        );
        const result = spawnSync(
          'bash',
          [join(scratch, 'activate.sh'), release],
          {
            encoding: 'utf8',
            env: {
              ...process.env,
              PATH: `${bin}:${process.env.PATH ?? ''}`,
              CALL_LOG: join(scratch, 'calls'),
            },
          },
        );
        expect(result.status, result.stderr).toBe(migrationStatus);
        const calls = readFileSync(join(scratch, 'calls'), 'utf8');
        expect(calls.includes('up -d --wait --wait-timeout 180 api web')).toBe(
          migrationStatus === 0,
        );
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    },
  );
});
