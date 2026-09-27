import type { LibraryRegistrationHook } from './library-files.js';
/** @spec site-allocation-plans-add REQ-001, REQ-006..REQ-018, REQ-022 */
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { AllocationPlan } from '@hansel/contracts';
import type { ApplicationPrincipal } from './sites.js';
import type {
  AllocationPlanStore,
  PendingAllocationPlanUpload,
} from './allocation-plans.js';

export function accessWhere(
  principal: ApplicationPrincipal,
): Prisma.SiteWhereInput {
  return {
    tenantId: principal.tenantId,
    ...(principal.roleId === 'owner'
      ? {}
      : {
          OR: [
            { accessScope: 'ORGANIZATION' },
            { createdByMembershipId: principal.membershipId },
            { grants: { some: { membershipId: principal.membershipId } } },
          ],
        }),
  };
}

const uploadInclude = {
  allocationPlan: {
    include: {
      files: { orderBy: { position: 'asc' } },
      uploadedBy: { include: { personalProfile: true } },
    },
  },
  batch: true,
} satisfies Prisma.AllocationPlanUploadInclude;

function uploaderName(user: {
  email: string;
  personalProfile: { firstName: string; lastName: string } | null;
}): string {
  return user.personalProfile
    ? `${user.personalProfile.firstName} ${user.personalProfile.lastName}`
    : user.email.slice(0, user.email.indexOf('@'));
}

export function toPlan(record: {
  id: string;
  name?: string;
  filename: string | null;
  mediaType: string | null;
  byteSize: number | null;
  files?: {
    id: string;
    filename: string;
    mediaType: string;
    byteSize: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
  uploadedBy: {
    email: string;
    personalProfile: { firstName: string; lastName: string } | null;
  };
}): AllocationPlan {
  return {
    id: record.id,
    ...(record.name ? { name: record.name } : {}),
    ...(record.filename && record.mediaType && record.byteSize
      ? {
          filename: record.filename,
          mediaType: record.mediaType as NonNullable<
            AllocationPlan['mediaType']
          >,
          byteSize: record.byteSize,
        }
      : {}),
    ...(record.files?.length
      ? {
          files: record.files.map((file) => ({
            id: file.id,
            filename: file.filename,
            mediaType: file.mediaType as NonNullable<
              AllocationPlan['mediaType']
            >,
            byteSize: file.byteSize,
          })),
        }
      : {}),
    createdAt: record.createdAt.toISOString(),
    modifiedAt: record.updatedAt.toISOString(),
    uploadedBy: uploaderName(record.uploadedBy),
  };
}

function toUpload(
  record: Prisma.AllocationPlanUploadGetPayload<{
    include: typeof uploadInclude;
  }>,
): PendingAllocationPlanUpload {
  return {
    id: record.id,
    tenantId: record.tenantId,
    siteId: record.siteId,
    objectKey: record.objectKey,
    filename: record.filename,
    mediaType: record.mediaType as PendingAllocationPlanUpload['mediaType'],
    byteSize: record.byteSize,
    checksumSha256: record.checksumSha256,
    expiresAt: record.expiresAt,
    status: record.status,
    grouped: record.batch.grouped,
    ...(record.allocationPlan ? { plan: toPlan(record.allocationPlan) } : {}),
  };
}

export function createPrismaAllocationPlanStore(
  prisma: PrismaClient,
  activityEnabled = false,
  library?: LibraryRegistrationHook,
): AllocationPlanStore {
  return {
    async canAccess(principal, siteId) {
      return (
        (await prisma.site.count({
          where: { ...accessWhere(principal), id: siteId },
        })) === 1
      );
    },
    async list(principal, siteId) {
      const records = await prisma.allocationPlan.findMany({
        where: { tenantId: principal.tenantId, siteId },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        include: {
          files: { orderBy: { position: 'asc' } },
          uploadedBy: { include: { personalProfile: true } },
        },
      });
      return records.map(toPlan);
    },
    async findContent(principal, siteId, planId, fileId) {
      if (fileId) {
        const file = await prisma.allocationPlanUpload.findFirst({
          where: {
            id: fileId,
            groupedPlanId: planId,
            tenantId: principal.tenantId,
            siteId,
            status: 'COMPLETED',
            groupedPlan: {
              id: planId,
              tenantId: principal.tenantId,
              siteId,
              site: accessWhere(principal),
            },
          },
          select: { verifiedObjectKey: true, mediaType: true },
        });
        return file?.verifiedObjectKey
          ? { objectKey: file.verifiedObjectKey, mediaType: file.mediaType }
          : null;
      }
      const record = await prisma.allocationPlan.findFirst({
        where: {
          id: planId,
          siteId,
          tenantId: principal.tenantId,
          site: accessWhere(principal),
        },
        select: { objectKey: true, mediaType: true },
      });
      return record?.objectKey && record.mediaType
        ? { objectKey: record.objectKey, mediaType: record.mediaType }
        : null;
    },
    async createBatch(input) {
      return prisma.$transaction(async (transaction) => {
        if (input.grouped)
          await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.principal.tenantId + input.keyDigest}, 0))::text`;
        const previous = await transaction.allocationPlanUploadBatch.findUnique(
          {
            where: {
              tenantId_keyDigest: {
                tenantId: input.principal.tenantId,
                keyDigest: input.keyDigest,
              },
            },
            include: {
              uploads: { orderBy: { position: 'asc' }, include: uploadInclude },
            },
          },
        );
        const membership = await transaction.membership.findUnique({
          where: { id: input.principal.membershipId },
          select: { userId: true, tenantId: true, roleId: true },
        });
        if (
          membership?.userId !== input.principal.userId ||
          membership.tenantId !== input.principal.tenantId ||
          !['owner', 'administrator', 'admin'].includes(membership.roleId)
        )
          return { status: 'forbidden' as const };
        const site = await transaction.site.count({
          where: { ...accessWhere(input.principal), id: input.siteId },
        });
        if (site !== 1) return { status: 'forbidden' as const };
        if (previous)
          return previous.requestDigest === input.requestDigest
            ? {
                status: 'replayed' as const,
                uploads: previous.uploads.map(toUpload),
              }
            : { status: 'conflict' as const };
        const batch = await transaction.allocationPlanUploadBatch.create({
          data: {
            id: randomUUID(),
            tenantId: input.principal.tenantId,
            siteId: input.siteId,
            keyDigest: input.keyDigest,
            requestDigest: input.requestDigest,
            grouped: input.grouped ?? false,
          },
        });
        await transaction.allocationPlanUpload.createMany({
          data: input.uploads.map((upload, position) => ({
            ...upload,
            position,
            batchId: batch.id,
            tenantId: input.principal.tenantId,
            siteId: input.siteId,
            uploadedById: input.principal.userId,
            expiresAt: input.expiresAt,
          })),
        });
        const created =
          await transaction.allocationPlanUploadBatch.findUniqueOrThrow({
            where: { id: batch.id },
            include: {
              uploads: { orderBy: { position: 'asc' }, include: uploadInclude },
            },
          });
        return { status: 'created', uploads: created.uploads.map(toUpload) };
      });
    },
    async findUpload(principal, siteId, uploadId) {
      const record = await prisma.allocationPlanUpload.findFirst({
        where: {
          id: uploadId,
          tenantId: principal.tenantId,
          siteId,
          uploadedById: principal.userId,
        },
        include: uploadInclude,
      });
      return record ? toUpload(record) : null;
    },
    async complete(principal, upload, finalObjectKey) {
      return prisma.$transaction(async (transaction) => {
        const current = await transaction.allocationPlanUpload.findFirst({
          where: {
            id: upload.id,
            tenantId: principal.tenantId,
            siteId: upload.siteId,
          },
          include: uploadInclude,
        });
        if (current?.allocationPlan) return toPlan(current.allocationPlan);
        if (current?.status !== 'PENDING')
          throw new Error('upload_not_pending');
        const plan = await transaction.allocationPlan.create({
          data: {
            tenantId: upload.tenantId,
            siteId: upload.siteId,
            uploadedById: principal.userId,
            objectKey: finalObjectKey,
            name: upload.filename,
            filename: upload.filename,
            mediaType: upload.mediaType,
            byteSize: upload.byteSize,
            checksumSha256: upload.checksumSha256,
          },
          include: { uploadedBy: { include: { personalProfile: true } } },
        });
        const asset = library
          ? await library(transaction, {
              tenantId: upload.tenantId,
              sourceSiteId: upload.siteId,
              sourceKind: 'plan',
              sourceId: upload.id,
              filename: upload.filename,
              mediaType: upload.mediaType,
              byteSize: upload.byteSize,
              checksumSha256: upload.checksumSha256,
              uploadedById: principal.userId,
              originalKey: finalObjectKey,
              createdAt: plan.createdAt,
            })
          : null;
        await transaction.allocationPlanUpload.update({
          where: { id: upload.id },
          data: {
            status: 'COMPLETED',
            ...(asset ? { libraryFileId: asset.id } : {}),
            allocationPlanId: plan.id,
            groupedPlanId: plan.id,
            position: 0,
            verifiedObjectKey: finalObjectKey,
            verifiedAt: new Date(),
          },
        });
        if (activityEnabled)
          await transaction.activity.create({
            data: {
              tenantId: principal.tenantId,
              siteId: upload.siteId,
              actorMembershipId: principal.membershipId,
              kind: 'ALLOCATION_PLAN_ADDED',
              subjectId: plan.id,
              subjectLabel: plan.filename,
            },
          });
        return toPlan(plan);
      });
    },
    async reject(uploadId, code) {
      await prisma.allocationPlanUpload.updateMany({
        where: { id: uploadId, status: 'PENDING' },
        data: { status: 'REJECTED', rejectionCode: code },
      });
    },
  };
}
