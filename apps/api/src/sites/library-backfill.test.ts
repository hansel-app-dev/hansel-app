/** @spec library-files REQ-010 */
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { expect, it, vi } from 'vitest';
import { backfillLibraryFiles } from './library-backfill.js';
const id = '00000000-0000-4000-8000-000000000001';
it('library-files backfill resumes safely, registers every kind and reports missing/changed objects', async () => {
  const bytes = Buffer.from('%PDF-file'),
    row = {
      id,
      tenantId: id,
      siteId: id,
      signId: id,
      filename: 'file.pdf',
      mediaType: 'application/pdf',
      byteSize: bytes.length,
      checksumSha256: createHash('sha256').update(bytes).digest('base64'),
      uploadedById: id,
      verifiedObjectKey: 'plans/file',
      createdAt: new Date(),
    };
  const model = () => ({
    findMany: vi
      .fn()
      .mockResolvedValueOnce([
        row,
        { ...row, id: 'missing', verifiedObjectKey: null },
        { ...row, id: 'bad-size', byteSize: 1 },
        { ...row, id: 'bad-hash', checksumSha256: 'bad' },
        { ...row, id: 'invalid', mediaType: 'image/png' },
        { ...row, id: 'changed' },
      ])
      .mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(row),
    update: vi.fn(),
  });
  const db = {
    allocationPlanUpload: model(),
    signDocument: model(),
    signPhoto: model(),
    libraryFile: { upsert: vi.fn().mockResolvedValue({ id }) },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
    fn(db),
  );
  for (const m of [db.allocationPlanUpload, db.signDocument, db.signPhoto])
    m.findFirst.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === 'changed' ? null : row),
    );
  const objects = {
    read: vi.fn((key: string) => {
      if (key.includes('missing')) return Promise.reject(new Error('missing'));
      return Promise.resolve(bytes);
    }),
    inspect: vi.fn(),
    signPut: vi.fn(),
    promote: vi.fn(),
    remove: vi.fn(),
  };
  const report = vi.fn().mockResolvedValue(undefined);
  await backfillLibraryFiles(db as unknown as PrismaClient, objects, report);
  expect(db.libraryFile.upsert).toHaveBeenCalledTimes(3);
  expect(
    report.mock.calls.filter(
      ([event]) => (event as { status: string }).status === 'changed',
    ),
  ).toHaveLength(3);
  expect(
    report.mock.calls.filter(
      ([event]) => (event as { status: string }).status === 'missing',
    ),
  ).toHaveLength(12);
  for (const m of [db.allocationPlanUpload, db.signDocument, db.signPhoto])
    expect(m.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: { id: 'changed' }, skip: 1 }),
    );
  await backfillLibraryFiles(db as unknown as PrismaClient, objects, report);
  expect(db.libraryFile.upsert).toHaveBeenCalledTimes(3);
  db.allocationPlanUpload.findMany.mockResolvedValueOnce([
    Object.fromEntries(
      Object.entries({ ...row, id: 'unverified' }).filter(
        ([key]) => key !== 'verifiedObjectKey',
      ),
    ),
  ]);
  await backfillLibraryFiles(db as unknown as PrismaClient, objects, report);
});
