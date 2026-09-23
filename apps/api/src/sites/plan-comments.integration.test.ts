/** @spec allocation-plan-comments REQ-001,004..010,012 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createPlanCommentsFeature } from './plan-comments.js';
it.skipIf(process.env.PLAN_COMMENTS_INTEGRATION !== 'true')(
  'REQ-001,005,006,010: Viewer threads, retries, resolution, isolation and parent deletion',
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
          name: 'Generated Plan Comments test',
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
      const f = createPlanCommentsFeature(db),
        draft = {
          idempotencyKey: randomUUID(),
          body: 'Check here',
          mentions: [],
          attachmentIds: [],
          threadId: null,
          x: 0.2,
          y: 0.3,
        };
      const root = await f.submit(p, siteId, plan.id, null, draft);
      expect((await f.submit(p, siteId, plan.id, null, draft)).thread.id).toBe(
        root.thread.id,
      );
      await expect(
        f.submit(p, siteId, plan.id, null, { ...draft, body: 'changed' }),
      ).rejects.toThrow();
      const reply = {
        ...draft,
        idempotencyKey: randomUUID(),
        threadId: root.thread.id,
        x: null,
        y: null,
        body: 'Confirmed',
      };
      await f.submit(p, siteId, plan.id, null, reply);
      expect(
        (
          await f.history(p, siteId, plan.id, null, root.thread.id)
        ).comments.map((c) => c.body),
      ).toEqual(['Check here', 'Confirmed']);
      const resolved = await f.state(p, siteId, plan.id, null, root.thread.id, {
        resolved: true,
        expectedUpdatedAt: root.thread.updatedAt,
      });
      expect((await f.markers(p, siteId, plan.id, null)).threads).toHaveLength(
        0,
      );
      expect(
        (await f.markers(p, siteId, plan.id, null, true)).threads,
      ).toHaveLength(1);
      expect(
        (
          await f.state(p, siteId, plan.id, null, root.thread.id, {
            resolved: true,
            expectedUpdatedAt: root.thread.updatedAt,
          })
        ).updatedAt,
      ).toBe(resolved.updatedAt);
      await expect(
        f.state(p, siteId, plan.id, null, root.thread.id, {
          resolved: false,
          expectedUpdatedAt: root.thread.updatedAt,
        }),
      ).rejects.toThrow();
      await expect(
        f.submit(p, siteId, plan.id, null, {
          ...reply,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow();
      // A previously committed reply still replays after resolution.
      expect(
        (await f.submit(p, siteId, plan.id, null, reply)).comment.body,
      ).toBe('Confirmed');
      await f.state(p, siteId, plan.id, null, root.thread.id, {
        resolved: false,
        expectedUpdatedAt: resolved.updatedAt,
      });
      expect(
        (await f.people(p, siteId, plan.id, null, '')).people.some(
          (v) => v.id === member.id,
        ),
      ).toBe(true);
      await expect(
        f.markers({ ...p, tenantId: randomUUID() }, siteId, plan.id, null),
      ).rejects.toThrow();
      await expect(
        f.markers(p, siteId, plan.id, randomUUID()),
      ).rejects.toThrow();
      await expect(
        f.submit(p, siteId, plan.id, null, {
          ...draft,
          idempotencyKey: randomUUID(),
          attachmentIds: [randomUUID()],
        }),
      ).rejects.toThrow();
      expect(
        await db.allocationPlanCommentThread.count({
          where: { planId: plan.id },
        }),
      ).toBe(1);
      expect(await db.sign.count({ where: { siteId } })).toBe(0);
      // REQ-008: current accessible names are checked, not trusted mention tokens.
      const mentioned = {
        ...draft,
        idempotencyKey: randomUUID(),
        body: '@Member here',
        mentions: [
          { membershipId: member.id, name: 'Member', start: 0, end: 7 },
        ],
      };
      await f.submit(p, siteId, plan.id, null, mentioned);
      await expect(
        f.submit(p, siteId, plan.id, null, {
          ...mentioned,
          idempotencyKey: randomUUID(),
          mentions: [
            { name: 'Member', start: 0, end: 7, membershipId: randomUUID() },
          ],
        }),
      ).rejects.toThrow('mention_unavailable');
      await db.personalProfile.create({
        data: {
          userId,
          firstName: 'Test',
          lastName: 'Viewer',
          jobTitle: 'Other',
          department: 'Other',
        },
      });
      expect(
        (await f.people(p, siteId, plan.id, null, 'Test')).people[0]?.name,
      ).toBe('Test Viewer');
      await f.people(p, siteId, plan.id, null, '', member.id);
      await db.site.update({
        where: { id: siteId },
        data: { accessScope: 'PRIVATE', organizationAccess: null },
      });
      await expect(f.markers(p, siteId, plan.id, null)).rejects.toThrow();
      const admin = {
        ...p,
        membershipId: owner.id,
        userId: owner.userId,
        roleId: 'owner',
      };
      await f.people(admin, siteId, plan.id, null, '');
      await db.site.update({
        where: { id: siteId },
        data: {
          accessScope: 'ORGANIZATION',
          organizationAccess: 'VIEW_COMMENT',
        },
      });
      await expect(
        f.history(p, siteId, plan.id, null, randomUUID()),
      ).rejects.toThrow();
      await expect(
        f.state(p, siteId, plan.id, null, randomUUID(), {
          resolved: true,
          expectedUpdatedAt: root.thread.updatedAt,
        }),
      ).rejects.toThrow();
      await expect(
        f.submit(p, siteId, plan.id, null, {
          ...reply,
          threadId: randomUUID(),
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow();
      // REQ-005,012: stable marker/history pagination and a recoverable capacity boundary.
      await db.allocationPlanComment.createMany({
        data: Array.from({ length: 51 }, (_, i) => ({
          tenantId: p.tenantId,
          siteId,
          planId: plan.id,
          threadId: root.thread.id,
          authorId: member.id,
          authorName: 'Test Viewer',
          body: `Reply ${String(i)}`,
          mentions: [],
          requestKey: randomUUID(),
          digest: '0'.repeat(64),
        })),
      });
      const history = await f.history(p, siteId, plan.id, null, root.thread.id);
      expect(history.comments).toHaveLength(50);
      expect(history.nextCursor).not.toBeNull();
      const remaining = await f.history(
        p,
        siteId,
        plan.id,
        null,
        root.thread.id,
        history.nextCursor ?? undefined,
      );
      expect(remaining.comments).toHaveLength(3);
      await db.allocationPlanCommentThread.createMany({
        data: Array.from({ length: 4998 }, (_, i) => ({
          tenantId: p.tenantId,
          siteId,
          planId: plan.id,
          fileId: null,
          x: 0.5,
          y: 0.5,
          authorId: member.id,
          authorName: 'Test Viewer',
          preview: `Thread ${String(i)}`,
        })),
      });
      const markers = await f.markers(p, siteId, plan.id, null);
      expect(markers.threads).toHaveLength(100);
      expect(markers.nextCursor).not.toBeNull();
      const more = await f.markers(
        p,
        siteId,
        plan.id,
        null,
        false,
        markers.nextCursor ?? undefined,
      );
      expect(more.threads).toHaveLength(100);
      expect(
        more.threads.some((t) => markers.threads.some((m) => m.id === t.id)),
      ).toBe(false);
      await expect(
        f.submit(p, siteId, plan.id, null, {
          ...draft,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow('comment_capacity_reached');
      // REQ-005,006: concurrent resolution and reply serialize on the parent.
      const currentThread = (
        await f.history(p, siteId, plan.id, null, root.thread.id)
      ).thread;
      const raced = await Promise.allSettled([
        f.submit(p, siteId, plan.id, null, {
          ...reply,
          idempotencyKey: randomUUID(),
          body: 'Concurrent reply',
        }),
        f.state(p, siteId, plan.id, null, root.thread.id, {
          resolved: true,
          expectedUpdatedAt: currentThread.updatedAt,
        }),
      ]);
      expect(raced[1].status).toBe('fulfilled');
      expect(
        (await f.history(p, siteId, plan.id, null, root.thread.id)).thread
          .resolved,
      ).toBe(true);
      await expect(
        f.submit(p, siteId, plan.id, null, {
          ...reply,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow();
      await db.allocationPlan.delete({ where: { id: plan.id } });
      expect(
        await db.allocationPlanComment.count({ where: { planId: plan.id } }),
      ).toBe(0);
      await expect(
        f.submit(p, siteId, plan.id, null, {
          ...draft,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow();
    } finally {
      await db.site.deleteMany({ where: { id: siteId } });
      await db.user.deleteMany({ where: { id: userId } });
      await db.$disconnect();
    }
  },
);
