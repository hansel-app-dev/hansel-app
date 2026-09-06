/** @spec site-allocation-plans-add REQ-001, REQ-006..REQ-018, REQ-022 */
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { AllocationPlan } from '@hansel/contracts';
import type { ApplicationPrincipal } from './sites.js';
import type {
  AllocationPlanStore,
  PendingAllocationPlanUpload,
} from './allocation-plans.js';

function accessWhere(principal: ApplicationPrincipal): Prisma.SiteWhereInput {
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
    include: { uploadedBy: { include: { personalProfile: true } } },
  },
} satisfies Prisma.AllocationPlanUploadInclude;

function uploaderName(user: {
  email: string;
  personalProfile: { firstName: string; lastName: string } | null;
}): string {
  return user.personalProfile
    ? `${user.personalProfile.firstName} ${user.personalProfile.lastName}`
    : user.email.slice(0, user.email.indexOf('@'));
}

function toPlan(record: {
  id: string;
  filename: string;
  mediaType: string;
  byteSize: number;
  createdAt: Date;
  updatedAt: Date;
  uploadedBy: {
    email: string;
    personalProfile: { firstName: string; lastName: string } | null;
  };
}): AllocationPlan {
  return {
    id: record.id,
    filename: record.filename,
    mediaType: record.mediaType as AllocationPlan['mediaType'],
    byteSize: record.byteSize,
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
    ...(record.allocationPlan ? { plan: toPlan(record.allocationPlan) } : {}),
  };
}

export function createPrismaAllocationPlanStore(
  prisma: PrismaClient,
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
        include: { uploadedBy: { include: { personalProfile: true } } },
      });
      return records.map(toPlan);
    },
    async createBatch(input) {
      return prisma.$transaction(async (transaction) => {
        const previous = await transaction.allocationPlanUploadBatch.findUnique(
          {
            where: {
              tenantId_keyDigest: {
                tenantId: input.principal.tenantId,
                keyDigest: input.keyDigest,
              },
            },
            include: { uploads: { include: uploadInclude } },
          },
        );
        if (previous)
          return previous.requestDigest === input.requestDigest
            ? {
                status: 'replayed' as const,
                uploads: previous.uploads.map(toUpload),
              }
            : { status: 'conflict' as const };
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
        const batch = await transaction.allocationPlanUploadBatch.create({
          data: {
            id: randomUUID(),
            tenantId: input.principal.tenantId,
            siteId: input.siteId,
            keyDigest: input.keyDigest,
            requestDigest: input.requestDigest,
            uploads: {
              create: input.uploads.map((upload) => ({
                ...upload,
                tenantId: input.principal.tenantId,
                siteId: input.siteId,
                uploadedById: input.principal.userId,
                expiresAt: input.expiresAt,
              })),
            },
          },
          include: { uploads: { include: uploadInclude } },
        });
        return { status: 'created', uploads: batch.uploads.map(toUpload) };
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
            filename: upload.filename,
            mediaType: upload.mediaType,
            byteSize: upload.byteSize,
            checksumSha256: upload.checksumSha256,
          },
          include: { uploadedBy: { include: { personalProfile: true } } },
        });
        await transaction.allocationPlanUpload.update({
          where: { id: upload.id },
          data: { status: 'COMPLETED', allocationPlanId: plan.id },
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
