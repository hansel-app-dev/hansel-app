import sharp from 'sharp';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, it } from 'vitest';
import { createSignPhotosFeature } from './sign-photos.js';
import { createS3AllocationPlanObjectStore } from './s3-allocation-plan-object-store.js';

it.skipIf(process.env.SIGN_PHOTOS_LIVE !== 'true')(
  'sign-photos REQ-004..008: live private storage upload, verified download and cleanup',
  async () => {
    const bucketName = process.env.ALLOCATION_PLANS_BUCKET_NAME;
    if (!bucketName)
      throw new Error('Live document test requires configured private bucket');
    const db = new PrismaClient();
    const siteId = randomUUID();
    const objects = createS3AllocationPlanObjectStore({ bucketName });
    const feature = createSignPhotosFeature(db, objects);
    let photoId: string | undefined;
    try {
      const member = await db.membership.findFirstOrThrow({
        where: { roleId: 'owner' },
      });
      const p = {
        tenantId: member.tenantId,
        membershipId: member.id,
        userId: member.userId,
        roleId: 'owner',
        email: 'test@example.test',
      };
      await db.site.create({
        data: {
          id: siteId,
          tenantId: p.tenantId,
          createdByMembershipId: p.membershipId,
          name: 'Temporary Docs smoke test',
          accessScope: 'PRIVATE',
        },
      });
      const group = await db.signType.create({
        data: {
          tenantId: p.tenantId,
          siteId,
          name: 'Test',
          normalizedName: 'test',
          color: 'RED',
        },
      });
      const sign = await db.sign.create({
        data: {
          tenantId: p.tenantId,
          siteId,
          signTypeId: group.id,
          code: 'TEST.001',
          normalizedCode: 'test.001',
        },
      });
      const bytes = await sharp({
        create: { width: 32, height: 20, channels: 3, background: '#e2b65b' },
      })
        .png()
        .toBuffer();
      const intent = await feature.initiate(p, siteId, sign.id, {
        idempotencyKey: randomUUID(),
        filename: 'hansel-generated-smoke-test.png',
        mediaType: 'image/png',
        byteSize: bytes.length,
        checksumSha256: createHash('sha256').update(bytes).digest('base64'),
      });
      photoId = intent.id;
      if (!intent.uploadUrl) throw new Error('Expected upload URL');
      const put = await fetch(intent.uploadUrl, {
        method: 'PUT',
        headers: intent.headers,
        body: bytes,
        signal: AbortSignal.timeout(30_000),
      });
      expect(put.status).toBe(200);
      await feature.complete(p, siteId, sign.id, intent.id);
      expect(
        Buffer.from(
          (await feature.download(p, siteId, sign.id, intent.id)).bytes,
        ),
      ).toEqual(bytes);
      expect(
        (await feature.thumbnail(p, siteId, sign.id, intent.id)).bytes.length,
      ).toBeGreaterThan(0);
      expect((await feature.list(p, siteId, sign.id)).photos).toHaveLength(1);
      await feature.remove(p, siteId, sign.id, intent.id);
      expect(await db.sign.count({ where: { id: sign.id } })).toBe(1);
      await expect(
        feature.download(p, siteId, sign.id, intent.id),
      ).rejects.toThrow();
    } finally {
      // These IDs and object keys belong only to this generated test fixture.
      await db.site.deleteMany({ where: { id: siteId } });
      if (photoId) {
        await objects.remove(`quarantine/sign-photos/${photoId}`);
        await objects.remove(`sign-photos/${photoId}`);
        await objects.remove(`sign-photos/${photoId}/thumbnail.png`);
        await db.signPhotoObject.deleteMany({ where: { photoId } });
      }
      await db.$disconnect();
    }
  },
  60_000,
);
