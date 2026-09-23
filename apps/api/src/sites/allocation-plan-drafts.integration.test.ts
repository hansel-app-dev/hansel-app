import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, it, vi } from 'vitest';
import { createAllocationPlanDraftsFeature } from './allocation-plan-drafts.js';
import { createAllocationPlansFeature } from './allocation-plans.js';
import { createPrismaAllocationPlanStore } from './prisma-allocation-plan-store.js';

it.skipIf(process.env.ALLOCATION_DRAFT_INTEGRATION !== 'true')(
  'REQ-001, REQ-008..010: verifies privately, commits a single file once, preserves legacy plans and rejects foreign/expired files',
  async () => {
    const prisma = new PrismaClient();
    const siteId = randomUUID();
    const bytes = new TextEncoder().encode('%PDF-fixture');
    const digest = (value: string) =>
      createHash('sha256').update(value).digest('hex');
    const checksum = createHash('sha256').update(bytes).digest('base64');
    const objects = {
      signPut: vi.fn().mockResolvedValue('https://example.test/upload'),
      inspect: vi.fn().mockResolvedValue({
        byteSize: bytes.length,
        mediaType: 'application/pdf',
        checksumSha256: checksum,
        leadingBytes: bytes,
      }),
      promote: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue(bytes),
    };
    try {
      const member = await prisma.membership.findFirstOrThrow({
        where: { roleId: 'owner' },
      });
      const principal = {
        tenantId: member.tenantId,
        membershipId: member.id,
        userId: member.userId,
        roleId: 'owner',
        email: 'test@example.test',
      };
      await prisma.site.create({
        data: {
          id: siteId,
          tenantId: member.tenantId,
          createdByMembershipId: member.id,
          name: 'Allocation draft integration',
          accessScope: 'PRIVATE',
        },
      });
      const feature = createAllocationPlanDraftsFeature({
        prisma,
        objects,
        digest,
        activityEnabled: true,
      });
      const batch = await feature.createBatch(principal, siteId, {
        idempotencyKey: randomUUID(),
        files: ['one.pdf'].map((filename) => ({
          filename,
          mediaType: 'application/pdf',
          byteSize: bytes.length,
          checksumSha256: checksum,
        })),
      });
      const ids = batch.uploads.map((upload) => upload.uploadId);
      for (const id of ids) await feature.verify(principal, siteId, id);
      expect(await prisma.allocationPlan.count({ where: { siteId } })).toBe(0);
      expect(await prisma.activity.count({ where: { siteId } })).toBe(0);
      const input = {
        name: 'Ground floor',
        uploadIds: [...ids].reverse(),
        idempotencyKey: randomUUID(),
      };
      const [first, second] = await Promise.all([
        feature.commit(principal, siteId, input),
        feature.commit(principal, siteId, input),
      ]);
      expect(first.plan.id).toBe(second.plan.id);
      expect(first.plan.name).toBe('Ground floor');
      expect(first.plan.files?.map((file) => file.filename)).toEqual([
        'one.pdf',
      ]);
      expect(first.plan.filename).toBeUndefined();
      expect(await prisma.activity.count({ where: { siteId } })).toBe(1);
      await expect(
        feature.commit(principal, siteId, { ...input, name: 'Changed' }),
      ).rejects.toThrow();
      await expect(
        feature.commit(principal, siteId, {
          ...input,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow();
      await expect(
        feature.commit({ ...principal, roleId: 'viewer' }, siteId, input),
      ).rejects.toThrow();
      const pending = await feature.createBatch(principal, siteId, {
        idempotencyKey: randomUUID(),
        files: [
          {
            filename: 'expired.pdf',
            mediaType: 'application/pdf',
            byteSize: bytes.length,
            checksumSha256: checksum,
          },
        ],
      });
      const expiredId = pending.uploads[0]?.uploadId;
      if (!expiredId) throw new Error('Expected upload intent');
      await feature.verify(principal, siteId, expiredId);
      await prisma.allocationPlanUpload.update({
        where: { id: expiredId },
        data: { expiresAt: new Date(0) },
      });
      await expect(
        feature.commit(principal, siteId, {
          ...input,
          idempotencyKey: randomUUID(),
          uploadIds: [expiredId],
        }),
      ).rejects.toThrow();
      await feature.cleanup();
      expect(
        await prisma.allocationPlanUpload.findUnique({
          where: { id: expiredId },
        }),
      ).toMatchObject({ status: 'EXPIRED' });
      expect(await prisma.allocationPlan.count({ where: { siteId } })).toBe(1);
      const legacy = createAllocationPlansFeature({
        store: createPrismaAllocationPlanStore(prisma, true),
        objects,
        digest,
        createId: randomUUID,
        now: () => new Date(),
      });
      const legacyBatch = await legacy.createBatch(principal, siteId, {
        idempotencyKey: randomUUID(),
        files: [
          {
            filename: 'legacy.pdf',
            mediaType: 'application/pdf',
            byteSize: bytes.length,
            checksumSha256: checksum,
          },
        ],
      });
      const legacyId = legacyBatch.uploads[0]?.uploadId;
      if (!legacyId) throw new Error('Expected legacy intent');
      const legacyPlan = await legacy.finalize(principal, siteId, legacyId);
      // allocation-details-design AC-001, AC-003: real relational scoping.
      for (const id of ids) {
        await expect(
          legacy.content(principal, siteId, first.plan.id, id),
        ).resolves.toEqual({ mediaType: 'application/pdf', bytes });
        await expect(
          legacy.content(principal, siteId, legacyPlan.plan.id, id),
        ).rejects.toThrow();
        await expect(
          legacy.content(
            { ...principal, tenantId: randomUUID() },
            siteId,
            first.plan.id,
            id,
          ),
        ).rejects.toThrow();
        await expect(
          legacy.content(principal, randomUUID(), first.plan.id, id),
        ).rejects.toThrow();
      }
      await expect(
        legacy.content(principal, siteId, first.plan.id, expiredId),
      ).rejects.toThrow();
      await expect(
        legacy.content(principal, siteId, legacyPlan.plan.id),
      ).resolves.toEqual({ mediaType: 'application/pdf', bytes });
      const collection = await legacy.list(principal, siteId);
      expect(
        collection.plans.find((plan) => plan.id === legacyPlan.plan.id),
      ).toMatchObject({
        name: 'legacy.pdf',
        filename: 'legacy.pdf',
        files: [{ filename: 'legacy.pdf' }],
      });
      expect(
        collection.plans.find((plan) => plan.id === first.plan.id)?.files,
      ).toHaveLength(1);
      await expect(
        feature.commit(principal, randomUUID(), input),
      ).rejects.toThrow();
      await expect(
        feature.commit({ ...principal, userId: randomUUID() }, siteId, input),
      ).rejects.toThrow();
    } finally {
      await prisma.activity.deleteMany({ where: { siteId } });
      await prisma.allocationPlanUpload.deleteMany({ where: { siteId } });
      await prisma.allocationPlan.deleteMany({ where: { siteId } });
      await prisma.allocationPlanUploadBatch.deleteMany({ where: { siteId } });
      await prisma.site.deleteMany({ where: { id: siteId } });
      await prisma.$disconnect();
    }
  },
);
