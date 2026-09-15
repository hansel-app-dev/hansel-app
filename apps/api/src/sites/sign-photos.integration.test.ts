import sharp from 'sharp';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, it } from 'vitest';
import { createSignPhotosFeature } from './sign-photos.js';
import type { AllocationPlanObjectStore } from './allocation-plans.js';

it.skipIf(process.env.SIGN_PHOTOS_INTEGRATION !== 'true')(
  'sign-photos REQ-004..008: verified, scoped, idempotent downloads and deletion cleanup',
  async () => {
    const db = new PrismaClient();
    const siteId = randomUUID();
    const bytes = await sharp({
      create: { width: 16, height: 16, channels: 3, background: '#efae3d' },
    })
      .png()
      .toBuffer();
    const checksumSha256 = createHash('sha256').update(bytes).digest('base64');
    const stored = new Map<string, Uint8Array>();
    const objects: AllocationPlanObjectStore & {
      write: (key: string, bytes: Uint8Array) => Promise<void>;
    } = {
      signPut: ({ objectKey }) => {
        stored.set(objectKey, bytes);
        return Promise.resolve('https://upload.example.test');
      },
      write: (key: string, bytes: Uint8Array) => {
        stored.set(key, bytes);
        return Promise.resolve();
      },
      inspect: () => Promise.resolve(null),
      read: (key) => {
        const value = stored.get(key);
        return value
          ? Promise.resolve(value)
          : Promise.reject(new Error('missing'));
      },
      remove: (key) => {
        stored.delete(key);
        return Promise.resolve();
      },
      promote: (source, destination) => {
        const value = stored.get(source);
        if (value) stored.set(destination, value);
        return Promise.resolve();
      },
    };
    try {
      const m = await db.membership.findFirstOrThrow({
        where: { roleId: 'owner' },
      });
      const p = {
        tenantId: m.tenantId,
        membershipId: m.id,
        userId: m.userId,
        roleId: 'owner',
        email: 'test@example.test',
      };
      await db.site.create({
        data: {
          id: siteId,
          tenantId: m.tenantId,
          createdByMembershipId: m.id,
          name: 'Docs test',
          accessScope: 'PRIVATE',
        },
      });
      const group = await db.signType.create({
        data: {
          tenantId: m.tenantId,
          siteId,
          name: 'test',
          normalizedName: 'test',
          color: 'RED',
        },
      });
      const sign = await db.sign.create({
        data: {
          tenantId: m.tenantId,
          siteId,
          signTypeId: group.id,
          code: 'SG.1',
          normalizedCode: 'sg.1',
        },
      });
      const feature = createSignPhotosFeature(db, objects);
      const input = {
        idempotencyKey: randomUUID(),
        filename: 'test.png',
        mediaType: 'image/png' as const,
        byteSize: bytes.length,
        checksumSha256,
      };
      const intent = await feature.initiate(p, siteId, sign.id, input);
      expect((await feature.initiate(p, siteId, sign.id, input)).id).toBe(
        intent.id,
      );
      expect((await feature.list(p, siteId, sign.id)).photos).toHaveLength(0);
      await expect(
        feature.initiate({ ...p, roleId: 'viewer' }, siteId, sign.id, input),
      ).rejects.toThrow();
      await expect(
        feature.list({ ...p, tenantId: randomUUID() }, siteId, sign.id),
      ).rejects.toThrow();
      await feature.complete(p, siteId, sign.id, intent.id);
      await feature.complete(p, siteId, sign.id, intent.id);
      await expect(
        feature.remove({ ...p, roleId: 'viewer' }, siteId, sign.id, intent.id),
      ).rejects.toThrow();
      await expect(
        feature.thumbnail(
          { ...p, tenantId: randomUUID() },
          siteId,
          sign.id,
          intent.id,
        ),
      ).rejects.toThrow();
      const other = await db.sign.create({
        data: {
          tenantId: p.tenantId,
          siteId,
          signTypeId: group.id,
          code: 'SG.2',
          normalizedCode: 'sg.2',
        },
      });
      expect((await feature.list(p, siteId, other.id)).photos).toHaveLength(0);
      await expect(
        feature.download(p, siteId, other.id, intent.id),
      ).rejects.toThrow();
      await feature.remove(p, siteId, other.id, intent.id);
      expect((await feature.list(p, siteId, sign.id)).photos).toHaveLength(1);
      expect(
        (await feature.download(p, siteId, sign.id, intent.id)).bytes,
      ).toEqual(bytes);
      const bad = await feature.initiate(p, siteId, sign.id, {
        ...input,
        idempotencyKey: randomUUID(),
        checksumSha256: 'A'.repeat(43) + '=',
      });
      await expect(
        feature.complete(p, siteId, sign.id, bad.id),
      ).rejects.toThrow();
      expect(
        (await feature.thumbnail(p, siteId, sign.id, intent.id)).bytes.length,
      ).toBeGreaterThan(0);
      await feature.remove(p, siteId, sign.id, intent.id);
      await feature.remove(p, siteId, sign.id, intent.id);
      expect(await db.sign.count({ where: { id: sign.id } })).toBe(1);
      const pending = await feature.initiate(p, siteId, sign.id, {
        ...input,
        idempotencyKey: randomUUID(),
      });
      await db.sign.delete({ where: { id: sign.id } });
      await expect(
        feature.complete(p, siteId, sign.id, pending.id),
      ).rejects.toThrow();
      await expect(
        feature.download(p, siteId, sign.id, intent.id),
      ).rejects.toThrow();
      await db.signPhotoObject.updateMany({
        where: { photoId: { in: [intent.id, bad.id, pending.id] } },
        data: { expiresAt: new Date(0) },
      });
      await feature.cleanup();
      expect(stored.size).toBe(0);
    } finally {
      await db.site.deleteMany({ where: { id: siteId } });
      await db.$disconnect();
    }
  },
);
