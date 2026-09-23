/** @spec sign-additional-type-options REQ-001..REQ-006 */
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { expect, it, vi } from 'vitest';
import { createSignageScheduleFeature } from './signage-schedule.js';
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
      expect(
        (
          await feature.load(
            { ...principal, roleId: 'editor' },
            siteId,
            plan.id,
            null,
          )
        ).canManageSigns,
      ).toBe(true);
      await expect(
        feature.load(principal, siteId, randomUUID(), null),
      ).rejects.toThrow();
      await expect(
        feature.load(principal, siteId, plan.id, randomUUID()),
      ).rejects.toThrow();

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
      // sign-function-options REQ-004: new Signs default to Directional.
      expect(one.function).toBe('Directional');
      expect(
        (await db.sign.findUniqueOrThrow({ where: { id: one.id } })).function,
      ).toBe('Directional');
      // REQ-005,006: explicit default replays old requests; different mounting conflicts.
      expect(
        (
          await feature.create(principal, siteId, plan.id, {
            ...input,
            mounting: 'Wall-mounted',
          })
        ).id,
      ).toBe(one.id);
      await expect(
        feature.create(principal, siteId, plan.id, {
          ...input,
          mounting: 'Floor',
        }),
      ).rejects.toThrow();
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
      // allocation-plan-add-linear REQ-001,004,007..010: one shared Sign, atomic geometry, fixed appearance.
      const linearInput = {
        ...input,
        placementKind: 'linear' as const,
        mounting: 'Safety Decal' as const,
        endX: 0.8,
        endY: 0.6,
        idempotencyKey: randomUUID(),
      };
      const [line, replay] = await Promise.all([
        feature.create(principal, siteId, plan.id, linearInput),
        feature.create(principal, siteId, plan.id, linearInput),
      ]);
      expect(line.id).toBe(replay.id);
      expect(line).toMatchObject({
        placementKind: 'linear',
        code: 'Pr.01',
        colour: 'Orange',
        function: 'Regulatory/Statutory',
        endX: 0.8,
        endY: 0.6,
      });
      expect(
        await db.sign.findUniqueOrThrow({ where: { id: line.id } }),
      ).toMatchObject({ code: 'Pr.01', mounting: 'Safety Decal' });
      const schedule = createSignageScheduleFeature(db);
      expect(
        (await schedule.load(principal, siteId)).signTypes.flatMap(
          (group) => group.signs,
        ),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: line.id, code: 'Pr.01' }),
        ]),
      );
      for (const changes of [
        { x: 0.1, y: 0.1 },
        { colour: 'Red' as const },
        { mounting: 'Floor' as const },
      ]) {
        await expect(
          feature.update(principal, siteId, plan.id, line.id, {
            expectedUpdatedAt: line.updatedAt,
            ...changes,
          }),
        ).rejects.toThrow();
      }
      await expect(
        feature.create(principal, siteId, plan.id, {
          ...linearInput,
          endX: 0.9,
        }),
      ).rejects.toThrow();
      await expect(
        feature.update(principal, siteId, plan.id, one.id, {
          expectedUpdatedAt: one.updatedAt,
          colour: 'Orange',
        }),
      ).rejects.toThrow();
      const moved = await feature.update(principal, siteId, plan.id, line.id, {
        expectedUpdatedAt: line.updatedAt,
        x: 0.1,
        y: 0.2,
        endX: 0.5,
        endY: 0.9,
        function: 'Informational',
      });
      expect(moved).toMatchObject({
        x: 0.1,
        y: 0.2,
        endX: 0.5,
        endY: 0.9,
        function: 'Informational',
      });
      await expect(
        feature.update(principal, siteId, plan.id, line.id, {
          expectedUpdatedAt: line.updatedAt,
          x: 0.2,
          y: 0.2,
          endX: 0.5,
          endY: 0.9,
        }),
      ).rejects.toThrow();
      await expect(
        db.signPlacement.update({
          where: { signId: line.id },
          data: { endX: 0.1, endY: 0.2 },
        }),
      ).rejects.toThrow();
      await feature.remove(
        principal,
        siteId,
        plan.id,
        line.id,
        moved.updatedAt,
      );
      expect(
        await db.signPlacement.findUnique({ where: { signId: line.id } }),
      ).toBeNull();
      await expect(
        feature.create(principal, siteId, plan.id, linearInput),
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
      for (const mounting of [
        'Freestanding',
        'Wall-mounted',
        'Overhead',
        'Cantilevered',
        'Floor',
        'Safety Decal',
        'Privacy Decal',
        'Environmental',
      ] as const) {
        const request = { ...input, mounting, idempotencyKey: randomUUID() };
        const created = await feature.create(
          principal,
          siteId,
          plan.id,
          request,
        );
        expect(created.mounting).toBe(mounting);
        expect(
          (await feature.create(principal, siteId, plan.id, request)).id,
        ).toBe(created.id);
        expect(
          (await feature.load(principal, siteId, plan.id, null)).signs.find(
            (sign) => sign.id === created.id,
          )?.mounting,
        ).toBe(mounting);
        await feature.remove(
          principal,
          siteId,
          plan.id,
          created.id,
          created.updatedAt,
        );
      }
      // REQ-001,004,008: real uploaded-file ownership, shared edits and bounded transaction retries.
      const filePlan = await db.allocationPlan.create({
        data: {
          tenantId: principal.tenantId,
          siteId,
          uploadedById: principal.userId,
          name: 'Linear file',
        },
      });
      await expect(
        feature.load(principal, siteId, filePlan.id, null),
      ).rejects.toThrow();
      const batch = await db.allocationPlanUploadBatch.create({
        data: {
          tenantId: principal.tenantId,
          siteId,
          keyDigest: randomUUID(),
          requestDigest: randomUUID(),
        },
      });
      const upload = await db.allocationPlanUpload.create({
        data: {
          tenantId: principal.tenantId,
          siteId,
          uploadedById: principal.userId,
          batchId: batch.id,
          groupedPlanId: filePlan.id,
          objectKey: randomUUID(),
          filename: 'linear.png',
          mediaType: 'image/png',
          byteSize: 1,
          checksumSha256: 'x'.repeat(44),
          status: 'COMPLETED',
          verifiedAt: new Date(),
          expiresAt: new Date(Date.now() + 60000),
        },
      });
      const request = {
        ...linearInput,
        fileId: upload.id,
        idempotencyKey: randomUUID(),
      };
      const saved = await feature.create(
        principal,
        siteId,
        filePlan.id,
        request,
      );
      expect(
        (await feature.load(principal, siteId, filePlan.id, upload.id)).signs,
      ).toEqual([saved]);
      await expect(
        feature.create(principal, siteId, plan.id, request),
      ).rejects.toThrow();
      const renamed = await feature.update(
        principal,
        siteId,
        filePlan.id,
        saved.id,
        {
          expectedUpdatedAt: saved.updatedAt,
          code: 'Corridor strip',
          colour: 'Orange',
        },
      );
      expect(
        (await schedule.load(principal, siteId)).signTypes.flatMap(
          (g) => g.signs,
        ),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: saved.id, code: 'Corridor strip' }),
        ]),
      );
      await expect(
        feature.remove(
          principal,
          siteId,
          filePlan.id,
          saved.id,
          saved.updatedAt,
        ),
      ).rejects.toThrow();
      await feature.remove(
        principal,
        siteId,
        filePlan.id,
        saved.id,
        renamed.updatedAt,
      );
      await db.allocationPlanUpload.delete({ where: { id: upload.id } });
      await db.allocationPlan.delete({ where: { id: filePlan.id } });
      // sign-mounting-options REQ-003,004: all options persist and read back without changing grouping.
      let current = two;
      const originalGroup = await db.sign.findUniqueOrThrow({
        where: { id: two.id },
      });
      for (const mounting of [
        'Freestanding',
        'Wall-mounted',
        'Overhead',
        'Cantilevered',
        'Floor',
        'Safety Decal',
        'Privacy Decal',
        'Environmental',
      ] as const) {
        current = await feature.update(principal, siteId, plan.id, two.id, {
          expectedUpdatedAt: current.updatedAt,
          mounting,
        });
        expect(
          (await feature.load(principal, siteId, plan.id, null)).signs.find(
            (sign) => sign.id === two.id,
          )?.mounting,
        ).toBe(mounting);
        expect(
          (await db.sign.findUniqueOrThrow({ where: { id: two.id } }))
            .signTypeId,
        ).toBe(originalGroup.signTypeId);
      }
      // sign-function-options REQ-002..004: every Function persists, with guarded updates.
      for (const value of [
        'Identification',
        'Directional',
        'Informational',
        'Regulatory/Statutory',
      ] as const) {
        const before = await db.sign.findUniqueOrThrow({
          where: { id: two.id },
        });
        await expect(
          feature.update(
            { ...principal, roleId: 'viewer' },
            siteId,
            plan.id,
            two.id,
            { expectedUpdatedAt: current.updatedAt, function: value },
          ),
        ).rejects.toThrow();
        await expect(
          feature.update(principal, siteId, plan.id, two.id, {
            expectedUpdatedAt: one.updatedAt,
            function: value,
          }),
        ).rejects.toThrow();
        current = await feature.update(principal, siteId, plan.id, two.id, {
          expectedUpdatedAt: current.updatedAt,
          function: value,
        });
        expect(
          (await feature.load(principal, siteId, plan.id, null)).signs.find(
            (sign) => sign.id === two.id,
          )?.function,
        ).toBe(value);
        expect(
          await db.sign.findUniqueOrThrow({ where: { id: two.id } }),
        ).toEqual({
          ...before,
          function: value,
          updatedAt: new Date(current.updatedAt),
        });
      }
      await db.sign.update({
        where: { id: two.id },
        data: { function: 'Wayfinder' },
      });
      expect(
        (await feature.load(principal, siteId, plan.id, null)).signs.find(
          (sign) => sign.id === two.id,
        )?.function,
      ).toBe('Directional');
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
      const offline = vi
        .spyOn(db, '$transaction')
        .mockRejectedValueOnce(new Error('offline'));
      await expect(
        feature.create(principal, siteId, plan.id, {
          ...linearInput,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow('offline');
      offline.mockRestore();
      const retryFailure = vi.spyOn(db, '$transaction').mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('retry', {
          code: 'P2034',
          clientVersion: 'test',
        }),
      );
      await expect(
        feature.create(principal, siteId, plan.id, {
          ...linearInput,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow();
      expect(retryFailure).toHaveBeenCalledTimes(4);
      retryFailure.mockRestore();
    } finally {
      vi.restoreAllMocks();
      await db.sign.deleteMany({ where: { siteId } });
      await db.site.deleteMany({ where: { id: siteId } });
      await db.$disconnect();
    }
  },
);
