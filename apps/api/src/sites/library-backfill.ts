/** @spec library-files REQ-010 */
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import {
  registerLibraryFile,
  type LibraryRegistration,
} from './library-files.js';
import {
  validSignature,
  type AllocationPlanObjectStore,
} from './allocation-plans.js';
export async function backfillLibraryFiles(
  db: PrismaClient,
  objects: AllocationPlanObjectStore,
  report: (event: {
    kind: string;
    id: string;
    status: 'registered' | 'missing' | 'changed';
  }) => Promise<void>,
) {
  for (const kind of ['plan', 'document', 'photo'] as const) {
    let cursor: string | undefined;
    for (;;) {
      const page = {
        take: 100,
        orderBy: { id: 'asc' as const },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      };
      const rows =
        kind === 'plan'
          ? await db.allocationPlanUpload.findMany({
              ...page,
              where: {
                status: 'COMPLETED',
                OR: [
                  { groupedPlanId: { not: null } },
                  { allocationPlanId: { not: null } },
                ],
                libraryFileId: null,
              },
            })
          : kind === 'document'
            ? await db.signDocument.findMany({
                ...page,
                where: { completed: true, libraryFileId: null },
              })
            : await db.signPhoto.findMany({
                ...page,
                where: { completed: true, libraryFileId: null },
              });
      if (!rows.length) break;
      for (const row of rows) {
        const originalKey =
          kind === 'plan'
            ? 'verifiedObjectKey' in row
              ? row.verifiedObjectKey
              : null
            : `sign-${kind === 'photo' ? 'photos' : 'documents'}/${row.id}`;
        if (!originalKey) {
          await report({ kind, id: row.id, status: 'missing' });
          continue;
        }
        const thumbnailKey =
          kind === 'photo' ? `sign-photos/${row.id}/thumbnail.png` : null;
        try {
          const value = await objects.read(originalKey);
          if (
            value.length !== row.byteSize ||
            createHash('sha256').update(value).digest('base64') !==
              row.checksumSha256 ||
            !validSignature(row.mediaType, value)
          )
            throw new Error('invalid_object');
          if (thumbnailKey) await objects.read(thumbnailKey);
        } catch {
          await report({ kind, id: row.id, status: 'missing' });
          continue;
        }
        const result = await db.$transaction(async (tx) => {
          if (kind === 'plan')
            await tx.$queryRaw`SELECT id FROM "AllocationPlanUpload" WHERE id = ${row.id}::uuid FOR UPDATE`;
          else if ('signId' in row)
            await tx.$queryRaw`SELECT id FROM "Sign" WHERE id = ${row.signId}::uuid FOR UPDATE`;
          const current =
            kind === 'plan'
              ? await tx.allocationPlanUpload.findFirst({
                  where: { id: row.id, status: 'COMPLETED' },
                })
              : kind === 'document'
                ? await tx.signDocument.findFirst({
                    where: { id: row.id, completed: true },
                  })
                : await tx.signPhoto.findFirst({
                    where: { id: row.id, completed: true },
                  });
          if (!current) return false;
          const input: LibraryRegistration = {
            tenantId: row.tenantId,
            sourceSiteId: row.siteId,
            sourceKind: kind,
            sourceId: row.id,
            filename: row.filename,
            mediaType: row.mediaType,
            byteSize: row.byteSize,
            checksumSha256: row.checksumSha256,
            uploadedById: row.uploadedById,
            originalKey,
            thumbnailKey,
            createdAt: row.createdAt,
          };
          const asset = await registerLibraryFile(tx, input);
          if (kind === 'plan')
            await tx.allocationPlanUpload.update({
              where: { id: row.id },
              data: { libraryFileId: asset.id },
            });
          else if (kind === 'document')
            await tx.signDocument.update({
              where: { id: row.id },
              data: { libraryFileId: asset.id },
            });
          else
            await tx.signPhoto.update({
              where: { id: row.id },
              data: { libraryFileId: asset.id },
            });
          return true;
        });
        await report({
          kind,
          id: row.id,
          status: result ? 'registered' : 'changed',
        });
      }
      // The page is nonempty and contains database rows.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      cursor = rows[rows.length - 1]!.id;
    }
  }
}
