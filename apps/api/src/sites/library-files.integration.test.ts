/** @spec library-files REQ-001..012 */
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { expect, it, vi } from 'vitest';
import {
  createLibraryFilesFeature,
  registerLibraryFile,
} from './library-files.js';
import { createSignDocumentsFeature } from './sign-documents.js';
import { createSignPhotosFeature } from './sign-photos.js';
import { backfillLibraryFiles } from './library-backfill.js';
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing fixture result');
  return value;
}
it.skipIf(process.env.LIBRARY_FILES_INTEGRATION !== 'true')(
  'library-files preserves bytes through reuse/unlink, enforces Site access and backfills idempotently [AC-001..007]',
  async () => {
    const db = new PrismaClient(),
      tenantId = randomUUID(),
      userId = randomUUID(),
      editorId = randomUUID(),
      sourceId = randomUUID(),
      targetId = randomUUID(),
      sourceSign = randomUUID(),
      targetSign = randomUUID(),
      docsId = randomUUID(),
      photoId = randomUUID();
    const data = new Map<string, Uint8Array>(),
      pdf = Buffer.from('%PDF-fixture'),
      image = await sharp({
        create: { width: 2, height: 2, channels: 3, background: '#fff' },
      })
        .png()
        .toBuffer();
    const objects = {
      read: vi.fn((key: string) => {
        const bytes = data.get(key);
        return bytes
          ? Promise.resolve(bytes)
          : Promise.reject(new Error('NoSuchKey'));
      }),
      write: vi.fn((key: string, bytes: Uint8Array) => {
        data.set(key, bytes);
        return Promise.resolve();
      }),
      promote: vi.fn((from: string, to: string) => {
        data.set(to, required(data.get(from)));
        return Promise.resolve();
      }),
      remove: vi.fn((key: string) => {
        data.delete(key);
        return Promise.resolve();
      }),
      signPut: vi.fn().mockResolvedValue('https://example.test/upload'),
      inspect: vi.fn(),
    };
    const p = {
      tenantId,
      userId,
      membershipId: randomUUID(),
      roleId: 'owner',
      email: 'owner@example.test',
    };
    const editor = {
      tenantId,
      userId: editorId,
      membershipId: randomUUID(),
      roleId: 'editor',
      email: 'editor@example.test',
    };
    try {
      await db.user.createMany({
        data: [
          { id: userId, email: `${userId}@example.test` },
          { id: editorId, email: `${editorId}@example.test` },
        ],
      });
      await db.tenant.create({
        data: {
          id: tenantId,
          name: 'Library integration',
          country: 'AU',
          industry: 'Education',
          placeService: 'School',
          organizationSize: 'Small',
        },
      });
      await db.membership.createMany({
        data: [
          { id: p.membershipId, tenantId, userId, roleId: 'owner' },
          {
            id: editor.membershipId,
            tenantId,
            userId: editorId,
            roleId: 'editor',
          },
        ],
      });
      await db.site.createMany({
        data: [
          {
            id: sourceId,
            tenantId,
            createdByMembershipId: p.membershipId,
            name: 'Source',
            accessScope: 'PRIVATE',
          },
          {
            id: targetId,
            tenantId,
            createdByMembershipId: p.membershipId,
            name: 'Target',
            accessScope: 'PRIVATE',
          },
        ],
      });
      const type = await db.signType.create({
          data: {
            tenantId,
            siteId: sourceId,
            name: 'Source',
            normalizedName: 'source',
            color: 'SLATE',
          },
        }),
        targetType = await db.signType.create({
          data: {
            tenantId,
            siteId: targetId,
            name: 'Target',
            normalizedName: 'target',
            color: 'SLATE',
          },
        });
      await db.sign.createMany({
        data: [
          {
            id: sourceSign,
            tenantId,
            siteId: sourceId,
            signTypeId: type.id,
            code: 'SOURCE',
            normalizedCode: 'source',
          },
          {
            id: targetSign,
            tenantId,
            siteId: targetId,
            signTypeId: targetType.id,
            code: 'TARGET',
            normalizedCode: 'target',
          },
        ],
      });
      const documents = createSignDocumentsFeature(
          db,
          objects,
          registerLibraryFile,
        ),
        photos = createSignPhotosFeature(db, objects, registerLibraryFile),
        library = createLibraryFilesFeature(db, objects, true);
      const intent = await documents.initiate(p, sourceId, sourceSign, {
        filename: 'floor.pdf',
        mediaType: 'application/pdf',
        byteSize: pdf.length,
        checksumSha256: createHash('sha256').update(pdf).digest('base64'),
        idempotencyKey: docsId,
      });
      data.set(`quarantine/sign-documents/${intent.id}`, pdf);
      await documents.complete(p, sourceId, sourceSign, intent.id);
      await documents.complete(p, sourceId, sourceSign, intent.id);
      const photo = await photos.initiate(p, sourceId, sourceSign, {
        filename: 'photo.png',
        mediaType: 'image/png',
        byteSize: image.length,
        checksumSha256: createHash('sha256').update(image).digest('base64'),
        idempotencyKey: photoId,
      });
      data.set(`quarantine/sign-photos/${photo.id}`, image);
      await photos.complete(p, sourceId, sourceSign, photo.id);
      expect(await db.libraryFile.count({ where: { tenantId } })).toBe(2);
      expect(
        (await library.list(editor, { q: '', kind: 'all' })).files,
      ).toEqual([]);
      const files = (await library.list(p, { q: '', kind: 'all' })).files,
        doc = required(
          files.find((file) => file.mediaType === 'application/pdf'),
        ),
        pic = required(files.find((file) => file.mediaType === 'image/png'));
      await expect(library.download(editor, doc.id)).rejects.toThrow();
      await expect(
        library.link(editor, targetId, targetSign, 'documents', {
          fileIds: [doc.id],
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow();
      await db.siteGrant.createMany({
        data: [
          {
            tenantId,
            siteId: sourceId,
            membershipId: editor.membershipId,
            role: 'EDITOR',
          },
          {
            tenantId,
            siteId: targetId,
            membershipId: editor.membershipId,
            role: 'EDITOR',
          },
        ],
      });
      const selection = { fileIds: [doc.id], idempotencyKey: randomUUID() },
        [linked, replayed] = await Promise.all([
          library.link(editor, targetId, targetSign, 'documents', selection),
          library.link(editor, targetId, targetSign, 'documents', selection),
        ]);
      expect(linked.items[0]?.id).toBe(replayed.items[0]?.id);
      expect(
        await db.signDocument.count({ where: { signId: targetSign } }),
      ).toBe(1);
      expect(
        (
          await documents.download(
            editor,
            targetId,
            targetSign,
            required(linked.items[0]).id,
          )
        ).bytes,
      ).toEqual(pdf);
      await expect(
        library.link(editor, targetId, targetSign, 'photos', {
          fileIds: [doc.id],
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow();
      const photoLink = await library.link(
        editor,
        targetId,
        targetSign,
        'photos',
        { fileIds: [pic.id], idempotencyKey: randomUUID() },
      );
      await photos.remove(
        editor,
        targetId,
        targetSign,
        required(photoLink.items[0]).id,
      );
      expect((await library.download(editor, pic.id)).bytes).toEqual(image);
      const planInput = {
          fileId: doc.id,
          name: 'Independent plan',
          idempotencyKey: randomUUID(),
        },
        [plan, replay] = await Promise.all([
          library.createPlan(p, targetId, planInput),
          library.createPlan(p, targetId, planInput),
        ]);
      expect(plan.plan.id).toBe(replay.plan.id);
      expect(plan.plan.files).toHaveLength(1);
      expect(
        await db.signPlacement.count({ where: { planId: plan.plan.id } }),
      ).toBe(0);
      await db.sign.delete({ where: { id: sourceSign } });
      await db.signDocumentObject.updateMany({
        where: { documentId: intent.id },
        data: { expiresAt: new Date(0) },
      });
      await db.signPhotoObject.updateMany({
        where: { photoId: photo.id },
        data: { expiresAt: new Date(0) },
      });
      await documents.cleanup();
      await photos.cleanup();
      expect((await library.download(p, doc.id)).bytes).toEqual(pdf);
      expect(
        (
          await documents.download(
            editor,
            targetId,
            targetSign,
            required(linked.items[0]).id,
          )
        ).bytes,
      ).toEqual(pdf);
      await db.siteGrant.deleteMany({
        where: { siteId: sourceId, membershipId: editor.membershipId },
      });
      await expect(library.download(editor, doc.id)).rejects.toThrow();
      expect(
        (
          await documents.download(
            editor,
            targetId,
            targetSign,
            required(linked.items[0]).id,
          )
        ).bytes,
      ).toEqual(pdf);
      await expect(
        library.download({ ...p, tenantId: randomUUID() }, doc.id),
      ).rejects.toThrow();
      const legacy = await db.signDocument.create({
        data: {
          tenantId,
          siteId: targetId,
          signId: targetSign,
          uploadedById: userId,
          requestKey: randomUUID(),
          digest: 'legacy',
          filename: 'legacy.pdf',
          mediaType: 'application/pdf',
          byteSize: pdf.length,
          checksumSha256: createHash('sha256').update(pdf).digest('base64'),
          completed: true,
          expiresAt: new Date(),
        },
      });
      data.set(`sign-documents/${legacy.id}`, pdf);
      const report = vi.fn().mockResolvedValue(undefined);
      await backfillLibraryFiles(db, objects, report);
      await backfillLibraryFiles(db, objects, report);
      expect(await db.libraryFile.count({ where: { tenantId } })).toBe(3);
    } finally {
      const docs = await db.signDocument.findMany({
          where: { tenantId },
          select: { id: true },
        }),
        pics = await db.signPhoto.findMany({
          where: { tenantId },
          select: { id: true },
        });
      await db.signDocumentObject.deleteMany({
        where: { documentId: { in: docs.map((row) => row.id) } },
      });
      await db.signPhotoObject.deleteMany({
        where: { photoId: { in: pics.map((row) => row.id) } },
      });
      await db.sign.deleteMany({ where: { tenantId } });
      await db.signType.deleteMany({ where: { tenantId } });
      await db.allocationPlanUpload.deleteMany({ where: { tenantId } });
      await db.allocationPlan.deleteMany({ where: { tenantId } });
      await db.allocationPlanUploadBatch.deleteMany({ where: { tenantId } });
      await db.libraryFile.deleteMany({ where: { tenantId } });
      await db.libraryRequest.deleteMany({ where: { tenantId } });
      await db.site.deleteMany({ where: { tenantId } });
      await db.membership.deleteMany({ where: { tenantId } });
      await db.tenant.deleteMany({ where: { id: tenantId } });
      await db.user.deleteMany({ where: { id: { in: [userId, editorId] } } });
      await db.$disconnect();
    }
  },
  30_000,
);
