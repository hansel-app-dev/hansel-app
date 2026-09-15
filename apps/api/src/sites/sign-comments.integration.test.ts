import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createSignCommentsFeature } from './sign-comments.js';
it.skipIf(process.env.SIGN_COMMENTS_INTEGRATION !== 'true')(
  'sign-comments REQ-004..006: Viewer posts, replies stay in root thread, retries do not duplicate',
  async () => {
    const db = new PrismaClient();
    const siteId = randomUUID();
    const userId = randomUUID();
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
          name: 'Generated Comments test',
          accessScope: 'ORGANIZATION',
          organizationAccess: 'VIEW_COMMENT',
        },
      });
      const group = await db.signType.create({
        data: {
          tenantId: owner.tenantId,
          siteId,
          name: 'Test',
          normalizedName: 'test',
          color: 'RED',
        },
      });
      const sign = await db.sign.create({
        data: {
          tenantId: owner.tenantId,
          siteId,
          signTypeId: group.id,
          code: 'TEST.1',
          normalizedCode: 'test.1',
        },
      });
      const p = {
        tenantId: member.tenantId,
        membershipId: member.id,
        userId,
        roleId: 'viewer',
        email: `${userId}@example.test`,
      };
      const feature = createSignCommentsFeature(db);
      const draft = {
        idempotencyKey: randomUUID(),
        body: 'Please move this sign.',
        parentId: null,
        mentions: [],
        attachmentIds: [],
      };
      const root = await feature.submit(p, siteId, sign.id, draft);
      expect((await feature.submit(p, siteId, sign.id, draft)).id).toBe(
        root.id,
      );
      const reply = await feature.submit(p, siteId, sign.id, {
        ...draft,
        idempotencyKey: randomUUID(),
        body: 'Got it!',
        parentId: root.id,
      });
      const nested = await feature.submit(p, siteId, sign.id, {
        ...draft,
        idempotencyKey: randomUUID(),
        body: 'Thanks',
        parentId: reply.id,
      });
      expect(nested.parentId).toBe(root.id);
      expect(
        (await feature.list(p, siteId, sign.id)).comments.map((row) => row.id),
      ).toEqual([root.id]);
      expect(
        (await feature.list(p, siteId, sign.id, root.id)).comments.map(
          (row) => row.id,
        ),
      ).toEqual([reply.id, nested.id]);
      await expect(
        feature.list({ ...p, tenantId: randomUUID() }, siteId, sign.id),
      ).rejects.toThrow();
      // REQ-009,010: eligible mentions and desired-state reactions survive retries.
      const people = await feature.people(p, siteId, sign.id, '');
      expect(people.people.some((person) => person.id === member.id)).toBe(
        true,
      );
      await feature.react(p, siteId, sign.id, root.id, {
        emoji: '👍',
        selected: true,
      });
      await feature.react(p, siteId, sign.id, root.id, {
        emoji: '👍',
        selected: true,
      });
      expect(
        (await feature.list(p, siteId, sign.id)).comments[0]?.reactions,
      ).toEqual([{ emoji: '👍', count: 1, selected: true }]);
      await feature.react(p, siteId, sign.id, root.id, {
        emoji: '👍',
        selected: false,
      });
      expect(
        (await feature.list(p, siteId, sign.id)).comments[0]?.reactions,
      ).toEqual([]);
      await expect(
        feature.submit(p, siteId, sign.id, {
          ...draft,
          idempotencyKey: randomUUID(),
          body: '@Fake',
          mentions: [
            { membershipId: randomUUID(), name: 'Fake', start: 0, end: 5 },
          ],
        }),
      ).rejects.toThrow();
    } finally {
      await db.site.deleteMany({ where: { id: siteId } });
      await db.user.deleteMany({ where: { id: userId } });
      await db.$disconnect();
    }
  },
);
