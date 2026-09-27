/** @spec library-files REQ-002,005..008 */
import { expect, it } from 'vitest';
import {
  libraryFilesSchema,
  librarySelectionSchema,
  libraryPlanSchema,
  libraryQuerySchema,
} from './library-files.js';
it('library-files rejects invalid selections and bounds search and pagination', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  expect(
    librarySelectionSchema.safeParse({ idempotencyKey: id, fileIds: [] })
      .success,
  ).toBe(false);
  expect(
    librarySelectionSchema.safeParse({ idempotencyKey: id, fileIds: [id, id] })
      .success,
  ).toBe(false);
  expect(
    librarySelectionSchema.parse({ idempotencyKey: id, fileIds: [id] }).fileIds,
  ).toEqual([id]);
  expect(
    libraryPlanSchema.safeParse({ idempotencyKey: id, fileId: id, name: '' })
      .success,
  ).toBe(false);
  expect(
    libraryPlanSchema.parse({ idempotencyKey: id, fileId: id, name: 'Floor' })
      .name,
  ).toBe('Floor');
  expect(
    libraryPlanSchema.safeParse({
      idempotencyKey: id,
      fileId: id,
      name: 'Floor',
      tenantId: id,
    }).success,
  ).toBe(false);
  expect(
    librarySelectionSchema.safeParse({
      idempotencyKey: id,
      fileIds: [id],
      tenantId: id,
    }).success,
  ).toBe(false);
  expect(libraryQuerySchema.parse({}).q).toBe('');
  expect(libraryQuerySchema.safeParse({ q: 'x'.repeat(201) }).success).toBe(
    false,
  );
  expect(libraryQuerySchema.safeParse({ kind: 'video' }).success).toBe(false);
  expect(
    libraryFilesSchema.safeParse({ files: [], nextCursor: null }).success,
  ).toBe(true);
});
