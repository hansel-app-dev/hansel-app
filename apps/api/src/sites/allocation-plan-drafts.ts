import type { LibraryRegistrationHook } from './library-files.js';
/** @spec allocation-plan-multiple-files REQ-001, REQ-003, REQ-008..REQ-010 */
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  commitAllocationPlanDraftRequestSchema,
  createAllocationPlanUploadBatchRequestSchema,
  type CommitAllocationPlanDraftRequest,
  type CreateAllocationPlanUploadBatchRequest,
} from '@hansel/contracts';
import {
  AllocationPlansConflictError,
  AllocationPlansForbiddenError,
  AllocationPlansNotFoundError,
  AllocationPlanUploadRejectedError,
  createAllocationPlansFeature,
  validSignature,
  type AllocationPlanObjectStore,
} from './allocation-plans.js';
import {
  accessWhere,
  createPrismaAllocationPlanStore,
  toPlan,
} from './prisma-allocation-plan-store.js';
import type { ApplicationPrincipal } from './sites.js';

const planInclude = {
  files: { orderBy: { position: 'asc' as const } },
  uploadedBy: { include: { personalProfile: true } },
};

export function createAllocationPlanDraftsFeature({
  prisma,
  objects,
  digest,
  activityEnabled = false,
  library,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  objects: AllocationPlanObjectStore;
  digest: (value: string) => string;
  activityEnabled?: boolean;
  library?: LibraryRegistrationHook;
  now?: () => Date;
}) {
  const legacy = createAllocationPlansFeature({
    store: createPrismaAllocationPlanStore(prisma, activityEnabled),
    objects,
    digest,
    createId: randomUUID,
    now,
  });
  async function authorize(
    tx: Prisma.TransactionClient,
    principal: ApplicationPrincipal,
    siteId: string,
  ) {
    // Serialize against membership changes and recheck trusted current permission.
    await tx.$queryRaw`SELECT id FROM "Membership" WHERE id = ${principal.membershipId}::uuid FOR UPDATE`;
    const member = await tx.membership.findUnique({
      where: { id: principal.membershipId },
    });
    if (
      member?.userId !== principal.userId ||
      member.tenantId !== principal.tenantId ||
      !['owner', 'administrator', 'admin'].includes(member.roleId) ||
      !['owner', 'administrator', 'admin'].includes(principal.roleId)
    )
      throw new AllocationPlansForbiddenError();
    if (
      !(await tx.site.count({
        where: {
          id: siteId,
          ...accessWhere({ ...principal, roleId: member.roleId }),
        },
      }))
    )
      throw new AllocationPlansNotFoundError();
  }
  return {
    async createBatch(
      principal: ApplicationPrincipal,
      siteId: string,
      input: CreateAllocationPlanUploadBatchRequest,
    ) {
      return legacy.createBatch(
        principal,
        siteId,
        createAllocationPlanUploadBatchRequestSchema.parse(input),
        true,
      );
    },
    async verify(
      principal: ApplicationPrincipal,
      siteId: string,
      uploadId: string,
    ) {
      const result = await prisma.$transaction(
        async (tx) => {
          await authorize(tx, principal, siteId);
          await tx.$queryRaw`SELECT id FROM "AllocationPlanUpload" WHERE id = ${uploadId}::uuid FOR UPDATE`;
          const file = await tx.allocationPlanUpload.findFirst({
            where: {
              id: uploadId,
              tenantId: principal.tenantId,
              siteId,
              uploadedById: principal.userId,
              batch: { grouped: true },
            },
          });
          if (!file) throw new AllocationPlansNotFoundError();
          if (file.status !== 'PENDING' || file.expiresAt <= now())
            throw new AllocationPlanUploadRejectedError();
          if (file.verifiedAt) return { uploadId, verified: true as const };
          const object = await objects.inspect(file.objectKey);
          if (
            object?.byteSize !== file.byteSize ||
            object.mediaType !== file.mediaType ||
            object.checksumSha256 !== file.checksumSha256 ||
            !validSignature(file.mediaType, object.leadingBytes)
          ) {
            await tx.allocationPlanUpload.update({
              where: { id: file.id },
              data: {
                status: 'REJECTED',
                rejectionCode: 'verification_failed',
              },
            });
            return { uploadId, verified: false as const };
          }
          const verifiedObjectKey = `plans/${file.id}`;
          await objects.promote(file.objectKey, verifiedObjectKey);
          // No plan is created here. Cleanup and commit lock this same row.
          await tx.allocationPlanUpload.update({
            where: { id: file.id },
            data: { verifiedObjectKey, verifiedAt: now() },
          });
          return { uploadId, verified: true as const };
        },
        { timeout: 30_000 },
      );
      await objects.remove(`quarantine/${uploadId}`);
      if (!result.verified) throw new AllocationPlanUploadRejectedError();
      return result;
    },
    async commit(
      principal: ApplicationPrincipal,
      siteId: string,
      raw: CommitAllocationPlanDraftRequest,
    ) {
      const input = commitAllocationPlanDraftRequestSchema.parse(raw);
      const creationKey = digest(`draft-commit:${input.idempotencyKey}`);
      const creationDigest = digest(
        JSON.stringify([siteId, principal.userId, input.name, input.uploadIds]),
      );
      return prisma.$transaction(
        async (tx) => {
          await authorize(tx, principal, siteId);
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${principal.tenantId + creationKey}, 0))::text`;
          const previous = await tx.allocationPlan.findUnique({
            where: {
              tenantId_creationKey: {
                tenantId: principal.tenantId,
                creationKey,
              },
            },
            include: planInclude,
          });
          if (previous) {
            if (previous.creationDigest !== creationDigest)
              throw new AllocationPlansConflictError();
            return { plan: toPlan(previous) };
          }
          for (const id of [...input.uploadIds].sort())
            await tx.$queryRaw`SELECT id FROM "AllocationPlanUpload" WHERE id = ${id}::uuid FOR UPDATE`;
          const files = await tx.allocationPlanUpload.findMany({
            where: {
              id: { in: input.uploadIds },
              tenantId: principal.tenantId,
              siteId,
              uploadedById: principal.userId,
              status: 'PENDING',
              expiresAt: { gt: now() },
              groupedPlanId: null,
              verifiedAt: { not: null },
              verifiedObjectKey: { not: null },
              batch: { grouped: true },
            },
          });
          if (
            files.length !== input.uploadIds.length ||
            new Set(files.map((file) => file.batchId)).size !== 1
          )
            throw new AllocationPlanUploadRejectedError();
          const plan = await tx.allocationPlan.create({
            data: {
              tenantId: principal.tenantId,
              siteId,
              uploadedById: principal.userId,
              name: input.name,
              creationKey,
              creationDigest,
            },
          });
          for (const [position, id] of input.uploadIds.entries()) {
            // The validated selection above contains each locked, verified file.
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const file = files.find((value) => value.id === id)!;
            const asset = library
              ? await library(tx, {
                  tenantId: principal.tenantId,
                  sourceSiteId: siteId,
                  sourceKind: 'plan',
                  sourceId: id,
                  filename: file.filename,
                  mediaType: file.mediaType,
                  byteSize: file.byteSize,
                  checksumSha256: file.checksumSha256,
                  uploadedById: file.uploadedById,
                  // Verification is required by the locked selection query.
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  originalKey: file.verifiedObjectKey!,
                  createdAt: now(),
                })
              : null;
            await tx.allocationPlanUpload.update({
              where: { id },
              data: {
                groupedPlanId: plan.id,
                position,
                status: 'COMPLETED',
                ...(asset ? { libraryFileId: asset.id } : {}),
              },
            });
          }
          if (activityEnabled)
            await tx.activity.create({
              data: {
                tenantId: principal.tenantId,
                siteId,
                actorMembershipId: principal.membershipId,
                kind: 'ALLOCATION_PLAN_ADDED',
                subjectId: plan.id,
                subjectLabel: input.name,
              },
            });
          return {
            plan: toPlan(
              await tx.allocationPlan.findUniqueOrThrow({
                where: { id: plan.id },
                include: planInclude,
              }),
            ),
          };
        },
        { timeout: 30_000 },
      );
    },
    async cleanup() {
      const files = await prisma.allocationPlanUpload.findMany({
        where: {
          batch: { grouped: true },
          OR: [{ rejectionCode: null }, { rejectionCode: { not: 'cleaned' } }],
          expiresAt: { lte: now() },
          status: { in: ['PENDING', 'EXPIRED', 'REJECTED'] },
          groupedPlanId: null,
        },
        take: 100,
        orderBy: { expiresAt: 'asc' },
      });
      for (const file of files) {
        const expired = await prisma.allocationPlanUpload.updateMany({
          where: {
            id: file.id,
            groupedPlanId: null,
            status: { in: ['PENDING', 'EXPIRED', 'REJECTED'] },
            expiresAt: { lte: now() },
          },
          data: { status: 'EXPIRED' },
        });
        if (!expired.count) continue;
        await objects.remove(file.objectKey);
        await objects.remove(`plans/${file.id}`);
        await prisma.allocationPlanUpload.updateMany({
          where: { id: file.id, status: 'EXPIRED', groupedPlanId: null },
          data: { rejectionCode: 'cleaned' },
        });
      }
    },
  };
}
