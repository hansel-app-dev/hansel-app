/** @spec allocation-plan-add-area REQ-001,004,007..010 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, it, vi } from 'vitest';
import { createPlanAreasFeature } from './plan-areas.js';
it.skipIf(process.env.PLAN_AREAS_INTEGRATION !== 'true')(
  'persists independent Areas with guarded ownership, retries, codes and lifecycle',
  async () => {
    const db = new PrismaClient();
    const siteId = randomUUID();
    try {
      const m = await db.membership.findFirstOrThrow({
        where: { roleId: 'owner' },
      });
      const p = {
        tenantId: m.tenantId,
        membershipId: m.id,
        userId: m.userId,
        roleId: 'owner',
        email: 'area@example.test',
      };
      await db.site.create({
        data: {
          id: siteId,
          tenantId: m.tenantId,
          createdByMembershipId: m.id,
          name: 'Area integration',
          accessScope: 'PRIVATE',
        },
      });
      const plan = await db.allocationPlan.create({
        data: {
          tenantId: m.tenantId,
          siteId,
          uploadedById: m.userId,
          name: 'Areas',
          objectKey: randomUUID(),
          filename: 'plan.png',
          mediaType: 'image/png',
        },
      });
      const feature = createPlanAreasFeature(db);
      expect(
        (await feature.load({ ...p, roleId: 'editor' }, siteId, plan.id, null))
          .canManageAreas,
      ).toBe(true);
      expect(
        (await feature.load({ ...p, roleId: 'viewer' }, siteId, plan.id, null))
          .canManageAreas,
      ).toBe(false);
      await expect(
        feature.load(p, siteId, randomUUID(), null),
      ).rejects.toThrow();

      const input = {
        fileId: null,
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.4,
        idempotencyKey: randomUUID(),
      };
      const [one, replay] = await Promise.all([
        feature.create(p, siteId, plan.id, input),
        feature.create(p, siteId, plan.id, input),
      ]);
      expect(one).toMatchObject({
        code: 'Ar.01',
        type: 'Floor',
        function: 'Environmental',
        colour: 'Blue',
      });
      expect(replay.id).toBe(one.id);
      await expect(
        feature.create(p, siteId, plan.id, { ...input, width: 0.2 }),
      ).rejects.toThrow();
      await expect(
        feature.create({ ...p, roleId: 'viewer' }, siteId, plan.id, {
          ...input,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow();
      await expect(
        feature.create(p, siteId, plan.id, {
          ...input,
          fileId: randomUUID(),
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow();
      await expect(
        feature.load({ ...p, tenantId: randomUUID() }, siteId, plan.id, null),
      ).rejects.toThrow();
      const two = await feature.create(p, siteId, plan.id, {
        ...input,
        idempotencyKey: randomUUID(),
      });
      expect(two.code).toBe('Ar.02');
      let edit = await feature.update(p, siteId, plan.id, one.id, {
        expectedUpdatedAt: one.updatedAt,
        code: 'Room A',
        content: 'Floor zone',
        orientation: 'up',
        x: 0.3,
        y: 0.4,
      });
      expect(edit).toMatchObject({
        width: 0.3,
        height: 0.4,
        code: 'Room A',
        content: 'Floor zone',
        orientation: 'up',
        x: 0.3,
        y: 0.4,
      });
      // @spec allocation-plan-area-transform REQ-003,006
      edit = await feature.update(p, siteId, plan.id, one.id, {
        expectedUpdatedAt: edit.updatedAt,
        x: 0.2,
        y: 0.2,
        width: 0.5,
        height: 0.6,
      });
      expect(edit).toMatchObject({
        x: 0.2,
        y: 0.2,
        width: 0.5,
        height: 0.6,
        code: 'Room A',
        content: 'Floor zone',
        orientation: 'up',
      });
      await expect(
        feature.update(p, siteId, plan.id, one.id, {
          expectedUpdatedAt: edit.updatedAt,
          x: 0.8,
          y: 0.2,
          width: 0.5,
          height: 0.6,
        }),
      ).rejects.toThrow();
      await expect(
        feature.update(p, siteId, plan.id, one.id, {
          expectedUpdatedAt: one.updatedAt,
          content: 'stale',
        }),
      ).rejects.toThrow();
      await expect(
        feature.update(p, siteId, plan.id, one.id, {
          expectedUpdatedAt: edit.updatedAt,
          x: 0.9,
          y: 0.9,
        }),
      ).rejects.toThrow();
      await expect(
        feature.update({ ...p, roleId: 'viewer' }, siteId, plan.id, one.id, {
          expectedUpdatedAt: edit.updatedAt,
          content: 'bad',
        }),
      ).rejects.toThrow();
      await expect(
        feature.update(p, siteId, plan.id, two.id, {
          expectedUpdatedAt: two.updatedAt,
          code: 'room a',
        }),
      ).rejects.toThrow();
      expect(
        (await feature.load(p, siteId, plan.id, null)).areas,
      ).toContainEqual(edit);
      expect(await db.sign.count({ where: { siteId } })).toBe(0);
      expect(await db.signType.count({ where: { siteId } })).toBe(0);
      await expect(
        feature.remove(p, siteId, plan.id, one.id, one.updatedAt),
      ).rejects.toThrow();
      await feature.remove(p, siteId, plan.id, one.id, edit.updatedAt);
      await expect(feature.create(p, siteId, plan.id, input)).rejects.toThrow();
      expect(await db.planArea.count({ where: { siteId } })).toBe(1);

      await db.planArea.update({
        where: { id: two.id },
        data: {
          code: 'Ar.' + '9'.repeat(37),
          normalizedCode: 'ar.' + '9'.repeat(37),
        },
      });
      await expect(
        feature.create(p, siteId, plan.id, {
          ...input,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow();
      await db.planArea.update({
        where: { id: two.id },
        data: { code: 'Custom', normalizedCode: 'custom' },
      });
      await db.planArea.createMany({
        data: Array.from({ length: 4999 }, (_, i) => ({
          tenantId: p.tenantId,
          siteId,
          planId: plan.id,
          code: `Capacity ${String(i)}`,
          normalizedCode: `capacity ${String(i)}`,
          x: 0,
          y: 0,
          width: 0.1,
          height: 0.1,
        })),
      });
      await expect(
        feature.create(p, siteId, plan.id, {
          ...input,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow();
      await db.allocationPlan.delete({ where: { id: plan.id } });
      expect(await db.planArea.count({ where: { siteId } })).toBe(0);
      expect(await db.planAreaRequest.count({ where: { siteId } })).toBe(0);
      const filePlan = await db.allocationPlan.create({
        data: {
          tenantId: p.tenantId,
          siteId,
          uploadedById: p.userId,
          name: 'File areas',
        },
      });
      await expect(
        feature.load(p, siteId, filePlan.id, null),
      ).rejects.toThrow();
      const batch = await db.allocationPlanUploadBatch.create({
        data: {
          tenantId: p.tenantId,
          siteId,
          keyDigest: randomUUID(),
          requestDigest: randomUUID(),
        },
      });
      const upload = await db.allocationPlanUpload.create({
        data: {
          tenantId: p.tenantId,
          siteId,
          uploadedById: p.userId,
          batchId: batch.id,
          groupedPlanId: filePlan.id,
          objectKey: randomUUID(),
          filename: 'area.png',
          mediaType: 'image/png',
          byteSize: 1,
          checksumSha256: 'x'.repeat(44),
          status: 'COMPLETED',
          verifiedAt: new Date(),
          expiresAt: new Date(Date.now() + 60000),
        },
      });
      const fileArea = await feature.create(p, siteId, filePlan.id, {
        ...input,
        fileId: upload.id,
        idempotencyKey: randomUUID(),
      });
      expect(
        (await feature.load(p, siteId, filePlan.id, upload.id)).areas,
      ).toEqual([fileArea]);
      await expect(
        db.planArea.update({ where: { id: fileArea.id }, data: { width: 2 } }),
      ).rejects.toThrow();
      await db.allocationPlanUpload.delete({ where: { id: upload.id } });
      expect(await db.planArea.count({ where: { siteId } })).toBe(0);
      await db.allocationPlan.delete({ where: { id: filePlan.id } });
      const offline = vi
        .spyOn(db, '$transaction')
        .mockRejectedValueOnce(new Error('offline'));
      await expect(
        feature.create(p, siteId, plan.id, {
          ...input,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow('offline');
      offline.mockRestore();
    } finally {
      await db.site.deleteMany({ where: { id: siteId } });
      await db.$disconnect();
    }
  },
);
