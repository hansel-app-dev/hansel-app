import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, it } from 'vitest';
import { createSignDocumentsFeature } from './sign-documents.js';
import type { AllocationPlanObjectStore } from './allocation-plans.js';

it.skipIf(process.env.SIGN_DOCUMENTS_INTEGRATION !== 'true')(
  'sign-documents REQ-004..008: verified, scoped, idempotent downloads and deletion cleanup',
  async () => {
    const db = new PrismaClient();
    const siteId = randomUUID();
    const bytes = new TextEncoder().encode('%PDF-1.7\ntest');
    const checksumSha256 = createHash('sha256').update(bytes).digest('base64');
    const stored = new Map<string, Uint8Array>();
    const objects: AllocationPlanObjectStore = {
      signPut: ({ objectKey }) => {
        stored.set(objectKey, bytes);
        return Promise.resolve('https://upload.example.test');
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
      const feature = createSignDocumentsFeature(db, objects);
      const input = {
        idempotencyKey: randomUUID(),
        filename: 'test.pdf',
        mediaType: 'application/pdf' as const,
        byteSize: bytes.length,
        checksumSha256,
      };
      const intent = await feature.initiate(p, siteId, sign.id, input);
      expect((await feature.initiate(p, siteId, sign.id, input)).id).toBe(
        intent.id,
      );
      expect((await feature.list(p, siteId, sign.id)).documents).toHaveLength(
        0,
      );
      await expect(
        feature.initiate({ ...p, roleId: 'viewer' }, siteId, sign.id, input),
      ).rejects.toThrow();
      await expect(
        feature.list({ ...p, tenantId: randomUUID() }, siteId, sign.id),
      ).rejects.toThrow();
      await feature.complete(p, siteId, sign.id, intent.id);
      await feature.complete(p, siteId, sign.id, intent.id);
      expect((await feature.list(p, siteId, sign.id)).documents).toHaveLength(
        1,
      );
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
      await db.sign.delete({ where: { id: sign.id } });
      await expect(
        feature.download(p, siteId, sign.id, intent.id),
      ).rejects.toThrow();
      await db.signDocumentObject.updateMany({
        where: { documentId: { in: [intent.id, bad.id] } },
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
