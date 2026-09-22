/** @spec sign-function-options REQ-004 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { expect, it } from 'vitest';

it.skipIf(process.env.PLAN_SIGNS_INTEGRATION !== 'true')(
  'REQ-004 migrates only Wayfinder, preserves other fields, and is repeatable',
  async () => {
    const db = new PrismaClient();
    const statements = readFileSync(
      new URL(
        '../../prisma/migrations/20260922120000_sign_function_options/migration.sql',
        import.meta.url,
      ),
      'utf8',
    )
      .split(';')
      .filter((statement) => statement.trim());
    try {
      await db.$transaction(async (tx) => {
        // Shadow the real table: exercise migration SQL without changing user data.
        await tx.$executeRawUnsafe(`CREATE TEMP TABLE "Sign" (
          id integer PRIMARY KEY, "function" varchar(32) DEFAULT 'Wayfinder',
          code text NOT NULL, "updatedAt" timestamptz NOT NULL
        ) ON COMMIT DROP`);
        await tx.$executeRawUnsafe(`INSERT INTO pg_temp."Sign" VALUES
          (1, 'Wayfinder', 'SG.001', '2026-09-22T00:00:00Z'),
          (2, 'Identification', 'SG.002', '2026-09-22T00:00:00Z'),
          (3, 'Informational', 'SG.003', '2026-09-22T00:00:00Z'),
          (4, 'Regulatory/Statutory', 'SG.004', '2026-09-22T00:00:00Z'),
          (5, 'Directional', 'SG.005', '2026-09-22T00:00:00Z')`);
        const before = await tx.$queryRaw<
          { id: number; function: string; code: string; updatedAt: Date }[]
        >`SELECT * FROM pg_temp."Sign" ORDER BY id`;
        for (let run = 0; run < 2; run++) {
          for (const sql of statements) await tx.$executeRawUnsafe(sql);
          expect(
            await tx.$queryRaw`SELECT * FROM pg_temp."Sign" ORDER BY id`,
          ).toEqual(
            before.map((row) => ({
              ...row,
              function:
                row.function === 'Wayfinder' ? 'Directional' : row.function,
            })),
          );
        }
        await tx.$executeRaw`INSERT INTO pg_temp."Sign" (id, code, "updatedAt") VALUES (6, 'SG.006', NOW())`;
        expect(
          await tx.$queryRaw`SELECT "function" FROM pg_temp."Sign" WHERE id = 6`,
        ).toEqual([{ function: 'Directional' }]);
      });
    } finally {
      await db.$disconnect();
    }
  },
);
