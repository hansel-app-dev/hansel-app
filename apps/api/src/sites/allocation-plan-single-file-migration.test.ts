/** @spec allocation-plan-single-file REQ-006..REQ-008
 * Local PostgreSQL integration check: isolated schema, no application rows changed.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';

it.skipIf(process.env.ALLOCATION_MIGRATION_INTEGRATION !== 'true')(
  'splits files transactionally, cascades placements, preserves identities and rejects ambiguous legacy placements',
  () => {
    const migration = readFileSync(
      new URL(
        '../../prisma/migrations/20260923000000_allocation_plan_single_file/migration.sql',
        import.meta.url,
      ),
      'utf8',
    );
    const schema = `allocation_test_${randomUUID().replaceAll('-', '')}`;
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
          input: `SET search_path TO "${schema}", public;\n${sql}`,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: new URL('../../../../', import.meta.url),
        },
      );
    const id = (n: number) =>
      `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    try {
      run(`CREATE SCHEMA "${schema}";
        CREATE TABLE "AllocationPlan" (LIKE public."AllocationPlan" INCLUDING ALL);
        CREATE TABLE "AllocationPlanUpload" (LIKE public."AllocationPlanUpload" INCLUDING ALL);
        ALTER TABLE "AllocationPlanUpload" DROP CONSTRAINT IF EXISTS "AllocationPlanUpload_single_file_position_check";
        CREATE TABLE "SignPlacement" (LIKE public."SignPlacement" INCLUDING ALL);
        ALTER TABLE "SignPlacement" ADD FOREIGN KEY ("fileId", "tenantId", "siteId", "planId") REFERENCES "AllocationPlanUpload" (id, "tenantId", "siteId", "groupedPlanId") ON UPDATE CASCADE;
        INSERT INTO "AllocationPlan" (id,"tenantId","siteId","uploadedById",name,"updatedAt") VALUES ('${id(1)}','${id(10)}','${id(20)}','${id(30)}','Building',now()), ('${id(2)}','${id(10)}','${id(20)}','${id(30)}','Single',now());
      `);
      for (const [n, plan, position] of [
        [101, 1, 0],
        [102, 1, 1],
        [103, 1, 2],
        [104, 2, 0],
      ] as const) {
        run(`INSERT INTO "AllocationPlanUpload" (id,"batchId","tenantId","siteId","uploadedById","groupedPlanId",position,"objectKey",filename,"mediaType","byteSize","checksumSha256",status,"expiresAt","updatedAt","verifiedObjectKey","verifiedAt") VALUES ('${id(n)}','${id(40)}','${id(10)}','${id(20)}','${id(30)}','${id(plan)}',${String(position)},'quarantine/${String(n)}','${String(n)}.pdf','application/pdf',12,'${'A'.repeat(43)}=','COMPLETED',now(),now(),'plans/${String(n)}',now());
        INSERT INTO "SignPlacement" ("signId","tenantId","siteId","planId","fileId",x,y) VALUES ('${id(n + 100)}','${id(10)}','${id(20)}','${id(plan)}','${id(n)}',0.25,0.75);`);
      }
      run(
        `INSERT INTO "SignPlacement" ("signId","tenantId","siteId","planId",x,y) VALUES ('${id(999)}','${id(10)}','${id(20)}','${id(1)}',0.1,0.2);`,
      );
      expect(() => run(migration)).toThrow();
      expect(run('SELECT count(*) FROM "AllocationPlan";')).toContain('2');
      run(`DELETE FROM "SignPlacement" WHERE "signId"='${id(999)}';`);
      const filesBefore = run(
        `SELECT (to_jsonb(u)-'groupedPlanId'-'position'-'allocationPlanId')::text FROM "AllocationPlanUpload" u ORDER BY id;`,
      );
      const signsBefore = run(
        `SELECT (to_jsonb(s)-'planId')::text FROM "SignPlacement" s ORDER BY "signId";`,
      );
      run(migration);
      const plansAfter = run(
        `SELECT row_to_json(p)::text FROM "AllocationPlan" p ORDER BY id;`,
      );
      run(migration);
      expect(
        run(`SELECT row_to_json(p)::text FROM "AllocationPlan" p ORDER BY id;`),
      ).toBe(plansAfter);
      expect(
        run(
          `SELECT (to_jsonb(u)-'groupedPlanId'-'position'-'allocationPlanId')::text FROM "AllocationPlanUpload" u ORDER BY id;`,
        ),
      ).toBe(filesBefore);
      expect(
        run(
          `SELECT (to_jsonb(s)-'planId')::text FROM "SignPlacement" s ORDER BY "signId";`,
        ),
      ).toBe(signsBefore);
      expect(run(`SELECT count(*) FROM "AllocationPlan";`)).toContain('4');
      expect(run(`SELECT name FROM "AllocationPlan" ORDER BY name;`)).toContain(
        'Building — 102.pdf',
      );
      expect(
        run(
          `SELECT count(*) FROM "SignPlacement" s JOIN "AllocationPlanUpload" u ON u.id=s."fileId" AND u."groupedPlanId"=s."planId" WHERE s.x=0.25 AND s.y=0.75;`,
        ),
      ).toContain('4');
      expect(run(`SELECT count(*) FROM "AllocationPlanFileSplit";`)).toContain(
        '3',
      );
      expect(
        run(`SELECT name FROM "AllocationPlan" WHERE id='${id(1)}';`),
      ).toContain('Building');
      expect(() =>
        run(
          `UPDATE "AllocationPlanUpload" SET "groupedPlanId"='${id(1)}' WHERE id='${id(102)}';`,
        ),
      ).toThrow();
      expect(() =>
        run(
          `UPDATE "AllocationPlanUpload" SET position=1 WHERE id='${id(102)}';`,
        ),
      ).toThrow();
    } finally {
      run(`DROP SCHEMA IF EXISTS "${schema}" CASCADE;`);
    }
  },
  30_000,
);
