/** @spec sign-comments REQ-007,008,011,012 */
import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  commentAttachmentUploadSchema,
  commentAttachmentSchema,
  type SignDocumentUpload,
} from '@hansel/contracts';
import {
  validSignature,
  type AllocationPlanObjectStore,
} from './allocation-plans.js';
import { createSignPhotoThumbnail } from './sign-photo-image.js';
import { authorizeComment } from './sign-comment-access.js';
import {
  SignageNotFoundError,
  SignageConflictError,
} from './signage-schedule.js';
import { SignCommentValidationError } from './sign-comments.js';
import type { ApplicationPrincipal } from './sites.js';
const keys = (id: string) => ({
  temporary: `quarantine/sign-comments/${id}`,
  final: `sign-comments/${id}`,
  thumbnail: `sign-comments/${id}/thumbnail.png`,
});
const dto = (row: {
  id: string;
  filename: string;
  mediaType: string;
  byteSize: number;
  createdAt: Date;
}) =>
  commentAttachmentSchema.parse({
    id: row.id,
    filename: row.filename,
    mediaType: row.mediaType,
    byteSize: row.byteSize,
    createdAt: row.createdAt.toISOString(),
  });
export function createSignCommentAttachments(
  db: PrismaClient,
  objects: AllocationPlanObjectStore & {
    write: (key: string, bytes: Uint8Array) => Promise<void>;
  },
) {
  async function find(
    p: ApplicationPrincipal,
    siteId: string,
    signId: string,
    id: string,
    write = false,
  ) {
    await authorizeComment(db, p, siteId, signId);
    const row = await db.signCommentAttachment.findFirst({
      where: { id, tenantId: p.tenantId, siteId, signId },
    });
    if (
      !row ||
      (!row.commentId && row.uploadedById !== p.userId) ||
      (write && (row.uploadedById !== p.userId || row.commentId))
    )
      throw new SignageNotFoundError();
    if (!row.commentId && row.expiresAt <= new Date())
      throw new SignCommentValidationError('attachment_expired');
    return row;
  }
  return {
    async initiate(
      p: ApplicationPrincipal,
      siteId: string,
      signId: string,
      raw: SignDocumentUpload,
    ) {
      await authorizeComment(db, p, siteId, signId);
      const { idempotencyKey, ...input } =
        commentAttachmentUploadSchema.parse(raw);
      const digest = createHash('sha256')
        .update(JSON.stringify([siteId, signId, p.userId, input]))
        .digest('hex');
      const where = {
        tenantId_requestKey: {
          tenantId: p.tenantId,
          requestKey: idempotencyKey,
        },
      };
      let row = await db.signCommentAttachment.findUnique({ where });
      if (!row) {
        try {
          row = await db.$transaction(async (tx) => {
            const id = randomUUID();
            const expiresAt = new Date(Date.now() + 15 * 60_000);
            const result = await tx.signCommentAttachment.create({
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
            await tx.signCommentAttachmentObject.create({
              data: { attachmentId: id, expiresAt },
            });
            return result;
          });
        } catch (error) {
          if (
            !(error instanceof Prisma.PrismaClientKnownRequestError) ||
            error.code !== 'P2002'
          )
            throw error;
          row = await db.signCommentAttachment.findUnique({ where });
        }
      }
      if (row?.digest !== digest) throw new SignageConflictError();
      if (!row.commentId && row.expiresAt <= new Date())
        throw new SignCommentValidationError('attachment_expired');
      if (row.completed) return { id: row.id, completed: true };
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
      const row = await find(p, siteId, signId, id, true);
      if (row.completed) return dto(row);
      const object = keys(id),
        bytes = await objects.read(object.temporary);
      if (
        bytes.length !== row.byteSize ||
        !validSignature(row.mediaType, bytes) ||
        createHash('sha256').update(bytes).digest('base64') !==
          row.checksumSha256
      )
        throw new SignCommentValidationError('invalid_attachment');
      if (row.mediaType !== 'application/pdf') {
        let thumbnail: Uint8Array;
        try {
          thumbnail = await createSignPhotoThumbnail(bytes, row.mediaType);
        } catch {
          throw new SignCommentValidationError('invalid_image');
        }
        await objects.write(object.thumbnail, thumbnail);
      }
      await objects.promote(object.temporary, object.final);
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Sign" WHERE "id" = ${signId}::uuid FOR UPDATE`;
        await authorizeComment(tx, p, siteId, signId);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
        const result = await tx.signCommentAttachment.updateMany({
          where: {
            id,
            commentId: null,
            uploadedById: p.userId,
            expiresAt: { gt: new Date() },
          },
          data: { completed: true, expiresAt },
        });
        if (!result.count)
          throw new SignCommentValidationError('attachment_expired');
        await tx.signCommentAttachmentObject.update({
          where: { attachmentId: id },
          data: { expiresAt },
        });
        return dto(row);
      });
    },
    async download(
      p: ApplicationPrincipal,
      siteId: string,
      signId: string,
      id: string,
    ) {
      const row = await find(p, siteId, signId, id);
      if (!row.completed) throw new SignageNotFoundError();
      const bytes = await objects.read(keys(id).final);
      if (
        bytes.length !== row.byteSize ||
        createHash('sha256').update(bytes).digest('base64') !==
          row.checksumSha256
      )
        throw new SignCommentValidationError('invalid_attachment');
      return { bytes, mediaType: row.mediaType, filename: row.filename };
    },
    async thumbnail(
      p: ApplicationPrincipal,
      siteId: string,
      signId: string,
      id: string,
    ) {
      const row = await find(p, siteId, signId, id);
      if (!row.completed || row.mediaType === 'application/pdf')
        throw new SignageNotFoundError();
      return { bytes: await objects.read(keys(id).thumbnail) };
    },
    async discard(
      p: ApplicationPrincipal,
      siteId: string,
      signId: string,
      id: string,
    ) {
      await authorizeComment(db, p, siteId, signId);
      const row = await db.signCommentAttachment.findFirst({
        where: { id, tenantId: p.tenantId, siteId, signId },
      });
      if (!row) return;
      if (row.commentId || row.uploadedById !== p.userId)
        throw new SignageNotFoundError();
      await db.signCommentAttachment.deleteMany({
        where: { id, commentId: null, uploadedById: p.userId },
      });
    },
    async cleanup() {
      const ledgers = await db.signCommentAttachmentObject.findMany({
        where: { expiresAt: { lt: new Date(Date.now() - 60_000) } },
        orderBy: { expiresAt: 'asc' },
        take: 100,
      });
      for (const ledger of ledgers) {
        // Serialize reclamation with submission. A reclaimed draft cannot be published later.
        const retain = await db.$transaction(async (tx) => {
          const row = await tx.signCommentAttachment.findUnique({
            where: { id: ledger.attachmentId },
          });
          if (row?.commentId) return true;
          if (row && row.expiresAt > new Date()) return true;
          await tx.signCommentAttachment.deleteMany({
            where: {
              id: ledger.attachmentId,
              commentId: null,
              expiresAt: { lt: new Date() },
            },
          });
          const current = await tx.signCommentAttachment.findUnique({
            where: { id: ledger.attachmentId },
          });
          return !!current;
        });
        await objects.remove(keys(ledger.attachmentId).temporary);
        if (retain) {
          await db.signCommentAttachmentObject.updateMany({
            where: { attachmentId: ledger.attachmentId },
            data: { expiresAt: new Date(Date.now() + 60_000) },
          });
          continue;
        }
        await objects.remove(keys(ledger.attachmentId).final);
        await objects.remove(keys(ledger.attachmentId).thumbnail);
        await db.signCommentAttachmentObject.deleteMany({
          where: { attachmentId: ledger.attachmentId },
        });
      }
    },
  };
}
