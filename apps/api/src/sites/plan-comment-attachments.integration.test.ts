import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import sharp from 'sharp';
import { createPlanCommentsFeature } from './plan-comments.js';
import { createPlanCommentAttachments } from './plan-comment-attachments.js';
it.skipIf(process.env.PLAN_COMMENTS_INTEGRATION !== 'true')(
  'allocation-plan-comments REQ-007,008,012: draft files stay private and bind only to their author and plan',
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
      const sign = await db.allocationPlan.create({
        data: {
          tenantId: owner.tenantId,
          siteId,
          uploadedById: userId,
          name: 'Attachment plan',
          objectKey: `generated/${siteId}`,
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
      const attachments = createPlanCommentAttachments(db, objects);
      const comments = createPlanCommentsFeature(db);
      const intent = await attachments.initiate(p, siteId, sign.id, null, {
        idempotencyKey: randomUUID(),
        filename: 'test.pdf',
        mediaType: 'application/pdf',
        byteSize: bytes.length,
        checksumSha256: createHash('sha256').update(bytes).digest('base64'),
      });
      ids.push(intent.id);
      await attachments.complete(p, siteId, sign.id, null, intent.id);
      await expect(
        attachments.download(admin, siteId, sign.id, null, intent.id),
      ).rejects.toThrow();
      const draft = {
        idempotencyKey: randomUUID(),
        body: '',
        threadId: null,
        x: 0.5,
        y: 0.5,
        mentions: [],
        attachmentIds: [intent.id],
      };
      await expect(
        comments.submit(admin, siteId, sign.id, null, draft),
      ).rejects.toThrow();
      const row = await comments.submit(p, siteId, sign.id, null, draft);
      expect(row.comment.attachments[0]?.id).toBe(intent.id);
      expect(
        (await attachments.download(admin, siteId, sign.id, null, intent.id))
          .bytes,
      ).toEqual(bytes);
      await expect(
        attachments.discard(p, siteId, sign.id, null, intent.id),
      ).rejects.toThrow();
      // REQ-007: validate bytes, expired drafts and replay before publishing.
      const createUpload = async (
        content: Uint8Array,
        mediaType:
          'image/png' | 'image/jpeg' | 'application/pdf' = 'application/pdf',
      ) => {
        const input = {
          idempotencyKey: randomUUID(),
          filename: mediaType === 'application/pdf' ? 'file.pdf' : 'image.png',
          mediaType,
          byteSize: content.length,
          checksumSha256: createHash('sha256').update(content).digest('base64'),
        };
        const upload = await attachments.initiate(
          p,
          siteId,
          sign.id,
          null,
          input,
        );
        ids.push(upload.id);
        stored.set(`quarantine/plan-comments/${upload.id}`, content);
        return { upload, input };
      };
      const pending = await createUpload(bytes);
      expect(
        (await attachments.initiate(p, siteId, sign.id, null, pending.input))
          .id,
      ).toBe(pending.upload.id);
      await expect(
        attachments.initiate(p, siteId, sign.id, null, {
          ...pending.input,
          filename: 'different.pdf',
        }),
      ).rejects.toThrow();
      await expect(
        attachments.download(p, siteId, sign.id, null, pending.upload.id),
      ).rejects.toThrow();
      await expect(
        attachments.discard(admin, siteId, sign.id, null, pending.upload.id),
      ).rejects.toThrow();
      await expect(
        attachments.complete(admin, siteId, sign.id, null, pending.upload.id),
      ).rejects.toThrow();
      stored.set(
        `quarantine/plan-comments/${pending.upload.id}`,
        new Uint8Array(),
      );
      await expect(
        attachments.complete(p, siteId, sign.id, null, pending.upload.id),
      ).rejects.toThrow('invalid_attachment');
      stored.set(`quarantine/plan-comments/${pending.upload.id}`, bytes);
      await attachments.complete(p, siteId, sign.id, null, pending.upload.id);
      await attachments.complete(p, siteId, sign.id, null, pending.upload.id);
      expect(
        (await attachments.initiate(p, siteId, sign.id, null, pending.input))
          .completed,
      ).toBe(true);
      await expect(
        attachments.thumbnail(p, siteId, sign.id, null, pending.upload.id),
      ).rejects.toThrow();
      stored.set(`plan-comments/${pending.upload.id}`, new Uint8Array());
      await expect(
        attachments.download(p, siteId, sign.id, null, pending.upload.id),
      ).rejects.toThrow('invalid_attachment');
      await attachments.discard(p, siteId, sign.id, null, pending.upload.id);
      await attachments.discard(p, siteId, sign.id, null, pending.upload.id);
      const expired = await createUpload(bytes);
      await db.allocationPlanCommentAttachment.update({
        where: { id: expired.upload.id },
        data: { expiresAt: new Date(0) },
      });
      await expect(
        attachments.complete(p, siteId, sign.id, null, expired.upload.id),
      ).rejects.toThrow('attachment_expired');
      await expect(
        attachments.initiate(p, siteId, sign.id, null, expired.input),
      ).rejects.toThrow('attachment_expired');
      const image = await createUpload(
        await sharp({
          create: { width: 2, height: 2, channels: 3, background: 'blue' },
        })
          .png()
          .toBuffer(),
        'image/png',
      );
      await attachments.complete(p, siteId, sign.id, null, image.upload.id);
      expect(
        (await attachments.thumbnail(p, siteId, sign.id, null, image.upload.id))
          .bytes.length,
      ).toBeGreaterThan(0);
      const invalidImage = await createUpload(
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        'image/png',
      );
      await expect(
        attachments.complete(p, siteId, sign.id, null, invalidImage.upload.id),
      ).rejects.toThrow('invalid_image');
      await db.allocationPlanCommentAttachmentObject.updateMany({
        where: { attachmentId: { in: ids } },
        data: { expiresAt: new Date(0) },
      });
      await attachments.cleanup();
      expect(
        await db.allocationPlanCommentAttachment.count({
          where: { id: intent.id },
        }),
      ).toBe(1);
      expect(
        await db.allocationPlanCommentAttachment.count({
          where: { id: expired.upload.id },
        }),
      ).toBe(0);
      await db.allocationPlan.delete({ where: { id: sign.id } });
      await expect(
        attachments.download(p, siteId, sign.id, null, intent.id),
      ).rejects.toThrow();
      await db.allocationPlanCommentAttachmentObject.updateMany({
        where: { attachmentId: { in: ids } },
        data: { expiresAt: new Date(0) },
      });
      await attachments.cleanup();
      expect(stored.size).toBe(0);
    } finally {
      await db.site.deleteMany({ where: { id: siteId } });
      await db.allocationPlanCommentAttachmentObject.deleteMany({
        where: { attachmentId: { in: ids } },
      });
      await db.user.deleteMany({ where: { id: userId } });
      await db.$disconnect();
    }
  },
);
