import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, it } from 'vitest';
import { createSignDocumentsFeature } from './sign-documents.js';
import { createS3AllocationPlanObjectStore } from './s3-allocation-plan-object-store.js';

it.skipIf(process.env.SIGN_DOCUMENTS_LIVE !== 'true')(
  'sign-documents REQ-004..008: live private storage upload, verified download and cleanup',
  async () => {
    const bucketName = process.env.ALLOCATION_PLANS_BUCKET_NAME;
    if (!bucketName)
      throw new Error('Live document test requires configured private bucket');
    const db = new PrismaClient();
    const siteId = randomUUID();
    const objects = createS3AllocationPlanObjectStore({ bucketName });
    const feature = createSignDocumentsFeature(db, objects);
    let documentId: string | undefined;
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
      const bytes = Buffer.from(
        '%PDF-1.7\n% Hansel generated upload smoke test\n%%EOF',
      );
      const intent = await feature.initiate(p, siteId, sign.id, {
        idempotencyKey: randomUUID(),
        filename: 'hansel-generated-smoke-test.pdf',
        mediaType: 'application/pdf',
        byteSize: bytes.length,
        checksumSha256: createHash('sha256').update(bytes).digest('base64'),
      });
      documentId = intent.id;
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
      expect((await feature.list(p, siteId, sign.id)).documents).toHaveLength(
        1,
      );
    } finally {
      // These IDs and object keys belong only to this generated test fixture.
      await db.site.deleteMany({ where: { id: siteId } });
      if (documentId) {
        await objects.remove(`quarantine/sign-documents/${documentId}`);
        await objects.remove(`sign-documents/${documentId}`);
        await db.signDocumentObject.deleteMany({ where: { documentId } });
      }
      await db.$disconnect();
    }
  },
  60_000,
);
