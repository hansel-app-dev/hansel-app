import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createSignCommentsFeature } from './sign-comments.js';
import { createSignCommentAttachments } from './sign-comment-attachments.js';
it.skipIf(process.env.SIGN_COMMENTS_INTEGRATION !== 'true')(
  'sign-comments REQ-007,008,012: draft files stay private and bind only to their author and Sign',
  async () => {
    const db = new PrismaClient();
    const siteId = randomUUID();
    const userId = randomUUID();
    const stored = new Map<string, Uint8Array>();
    const ids: string[] = [];
    const bytes = new TextEncoder().encode('%PDF-1.7 generated test');
    const objects = {
      signPut: ({ objectKey }: { objectKey: string }) => {
        stored.set(objectKey, bytes);
        return Promise.resolve('https://example.test/upload');
      },
      inspect: () => Promise.resolve(null),
      read: (key: string) =>
        Promise.resolve(stored.get(key) ?? new Uint8Array()),
      write: (key: string, value: Uint8Array) => {
        stored.set(key, value);
        return Promise.resolve();
      },
      remove: (key: string) => {
        stored.delete(key);
        return Promise.resolve();
      },
      promote: (source: string, dest: string) => {
        stored.set(dest, stored.get(source) ?? new Uint8Array());
        return Promise.resolve();
      },
    };
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
          name: 'Generated attachment test',
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
      const admin = {
        ...p,
        membershipId: owner.id,
        userId: owner.userId,
        roleId: 'owner',
      };
      const attachments = createSignCommentAttachments(db, objects);
      const comments = createSignCommentsFeature(db);
      const intent = await attachments.initiate(p, siteId, sign.id, {
        idempotencyKey: randomUUID(),
        filename: 'test.pdf',
        mediaType: 'application/pdf',
        byteSize: bytes.length,
        checksumSha256: createHash('sha256').update(bytes).digest('base64'),
      });
      ids.push(intent.id);
      await attachments.complete(p, siteId, sign.id, intent.id);
      await expect(
        attachments.download(admin, siteId, sign.id, intent.id),
      ).rejects.toThrow();
      const draft = {
        idempotencyKey: randomUUID(),
        body: '',
        parentId: null,
        mentions: [],
        attachmentIds: [intent.id],
      };
      await expect(
        comments.submit(admin, siteId, sign.id, draft),
      ).rejects.toThrow();
      const row = await comments.submit(p, siteId, sign.id, draft);
      expect(row.attachments[0]?.id).toBe(intent.id);
      expect(
        (await attachments.download(admin, siteId, sign.id, intent.id)).bytes,
      ).toEqual(bytes);
      await expect(
        attachments.discard(p, siteId, sign.id, intent.id),
      ).rejects.toThrow();
      await db.sign.delete({ where: { id: sign.id } });
      await expect(
        attachments.download(p, siteId, sign.id, intent.id),
      ).rejects.toThrow();
      await db.signCommentAttachmentObject.updateMany({
        where: { attachmentId: { in: ids } },
        data: { expiresAt: new Date(0) },
      });
      await attachments.cleanup();
      expect(stored.size).toBe(0);
    } finally {
      await db.site.deleteMany({ where: { id: siteId } });
      await db.signCommentAttachmentObject.deleteMany({
        where: { attachmentId: { in: ids } },
      });
      await db.user.deleteMany({ where: { id: userId } });
      await db.$disconnect();
    }
  },
);
