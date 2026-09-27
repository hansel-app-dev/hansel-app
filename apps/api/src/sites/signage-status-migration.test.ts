/** @spec signage-schedule-remove-status REQ-004,005 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';

it.skipIf(process.env.SIGN_STATUS_MIGRATION_INTEGRATION !== 'true')(
  'removes all legacy statuses and preserves other Sign data and references',
  () => {
    const migration = readFileSync(
      new URL(
        '../../prisma/migrations/20260927000000_remove_sign_status/migration.sql',
        import.meta.url,
      ),
      'utf8',
    );
    const schema = `status_test_${randomUUID().replaceAll('-', '')}`;
    const run = (sql: string) =>
      execFileSync(
        'docker',
        [
          'compose',
          'exec',
          '-T',
          'postgres',
          'psql',
          '-U',
          'hansel',
          '-d',
          'hansel',
          '-v',
          'ON_ERROR_STOP=1',
          '-At',
        ],
        {
          input: `SET search_path TO "${schema}";\n${sql}`,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: new URL('../../../../', import.meta.url),
        },
      );
    try {
      run(`CREATE SCHEMA "${schema}";
        CREATE TYPE "SignStatus" AS ENUM ('UNSPECIFIED','IN_PROGRESS','APPROVED');
        CREATE TABLE "Sign" (LIKE public."Sign" INCLUDING ALL);
        ALTER TABLE "Sign" DROP COLUMN IF EXISTS status;
        ALTER TABLE "Sign" ADD status "SignStatus" NOT NULL DEFAULT 'UNSPECIFIED';
        CREATE TABLE "Reference" (id integer PRIMARY KEY, "signId" uuid REFERENCES "Sign"(id), kind text, value jsonb);
        INSERT INTO "Sign" (id,"tenantId","siteId","signTypeId",code,"normalizedCode",quantity,location,content,comments,status,"updatedAt")
          SELECT ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
            '00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000020',
            '00000000-0000-4000-8000-000000000030', 'SG.' || n, 'sg.' || n, n,
            'Lobby', 'Exit', 'Keep', s::"SignStatus", '2026-09-27T00:00:00Z'
          FROM (VALUES (1,'UNSPECIFIED'),(2,'IN_PROGRESS'),(3,'APPROVED')) AS fixtures(n,s);
        INSERT INTO "Reference" SELECT n,id,kind,'{"preserved":true}'::jsonb
          FROM "Sign" CROSS JOIN (VALUES (1,'placement'),(2,'document'),(3,'photo'),(4,'comment')) AS kinds(n,kind)
          WHERE code='SG.1';`);
      const signs = run(
        `SELECT (to_jsonb(s)-'status')::text FROM "Sign" s ORDER BY id;`,
      );
      const references = run(
        `SELECT row_to_json(r)::text FROM "Reference" r ORDER BY id;`,
      );
      run(migration);
      expect(run(`SELECT to_jsonb(s)::text FROM "Sign" s ORDER BY id;`)).toBe(
        signs,
      );
      expect(
        run(`SELECT row_to_json(r)::text FROM "Reference" r ORDER BY id;`),
      ).toBe(references);
      expect(
        run(
          `SELECT count(*) FROM information_schema.columns WHERE table_schema='${schema}' AND table_name='Sign' AND column_name='status';`,
        ).trim(),
      ).toBe('SET\n0');
      expect(
        run(
          `SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='${schema}' AND t.typname='SignStatus';`,
        ).trim(),
      ).toBe('SET\n0');
    } finally {
      run(`DROP SCHEMA IF EXISTS "${schema}" CASCADE;`);
    }
  },
);
