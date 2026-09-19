import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, it } from 'vitest';
import { createPlanSignsFeature } from './plan-signs.js';

it.skipIf(process.env.PLAN_SIGNS_INTEGRATION !== 'true')(
  'allocation-plan-signs REQ-003,008..012: shared records, retries, permissions and deletion',
  async () => {
    const db = new PrismaClient();
    const siteId = randomUUID();
    try {
      const member = await db.membership.findFirstOrThrow({
        where: { roleId: 'owner' },
      });
      const principal = {
        tenantId: member.tenantId,
        membershipId: member.id,
        userId: member.userId,
        roleId: 'owner',
        email: 'test@example.test',
      };
      await db.site.create({
        data: {
          id: siteId,
          tenantId: member.tenantId,
          createdByMembershipId: member.id,
          name: 'Plan signs integration',
          accessScope: 'PRIVATE',
        },
      });
      const plan = await db.allocationPlan.create({
        data: {
          tenantId: member.tenantId,
          siteId,
          uploadedById: member.userId,
          name: 'Test plan',
          objectKey: randomUUID(),
          filename: 'test.png',
          mediaType: 'image/png',
        },
      });
      const feature = createPlanSignsFeature(db);
      const input = {
        fileId: null,
        x: 0.4,
        y: 0.6,
        idempotencyKey: randomUUID(),
      };
      const [one, retry] = await Promise.all([
        feature.create(principal, siteId, plan.id, input),
        feature.create(principal, siteId, plan.id, input),
      ]);
      expect(one.id).toBe(retry.id);
      expect(one.code).toBe('SG.001');
      expect(one.mounting).toBe('Wall-mounted');
      // REQ-005,006: explicit default replays old requests; different mounting conflicts.
      expect((await feature.create(principal, siteId, plan.id, { ...input, mounting: 'Wall-mounted' })).id).toBe(one.id);
      await expect(feature.create(principal, siteId, plan.id, { ...input, mounting: 'Floor' })).rejects.toThrow();
      expect(await db.sign.count({ where: { siteId } })).toBe(1);
      await expect(
        feature.create(principal, siteId, plan.id, { ...input, x: 0.2 }),
      ).rejects.toThrow();
      await expect(
        feature.create({ ...principal, roleId: 'viewer' }, siteId, plan.id, {
          ...input,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow();
      await expect(
        feature.load(
          { ...principal, tenantId: randomUUID() },
          siteId,
          plan.id,
          null,
        ),
      ).rejects.toThrow();
      const edited = await feature.update(principal, siteId, plan.id, one.id, {
        expectedUpdatedAt: one.updatedAt,
        x: 0.8,
        y: 0.2,
        content: 'Exit',
        orientation: 'left',
      });
      expect(edited.content).toBe('Exit');
      // allocation-plan-sign-moving REQ-004,006: placement is canonical and guarded.
      expect(
        (await feature.load(principal, siteId, plan.id, null)).signs[0],
      ).toMatchObject({ id: one.id, code: one.code, x: 0.8, y: 0.2 });
      await expect(
        feature.update(
          { ...principal, roleId: 'viewer' },
          siteId,
          plan.id,
          one.id,
          { expectedUpdatedAt: edited.updatedAt, x: 0, y: 0 },
        ),
      ).rejects.toThrow();
      await expect(
        feature.update(principal, siteId, plan.id, one.id, {
          expectedUpdatedAt: one.updatedAt,
          x: 0,
          y: 0,
        }),
      ).rejects.toThrow();
      expect(
        await db.signPlacement.findUnique({ where: { signId: one.id } }),
      ).toMatchObject({ x: 0.8, y: 0.2 });
      await expect(
        feature.update(principal, siteId, plan.id, one.id, {
          expectedUpdatedAt: one.updatedAt,
          content: 'Stale',
        }),
      ).rejects.toThrow();
      const two = await feature.create(principal, siteId, plan.id, {
        ...input,
        idempotencyKey: randomUUID(),
        mounting: 'Floor',
      });
      // allocation-plan-add-sign-tool REQ-004,006: chosen mounting is atomic.
      expect(two.mounting).toBe('Floor');
      for (const mounting of ['Freestanding', 'Wall-mounted', 'Overhead', 'Cantilevered', 'Floor'] as const) {
        const request = { ...input, mounting, idempotencyKey: randomUUID() };
        const created = await feature.create(principal, siteId, plan.id, request);
        expect(created.mounting).toBe(mounting);
        expect((await feature.create(principal, siteId, plan.id, request)).id).toBe(created.id);
        expect((await feature.load(principal, siteId, plan.id, null)).signs.find(sign => sign.id === created.id)?.mounting).toBe(mounting);
        await feature.remove(principal, siteId, plan.id, created.id, created.updatedAt);
      }
      // sign-mounting-options REQ-003,004: all options persist and read back without changing grouping.
      let current = two;
      const originalGroup = await db.sign.findUniqueOrThrow({ where: { id: two.id } });
      for (const mounting of ['Freestanding', 'Wall-mounted', 'Overhead', 'Cantilevered', 'Floor'] as const) {
        current = await feature.update(principal, siteId, plan.id, two.id, { expectedUpdatedAt: current.updatedAt, mounting });
        expect((await feature.load(principal, siteId, plan.id, null)).signs.find(sign => sign.id === two.id)?.mounting).toBe(mounting);
        expect((await db.sign.findUniqueOrThrow({ where: { id: two.id } })).signTypeId).toBe(originalGroup.signTypeId);
      }
      await feature.remove(
        principal,
        siteId,
        plan.id,
        one.id,
        edited.updatedAt,
      );
      expect(await db.sign.count({ where: { siteId } })).toBe(1);
      expect(
        (await feature.load(principal, siteId, plan.id, null)).signs.map(
          (sign) => sign.id,
        ),
      ).toEqual([two.id]);
      await expect(
        feature.create(principal, siteId, plan.id, input),
      ).rejects.toThrow();
    } finally {
      await db.sign.deleteMany({ where: { siteId } });
      await db.site.deleteMany({ where: { id: siteId } });
      await db.$disconnect();
    }
  },
);
