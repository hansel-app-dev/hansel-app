/** @spec library-files REQ-001..012 */
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  libraryFileSchema,
  libraryQuerySchema,
  librarySelectionSchema,
  libraryPlanSchema,
  allocationPlanSchema,
  signDocumentSchema,
  signPhotoSchema,
  type LibraryQuery,
  type LibrarySelection,
  type LibraryPlan,
} from '@hansel/contracts';
import { nextPageCursor } from './pagination.js';
import { accessWhere, toPlan } from './prisma-allocation-plan-store.js';
import { hasOrganizationCapability } from './permissions.js';
import {
  SignageConflictError,
  SignageForbiddenError,
  SignageNotFoundError,
} from './signage-schedule.js';
import {
  validSignature,
  type AllocationPlanObjectStore,
} from './allocation-plans.js';
import { createSignPhotoThumbnail } from './sign-photo-image.js';
import type { ApplicationPrincipal } from './sites.js';
type DB = Prisma.TransactionClient;
export type LibraryRegistration = Omit<
  Prisma.LibraryFileUncheckedCreateInput,
  'id' | 'planFiles' | 'documents' | 'photos'
>;
export async function registerLibraryFile(tx: DB, input: LibraryRegistration) {
  return tx.libraryFile.upsert({
    where: {
      tenantId_sourceKind_sourceId: {
        tenantId: input.tenantId,
        sourceKind: input.sourceKind,
        sourceId: input.sourceId,
      },
    },
    create: input,
    update: {},
  });
}
export type LibraryRegistrationHook = (
  tx: DB,
  input: LibraryRegistration,
) => Promise<{ id: string }>;
const include = {
  sourceSite: true,
  uploadedBy: { include: { personalProfile: true } },
} as const;
type Row = Prisma.LibraryFileGetPayload<{ include: typeof include }>;
const dto = (row: Row) =>
  libraryFileSchema.parse({
    id: row.id,
    filename: row.filename,
    mediaType: row.mediaType,
    byteSize: row.byteSize,
    createdAt: row.createdAt.toISOString(),
    uploadedBy: row.uploadedBy.personalProfile
      ? `${row.uploadedBy.personalProfile.firstName} ${row.uploadedBy.personalProfile.lastName}`
      : row.uploadedBy.email.split('@')[0],
    sourceSite: { id: row.sourceSite.id, name: row.sourceSite.name },
    hasThumbnail: row.thumbnailKey !== null,
  });
export function createLibraryFilesFeature(
  db: PrismaClient,
  objects: AllocationPlanObjectStore & {
    write: (key: string, bytes: Uint8Array) => Promise<void>;
  },
  activityEnabled = false,
) {
  async function member(p: ApplicationPrincipal, tx: DB = db) {
    const current = await tx.membership.findFirst({
      where: { id: p.membershipId, tenantId: p.tenantId, userId: p.userId },
    });
    if (!current) throw new SignageForbiddenError();
    return { ...p, roleId: current.roleId };
  }
  async function eligible(p: ApplicationPrincipal, id: string, tx: DB = db) {
    const current = await member(p, tx);
    const row = await tx.libraryFile.findFirst({
      where: { id, tenantId: p.tenantId, sourceSite: accessWhere(current) },
      include,
    });
    if (!row) throw new SignageNotFoundError();
    return row;
  }
  async function bytes(row: Row) {
    const value = await objects.read(row.originalKey);
    if (
      value.length !== row.byteSize ||
      createHash('sha256').update(value).digest('base64') !==
        row.checksumSha256 ||
      !validSignature(row.mediaType, value)
    )
      throw new SignageNotFoundError();
    return value;
  }
  async function target(
    p: ApplicationPrincipal,
    siteId: string,
    signId: string | null,
    tx: DB,
  ) {
    await tx.$queryRaw`SELECT id FROM "Membership" WHERE id = ${p.membershipId}::uuid FOR UPDATE`;
    const current = await member(p, tx);
    if (
      signId === null
        ? !['owner', 'administrator', 'admin'].includes(current.roleId)
        : !hasOrganizationCapability(current.roleId, 'MANAGE_SIGNS')
    )
      throw new SignageForbiddenError();
    if (
      !(await tx.site.count({ where: { id: siteId, ...accessWhere(current) } }))
    )
      throw new SignageNotFoundError();
    if (signId !== null) {
      await tx.$queryRaw`SELECT id FROM "Sign" WHERE id = ${signId}::uuid FOR UPDATE`;
      if (
        !(await tx.sign.count({
          where: { id: signId, siteId, tenantId: p.tenantId },
        }))
      )
        throw new SignageNotFoundError();
    }
  }
  async function request(
    p: ApplicationPrincipal,
    siteId: string,
    signId: string | null,
    key: string,
    input: unknown,
    sourceIds: string[],
    work: (tx: DB) => Promise<Prisma.InputJsonValue>,
  ) {
    const digest = createHash('sha256')
      .update(JSON.stringify([siteId, signId, p.userId, input]))
      .digest('hex');
    return db.$transaction(
      async (tx) => {
        await target(p, siteId, signId, tx);
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${p.tenantId + key},0))::text`;
        const prior = await tx.libraryRequest.findUnique({
          where: {
            tenantId_requestKey: { tenantId: p.tenantId, requestKey: key },
          },
        });
        if (prior) {
          if (prior.digest !== digest) throw new SignageConflictError();
          for (const id of sourceIds) await eligible(p, id, tx);
          return prior.result;
        }
        const result = await work(tx);
        await tx.libraryRequest.create({
          data: { tenantId: p.tenantId, requestKey: key, digest, result },
        });
        return result;
      },
      { timeout: 30_000 },
    );
  }
  return {
    async list(p: ApplicationPrincipal, raw: LibraryQuery) {
      const query = libraryQuerySchema.parse(raw),
        current = await member(p);
      const cursor = query.cursor
        ? await eligible(current, query.cursor)
        : null;
      const rows = await db.libraryFile.findMany({
        where: {
          tenantId: p.tenantId,
          sourceSite: accessWhere(current),
          filename: { contains: query.q, mode: 'insensitive' },
          ...(query.kind === 'all'
            ? {}
            : {
                mediaType:
                  query.kind === 'pdf'
                    ? 'application/pdf'
                    : { in: ['image/png', 'image/jpeg'] },
              }),
          ...(cursor
            ? {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { gt: cursor.id } },
                ],
              }
            : {}),
        },
        include,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 51,
      });
      return {
        files: rows.slice(0, 50).map(dto),
        nextCursor: nextPageCursor(rows),
      };
    },
    async download(p: ApplicationPrincipal, id: string) {
      const row = await eligible(p, id);
      return {
        filename: row.filename,
        mediaType: row.mediaType,
        bytes: await bytes(row),
      };
    },
    async thumbnail(p: ApplicationPrincipal, id: string) {
      const row = await eligible(p, id);
      if (!row.thumbnailKey) throw new SignageNotFoundError();
      return {
        mediaType: 'image/png',
        bytes: await objects.read(row.thumbnailKey),
      };
    },
    async link(
      p: ApplicationPrincipal,
      siteId: string,
      signId: string,
      kind: 'documents' | 'photos',
      raw: LibrarySelection,
    ) {
      const input = librarySelectionSchema.parse(raw);
      // Decode outside the transaction; recheck authorization and immutable identity inside it.
      await db.$transaction((tx) => target(p, siteId, signId, tx));
      for (const id of input.fileIds) {
        const row = await eligible(p, id);
        if (kind === 'photos' && !row.mediaType.startsWith('image/'))
          throw new SignageConflictError();
        if (kind === 'photos' && !row.thumbnailKey) {
          const key = `library/${row.id}/thumbnail.png`;
          await objects.write(
            key,
            await createSignPhotoThumbnail(await bytes(row), row.mediaType),
          );
          await db.libraryFile.updateMany({
            where: { id: row.id, tenantId: p.tenantId, thumbnailKey: null },
            data: { thumbnailKey: key },
          });
        }
      }
      const result = await request(
        p,
        siteId,
        signId,
        input.idempotencyKey,
        [kind, input.fileIds],
        input.fileIds,
        async (tx) => {
          const items = [];
          for (const id of [...input.fileIds].sort()) {
            const row = await eligible(p, id, tx);
            if (kind === 'photos' && !row.mediaType.startsWith('image/'))
              throw new SignageConflictError();
            const data = {
              tenantId: p.tenantId,
              siteId,
              signId,
              libraryFileId: id,
              uploadedById: p.userId,
              requestKey: randomUUID(),
              digest: id,
              filename: row.filename,
              mediaType: row.mediaType,
              byteSize: row.byteSize,
              checksumSha256: row.checksumSha256,
              completed: true,
              expiresAt: new Date(),
              createdAt: new Date(),
            };
            const where = {
              signId_libraryFileId: { signId, libraryFileId: id },
            };
            const attachment =
              kind === 'documents'
                ? await tx.signDocument.upsert({
                    where,
                    create: data,
                    update: {},
                  })
                : await tx.signPhoto.upsert({
                    where,
                    create: data,
                    update: {},
                  });
            items.push({
              id: attachment.id,
              filename: attachment.filename,
              mediaType: attachment.mediaType,
              byteSize: attachment.byteSize,
              createdAt: attachment.createdAt.toISOString(),
            });
          }
          return { items };
        },
      );
      const schema =
        kind === 'documents' ? signDocumentSchema : signPhotoSchema;
      return {
        items: schema.array().parse((result as { items: unknown }).items),
      };
    },
    async createPlan(
      p: ApplicationPrincipal,
      siteId: string,
      raw: LibraryPlan,
    ) {
      const input = libraryPlanSchema.parse(raw);
      await eligible(p, input.fileId);
      const result = await request(
        p,
        siteId,
        null,
        input.idempotencyKey,
        ['plan', input.fileId, input.name],
        [input.fileId],
        async (tx) => {
          const row = await eligible(p, input.fileId, tx);
          const plan = await tx.allocationPlan.create({
            data: {
              tenantId: p.tenantId,
              siteId,
              uploadedById: p.userId,
              name: input.name,
            },
          });
          const batch = await tx.allocationPlanUploadBatch.create({
            data: {
              tenantId: p.tenantId,
              siteId,
              keyDigest: randomUUID(),
              requestDigest: input.fileId,
              grouped: true,
            },
          });
          const fileId = randomUUID();
          await tx.allocationPlanUpload.create({
            data: {
              id: fileId,
              tenantId: p.tenantId,
              siteId,
              batchId: batch.id,
              uploadedById: p.userId,
              groupedPlanId: plan.id,
              libraryFileId: row.id,
              position: 0,
              objectKey: `library-links/${fileId}`,
              verifiedObjectKey: row.originalKey,
              verifiedAt: new Date(),
              status: 'COMPLETED',
              expiresAt: new Date(),
              filename: row.filename,
              mediaType: row.mediaType,
              byteSize: row.byteSize,
              checksumSha256: row.checksumSha256,
            },
          });
          if (activityEnabled)
            await tx.activity.create({
              data: {
                tenantId: p.tenantId,
                siteId,
                actorMembershipId: p.membershipId,
                kind: 'ALLOCATION_PLAN_ADDED',
                subjectId: plan.id,
                subjectLabel: input.name,
              },
            });
          const persisted = await tx.allocationPlan.findFirst({
            where: { id: plan.id, tenantId: p.tenantId, siteId },
            include: {
              files: { orderBy: { position: 'asc' } },
              uploadedBy: { include: { personalProfile: true } },
            },
          });
          if (!persisted) throw new SignageNotFoundError();
          return { plan: allocationPlanSchema.parse(toPlan(persisted)) };
        },
      );
      return {
        plan: allocationPlanSchema.parse((result as { plan: unknown }).plan),
      };
    },
  };
}
