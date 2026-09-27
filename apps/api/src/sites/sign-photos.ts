import type { LibraryRegistrationHook } from './library-files.js';
import { nextPageCursor } from './pagination.js';
/** @spec sign-photos REQ-004..008 */
import { createSignPhotoThumbnail } from './sign-photo-image.js';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  signPhotoSchema,
  signPhotoUploadSchema,
  type SignPhotoUpload,
} from '@hansel/contracts';
import {
  validSignature,
  type AllocationPlanObjectStore,
} from './allocation-plans.js';
import type { ApplicationPrincipal } from './sites.js';
import { hasOrganizationCapability } from './permissions.js';
import {
  SignageConflictError,
  SignageForbiddenError,
  SignageNotFoundError,
} from './signage-schedule.js';

export class SignPhotoRejectedError extends Error {}
const keys = (id: string) => ({
  temporary: `quarantine/sign-photos/${id}`,
  final: `sign-photos/${id}`,
  thumbnail: `sign-photos/${id}/thumbnail.png`,
});
const dto = (row: {
  id: string;
  filename: string;
  mediaType: string;
  byteSize: number;
  createdAt: Date;
}) =>
  signPhotoSchema.parse({
    id: row.id,
    filename: row.filename,
    mediaType: row.mediaType,
    byteSize: row.byteSize,
    createdAt: row.createdAt.toISOString(),
  });

export function createSignPhotosFeature(
  db: PrismaClient,
  objects: AllocationPlanObjectStore & {
    write: (key: string, bytes: Uint8Array) => Promise<void>;
  },
  library?: LibraryRegistrationHook,
) {
  async function authorize(
    p: ApplicationPrincipal,
    siteId: string,
    signId: string,
    mutation = false,
    client: Prisma.TransactionClient = db,
  ) {
    if (mutation && !hasOrganizationCapability(p.roleId, 'MANAGE_SIGNS'))
      throw new SignageForbiddenError();
    const count = await client.sign.count({
      where: {
        id: signId,
        tenantId: p.tenantId,
        siteId,
        site:
          p.roleId === 'owner'
            ? {}
            : {
                OR: [
                  { accessScope: 'ORGANIZATION' },
                  { createdByMembershipId: p.membershipId },
                  { grants: { some: { membershipId: p.membershipId } } },
                ],
              },
      },
    });
    if (!count) throw new SignageNotFoundError();
  }
  async function find(
    p: ApplicationPrincipal,
    siteId: string,
    signId: string,
    id: string,
  ) {
    const row = await db.signPhoto.findFirst({
      where: { id, tenantId: p.tenantId, siteId, signId },
    });
    if (!row) throw new SignageNotFoundError();
    return row;
  }
  return {
    async list(
      p: ApplicationPrincipal,
      siteId: string,
      signId: string,
      cursor?: string,
    ) {
      await authorize(p, siteId, signId);
      const rows = await db.signPhoto.findMany({
        where: {
          tenantId: p.tenantId,
          siteId,
          signId,
          completed: true,
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: 'asc' },
        take: 51,
      });
      return {
        photos: rows.slice(0, 50).map(dto),
        nextCursor: nextPageCursor(rows),
      };
    },
    async initiate(
      p: ApplicationPrincipal,
      siteId: string,
      signId: string,
      raw: SignPhotoUpload,
    ) {
      await authorize(p, siteId, signId, true);
      const { idempotencyKey, ...input } = signPhotoUploadSchema.parse(raw);
      const digest = createHash('sha256')
        .update(JSON.stringify([siteId, signId, p.userId, input]))
        .digest('hex');
      const unique = {
        tenantId_requestKey: {
          tenantId: p.tenantId,
          requestKey: idempotencyKey,
        },
      };
      let row = await db.signPhoto.findUnique({ where: unique });
      if (!row) {
        try {
          row = await db.$transaction(async (tx) => {
            const id = randomUUID();
            const expiresAt = new Date(Date.now() + 15 * 60_000);
            const created = await tx.signPhoto.create({
              data: {
                id,
                tenantId: p.tenantId,
                siteId,
                signId,
                uploadedById: p.userId,
                requestKey: idempotencyKey,
                digest,
                ...input,
                expiresAt,
              },
            });
            await tx.signPhotoObject.create({
              data: { photoId: id, expiresAt },
            });
            return created;
          });
        } catch (error) {
          if (
            !(error instanceof Prisma.PrismaClientKnownRequestError) ||
            error.code !== 'P2002'
          )
            throw error;
          row = await db.signPhoto.findUnique({ where: unique });
        }
      }
      if (row?.digest !== digest) throw new SignageConflictError();
      if (row.completed) return { id: row.id, completed: true };
      if (row.expiresAt.getTime() <= Date.now())
        throw new SignPhotoRejectedError();
      return {
        id: row.id,
        completed: false,
        uploadUrl: await objects.signPut({
          objectKey: keys(row.id).temporary,
          mediaType: row.mediaType,
          byteSize: row.byteSize,
          checksumSha256: row.checksumSha256,
          expiresInSeconds: Math.max(
            1,
            Math.floor((row.expiresAt.getTime() - Date.now()) / 1000),
          ),
        }),
        headers: {
          'content-type': row.mediaType,
          'x-amz-checksum-sha256': row.checksumSha256,
        },
      };
    },
    async complete(
      p: ApplicationPrincipal,
      siteId: string,
      signId: string,
      id: string,
    ) {
      await authorize(p, siteId, signId, true);
      const row = await find(p, siteId, signId, id);
      if (row.completed) return dto(row);
      if (row.expiresAt.getTime() <= Date.now())
        throw new SignPhotoRejectedError();
      const object = keys(id);
      const bytes = await objects.read(object.temporary);
      if (
        bytes.length !== row.byteSize ||
        !validSignature(row.mediaType, bytes) ||
        createHash('sha256').update(bytes).digest('base64') !==
          row.checksumSha256
      )
        throw new SignPhotoRejectedError();
      let thumbnail: Uint8Array;
      try {
        thumbnail = await createSignPhotoThumbnail(bytes, row.mediaType);
      } catch {
        throw new SignPhotoRejectedError();
      }
      await objects.write(object.thumbnail, thumbnail);
      // Freeze the verified object before making it visible; retries use the same checksum-bound source.
      await objects.promote(object.temporary, object.final);
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Sign" WHERE "id" = ${signId}::uuid FOR UPDATE`;
        await authorize(p, siteId, signId, true, tx);
        const result = await tx.signPhoto.updateMany({
          where: {
            id,
            tenantId: p.tenantId,
            siteId,
            signId,
            expiresAt: { gt: new Date() },
          },
          data: { completed: true },
        });
        if (!result.count) throw new SignPhotoRejectedError();
        if (library) {
          const asset = await library(tx, {
            tenantId: p.tenantId,
            sourceSiteId: siteId,
            sourceKind: 'photo',
            sourceId: id,
            filename: row.filename,
            mediaType: row.mediaType,
            byteSize: row.byteSize,
            checksumSha256: row.checksumSha256,
            uploadedById: row.uploadedById,
            originalKey: object.final,
            createdAt: new Date(),
            thumbnailKey: object.thumbnail,
          });
          await tx.signPhoto.update({
            where: { id },
            data: { libraryFileId: asset.id },
          });
        }
        return dto(row);
      });
    },
    async download(
      p: ApplicationPrincipal,
      siteId: string,
      signId: string,
      id: string,
    ) {
      await authorize(p, siteId, signId);
      const row = await find(p, siteId, signId, id);
      if (!row.completed) throw new SignageNotFoundError();
      const asset = row.libraryFileId
        ? await db.libraryFile.findFirstOrThrow({
            where: { id: row.libraryFileId, tenantId: p.tenantId },
          })
        : null;
      const bytes = await objects.read(
        asset ? asset.originalKey : keys(id).final,
      );
      if (
        bytes.length !== row.byteSize ||
        createHash('sha256').update(bytes).digest('base64') !==
          row.checksumSha256
      )
        throw new SignPhotoRejectedError();
      return { filename: row.filename, mediaType: row.mediaType, bytes };
    },
    async thumbnail(
      p: ApplicationPrincipal,
      siteId: string,
      signId: string,
      id: string,
    ) {
      await authorize(p, siteId, signId);
      const row = await find(p, siteId, signId, id);
      if (!row.completed) throw new SignageNotFoundError();
      const asset = row.libraryFileId
        ? await db.libraryFile.findFirstOrThrow({
            where: { id: row.libraryFileId, tenantId: p.tenantId },
          })
        : null;
      const thumbnailKey = asset ? asset.thumbnailKey : keys(id).thumbnail;
      if (!thumbnailKey) throw new SignageNotFoundError();
      return {
        mediaType: 'image/png',
        bytes: await objects.read(thumbnailKey),
      };
    },
    async remove(
      p: ApplicationPrincipal,
      siteId: string,
      signId: string,
      id: string,
    ) {
      await authorize(p, siteId, signId, true);
      // The durable object ledger survives row deletion. Never delete the parent Sign.
      await db.signPhoto.deleteMany({
        where: { id, tenantId: p.tenantId, siteId, signId },
      });
    },
    async cleanup() {
      // Wait until signed PUTs and in-flight completion have expired before removing objects.
      const rows = await db.signPhotoObject.findMany({
        where: { expiresAt: { lt: new Date(Date.now() - 60_000) } },
        orderBy: { expiresAt: 'asc' },
        take: 100,
      });
      for (const row of rows) {
        const document = await db.signPhoto.findUnique({
          where: { id: row.photoId },
        });
        await objects.remove(keys(row.photoId).temporary);
        if (!document?.completed) {
          const retained =
            library &&
            (await db.libraryFile.count({
              where: { originalKey: keys(row.photoId).final },
            }));
          if (!retained) {
            await objects.remove(keys(row.photoId).final);
            await objects.remove(keys(row.photoId).thumbnail);
          }
          await db.signPhoto.deleteMany({
            where: { id: row.photoId, completed: false },
          });
          await db.signPhotoObject.deleteMany({
            where: { photoId: row.photoId },
          });
        } else {
          // Retain a durable cleanup handle for deletion via either the plan or schedule.
          await db.signPhotoObject.update({
            where: { photoId: row.photoId },
            data: { expiresAt: new Date(Date.now() + 60_000) },
          });
        }
      }
    },
  };
}
