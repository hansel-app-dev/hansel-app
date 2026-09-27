/** @spec library-files REQ-010 */
import { appendFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { createS3AllocationPlanObjectStore } from '../dist/sites/s3-allocation-plan-object-store.js';
import { backfillLibraryFiles } from '../dist/sites/library-backfill.js';
const db = new PrismaClient();
const bucket = process.env.ALLOCATION_PLANS_BUCKET_NAME;
if (!bucket) throw new Error('ALLOCATION_PLANS_BUCKET_NAME is required');
const reportPath =
  process.env.LIBRARY_BACKFILL_REPORT ?? '/tmp/hansel-library-backfill.jsonl';
try {
  await backfillLibraryFiles(
    db,
    createS3AllocationPlanObjectStore({ bucketName: bucket }),
    async (event) => {
      await appendFile(
        reportPath,
        JSON.stringify({ ...event, time: new Date().toISOString() }) + '\n',
        { mode: 0o600 },
      );
    },
  );
} finally {
  await db.$disconnect();
}
