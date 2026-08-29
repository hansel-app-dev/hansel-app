import { spawnSync } from 'node:child_process';
import { configureDatabaseUrl } from '../dist/database-url.js';

configureDatabaseUrl(process.env);
const result = spawnSync(
  '/app/node_modules/.bin/prisma',
  ['migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
  { cwd: '/app', stdio: 'inherit', env: process.env },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
