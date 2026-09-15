/** @spec sign-documents REQ-004..008 */
import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  signDocumentSchema,
  signDocumentUploadSchema,
  type SignDocumentUpload,
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

export class SignDocumentRejectedError extends Error {}
const keys = (id: string) => ({
  temporary: `quarantine/sign-documents/${id}`,
  final: `sign-documents/${id}`,
});
const dto = (row: {
  id: string;
  filename: string;
  mediaType: string;
  byteSize: number;
  createdAt: Date;
}) =>
  signDocumentSchema.parse({
    id: row.id,
    filename: row.filename,
    mediaType: row.mediaType,
    byteSize: row.byteSize,
    createdAt: row.createdAt.toISOString(),
  });

export function createSignDocumentsFeature(
  db: PrismaClient,
  objects: AllocationPlanObjectStore,
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
    const row = await db.signDocument.findFirst({
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
      const rows = await db.signDocument.findMany({
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
        documents: rows.slice(0, 50).map(dto),
        nextCursor: rows.length > 50 ? (rows[49]?.id ?? null) : null,
      };
    },
    async initiate(
      p: ApplicationPrincipal,
      siteId: string,
      signId: string,
      raw: SignDocumentUpload,
    ) {
      await authorize(p, siteId, signId, true);
      const { idempotencyKey, ...input } = signDocumentUploadSchema.parse(raw);
      const digest = createHash('sha256')
        .update(JSON.stringify([siteId, signId, p.userId, input]))
        .digest('hex');
      const unique = {
        tenantId_requestKey: {
          tenantId: p.tenantId,
          requestKey: idempotencyKey,
        },
      };
      let row = await db.signDocument.findUnique({ where: unique });
      if (!row) {
        try {
          row = await db.$transaction(async (tx) => {
            const id = randomUUID();
            const expiresAt = new Date(Date.now() + 15 * 60_000);
            const created = await tx.signDocument.create({
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
            await tx.signDocumentObject.create({
              data: { documentId: id, expiresAt },
            });
            return created;
          });
        } catch (error) {
          if (
            !(error instanceof Prisma.PrismaClientKnownRequestError) ||
            error.code !== 'P2002'
          )
            throw error;
          row = await db.signDocument.findUnique({ where: unique });
        }
      }
      if (row?.digest !== digest) throw new SignageConflictError();
      if (row.completed) return { id: row.id, completed: true };
      if (row.expiresAt.getTime() <= Date.now())
        throw new SignDocumentRejectedError();
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
        throw new SignDocumentRejectedError();
      const object = keys(id);
      const bytes = await objects.read(object.temporary);
      if (
        bytes.length !== row.byteSize ||
        !validSignature(row.mediaType, bytes) ||
        createHash('sha256').update(bytes).digest('base64') !==
          row.checksumSha256
      )
        throw new SignDocumentRejectedError();
      // Freeze the verified object before making it visible; retries use the same checksum-bound source.
      await objects.promote(object.temporary, object.final);
      return db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Sign" WHERE "id" = ${signId}::uuid FOR UPDATE`;
        await authorize(p, siteId, signId, true, tx);
        const result = await tx.signDocument.updateMany({
          where: {
            id,
            tenantId: p.tenantId,
            siteId,
            signId,
            expiresAt: { gt: new Date() },
          },
          data: { completed: true },
        });
        if (!result.count) throw new SignDocumentRejectedError();
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
      const bytes = await objects.read(keys(id).final);
      if (
        bytes.length !== row.byteSize ||
        createHash('sha256').update(bytes).digest('base64') !==
          row.checksumSha256
      )
        throw new SignDocumentRejectedError();
      return { filename: row.filename, mediaType: row.mediaType, bytes };
    },
    async cleanup() {
      // Wait until signed PUTs and in-flight completion have expired before removing objects.
      const rows = await db.signDocumentObject.findMany({
        where: { expiresAt: { lt: new Date(Date.now() - 60_000) } },
        orderBy: { expiresAt: 'asc' },
        take: 100,
      });
      for (const row of rows) {
        const document = await db.signDocument.findUnique({
          where: { id: row.documentId },
        });
        await objects.remove(keys(row.documentId).temporary);
        if (!document?.completed) {
          await objects.remove(keys(row.documentId).final);
          await db.signDocument.deleteMany({
            where: { id: row.documentId, completed: false },
          });
          await db.signDocumentObject.deleteMany({
            where: { documentId: row.documentId },
          });
        } else {
          // Retain a durable cleanup handle for deletion via either the plan or schedule.
          await db.signDocumentObject.update({
            where: { documentId: row.documentId },
            data: { expiresAt: new Date(Date.now() + 60_000) },
          });
        }
      }
    },
  };
}
