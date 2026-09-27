/** @spec allocation-plan-comment-moving REQ-001,005,007,008,010 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createPlanCommentsFeature } from './plan-comments.js';
it.skipIf(process.env.PLAN_COMMENTS_INTEGRATION !== 'true')(
  'REQ-001,005,007,008: Viewer moves another author’s thread, preserves discussion, rejects stale/resolved/foreign/revoked moves and serializes races',
  async () => {
    const db = new PrismaClient(),
      siteId = randomUUID(),
      userId = randomUUID();
    try {
      const owner = await db.membership.findFirstOrThrow({
        where: { roleId: 'owner' },
      });
      const member = await db.membership.create({
        data: {
          tenant: { connect: { id: owner.tenantId } },
          roleId: 'viewer',
          user: { create: { id: userId, email: `${userId}@example.test` } },
        },
      });
      await db.site.create({
        data: {
          id: siteId,
          tenantId: owner.tenantId,
          createdByMembershipId: owner.id,
          name: 'Generated comment position test',
          accessScope: 'ORGANIZATION',
          organizationAccess: 'VIEW_COMMENT',
        },
      });
      const plan = await db.allocationPlan.create({
        data: {
          tenantId: owner.tenantId,
          siteId,
          uploadedById: userId,
          name: 'Plan',
          objectKey: `test/${siteId}`,
        },
      });
      const p = {
        tenantId: member.tenantId,
        membershipId: member.id,
        userId,
        roleId: 'viewer',
        email: `${userId}@example.test`,
      };
      const admin = {
        ...p,
        membershipId: owner.id,
        userId: owner.userId,
        roleId: 'owner',
      };
      const feature = createPlanCommentsFeature(db);
      const root = await feature.submit(admin, siteId, plan.id, null, {
        idempotencyKey: randomUUID(),
        body: '@Member check',
        mentions: [
          { membershipId: member.id, name: 'Member', start: 0, end: 7 },
        ],
        attachmentIds: [],
        threadId: null,
        x: 0.2,
        y: 0.3,
      });
      await feature.submit(p, siteId, plan.id, null, {
        idempotencyKey: randomUUID(),
        body: 'Viewer reply',
        mentions: [],
        attachmentIds: [],
        threadId: root.thread.id,
        x: null,
        y: null,
      });
      const attachmentId = randomUUID();
      await db.allocationPlanCommentAttachment.create({
        data: {
          id: attachmentId,
          tenantId: owner.tenantId,
          siteId,
          planId: plan.id,
          uploadedById: owner.id,
          commentId: root.comment.id,
          filename: 'Reference.pdf',
          mediaType: 'application/pdf',
          byteSize: 1,
          requestKey: randomUUID(),
          digest: 'a'.repeat(64),
          expiresAt: new Date(Date.now() + 3600000),
          checksumSha256: 'a'.repeat(43) + '=',
          completed: true,
        },
      });
      const beforeThread =
        await db.allocationPlanCommentThread.findUniqueOrThrow({
          where: { id: root.thread.id },
        });
      const beforeComments = await db.allocationPlanComment.findMany({
        where: { threadId: root.thread.id },
        include: { attachments: true },
        orderBy: { id: 'asc' },
      });
      const input = {
        x: 0.6,
        y: 0.7,
        expectedUpdatedAt: root.thread.updatedAt,
      };
      const moved = await feature.position(
        p,
        siteId,
        plan.id,
        null,
        root.thread.id,
        input,
      );
      expect(moved).toMatchObject({
        x: 0.6,
        y: 0.7,
        id: root.thread.id,
        author: root.thread.author,
      });
      expect(moved.updatedAt).not.toBe(root.thread.updatedAt);
      const afterThread =
        await db.allocationPlanCommentThread.findUniqueOrThrow({
          where: { id: root.thread.id },
        });
      expect({
        ...afterThread,
        x: beforeThread.x,
        y: beforeThread.y,
        updatedAt: beforeThread.updatedAt,
      }).toEqual(beforeThread);
      expect(
        await db.allocationPlanComment.findMany({
          where: { threadId: root.thread.id },
          include: { attachments: true },
          orderBy: { id: 'asc' },
        }),
      ).toEqual(beforeComments);
      expect(
        (
          await feature.position(
            p,
            siteId,
            plan.id,
            null,
            root.thread.id,
            input,
          )
        ).updatedAt,
      ).toBe(moved.updatedAt);
      expect(
        (await feature.markers(p, siteId, plan.id, null)).threads[0],
      ).toMatchObject({ x: 0.6, y: 0.7 });
      for (const [principal, sourceSite, sourcePlan, file] of [
        [{ ...p, tenantId: randomUUID() }, siteId, plan.id, null],
        [p, randomUUID(), plan.id, null],
        [p, siteId, randomUUID(), null],
        [p, siteId, plan.id, randomUUID()],
      ] as const) {
        await expect(
          feature.position(
            principal,
            sourceSite,
            sourcePlan,
            file,
            root.thread.id,
            { ...input, x: 0.8 },
          ),
        ).rejects.toThrow();
      }
      await expect(
        feature.position(p, siteId, plan.id, null, randomUUID(), input),
      ).rejects.toThrow();
      await expect(
        feature.position(p, siteId, plan.id, null, root.thread.id, {
          ...input,
          x: 0.8,
        }),
      ).rejects.toThrow();
      const races = await Promise.allSettled([
        feature.position(p, siteId, plan.id, null, root.thread.id, {
          x: 0.8,
          y: 0.9,
          expectedUpdatedAt: moved.updatedAt,
        }),
        feature.state(p, siteId, plan.id, null, root.thread.id, {
          resolved: true,
          expectedUpdatedAt: moved.updatedAt,
        }),
      ]);
      expect(races.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const current = (
        await feature.history(p, siteId, plan.id, null, root.thread.id)
      ).thread;
      const resolved = await feature.state(
        p,
        siteId,
        plan.id,
        null,
        root.thread.id,
        { resolved: true, expectedUpdatedAt: current.updatedAt },
      );
      await expect(
        feature.position(p, siteId, plan.id, null, root.thread.id, {
          x: resolved.x,
          y: resolved.y,
          expectedUpdatedAt: resolved.updatedAt,
        }),
      ).rejects.toThrow();
      const reopened = await feature.state(
        p,
        siteId,
        plan.id,
        null,
        root.thread.id,
        { resolved: false, expectedUpdatedAt: resolved.updatedAt },
      );
      await db.site.update({
        where: { id: siteId },
        data: { accessScope: 'PRIVATE', organizationAccess: null },
      });
      await expect(
        feature.position(p, siteId, plan.id, null, root.thread.id, {
          x: 0.1,
          y: 0.1,
          expectedUpdatedAt: reopened.updatedAt,
        }),
      ).rejects.toThrow();
      await db.allocationPlan.delete({ where: { id: plan.id } });
      await expect(
        feature.position(admin, siteId, plan.id, null, root.thread.id, input),
      ).rejects.toThrow();
      expect(await db.sign.count({ where: { siteId } })).toBe(0);
    } finally {
      await db.site.deleteMany({ where: { id: siteId } });
      await db.user.deleteMany({ where: { id: userId } });
      await db.$disconnect();
    }
  },
);
