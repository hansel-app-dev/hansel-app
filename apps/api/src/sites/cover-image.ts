/** @spec site-cover-image-add REQ-008..REQ-014, REQ-018 */
import { createHash, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import express from 'express';
import { z } from 'zod';
import { startCoverImageRequestSchema } from '@hansel/contracts';
import { siteAccessWhere } from './prisma-sites-store.js';

export async function sanitizeCoverImage(
  bytes: Buffer,
  mediaType: string,
): Promise<Buffer> {
  if (!bytes.length || bytes.length > 3_000_000)
    throw new Error('invalid_image');
  const pngEnd = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
  if (
    (mediaType === 'image/png' && !bytes.subarray(-12).equals(pngEnd)) ||
    (mediaType === 'image/jpeg' &&
      !bytes.subarray(-2).equals(Buffer.from([255, 217])))
  ) {
    throw new Error('invalid_image');
  }
  const image = sharp(bytes, {
    failOn: 'warning',
    limitInputPixels: 40_000_000,
  });
  const metadata = await image.metadata();
  const format = mediaType === 'image/png' ? 'png' : 'jpeg';
  if (metadata.format !== format || (metadata.pages ?? 1) !== 1)
    throw new Error('invalid_image');
  // Reject trailing payload above; re-encoding drops EXIF, XMP and ICC.
  const clean = await image.rotate().toFormat(format).toBuffer();
  if (clean.length > 3_000_000) throw new Error('invalid_image');
  return clean;
}

export function createCoverImageRoutes(options: {
  prisma: PrismaClient;
  bucketName: string | null;
  enabled: boolean;
  allowedOrigin: string;
  digest: (credential: string) => string;
  s3?: S3Client;
  recordEvent?: (name: string) => void;
}) {
  const { prisma } = options;
  const bucketName = options.bucketName ?? '';
  const s3 = options.s3 ?? new S3Client({});
  const router = express.Router();
  const authenticate = async (request: express.Request) => {
    const cookie = request.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith('hansel_access='))
      ?.slice('hansel_access='.length);
    if (!cookie) return null;
    const session = await prisma.applicationSessionCredential.findUnique({
      where: { credentialDigest: options.digest(cookie) },
      include: { family: true },
    });
    const now = new Date();
    if (
      session?.kind !== 'ACCESS' ||
      session.consumedAt ||
      session.expiresAt <= now ||
      session.family.revokedAt ||
      session.family.absoluteExpiresAt <= now
    )
      return null;
    const membership = await prisma.membership.findUnique({
      where: {
        userId_tenantId: {
          userId: session.family.userId,
          tenantId: session.family.tenantId,
        },
      },
    });
    return membership ? { membership, familyId: session.family.id } : null;
  };
  // @spec site-cover-image-display REQ-004, REQ-005
  router.get('/api/sites/:siteId/cover-image', async (request, response) => {
    response
      .set('Cache-Control', 'private, no-store')
      .set('X-Content-Type-Options', 'nosniff')
      .vary('Cookie');
    try {
      const actor = await authenticate(request);
      if (!actor) {
        response.status(401).json({ error: 'authentication_required' });
        return;
      }
      const siteId = z.uuid().safeParse(request.params.siteId);
      if (!siteId.success) {
        response.status(404).json({ error: 'site_not_found' });
        return;
      }
      const site = await prisma.site.findFirst({
        where: {
          id: siteId.data,
          tenantId: actor.membership.tenantId,
          ...siteAccessWhere({
            membershipId: actor.membership.id,
            roleId: actor.membership.roleId,
          }),
        },
        select: { id: true },
      });
      if (!site) {
        response.status(404).json({ error: 'site_not_found' });
        return;
      }
      const cover = await prisma.siteCoverImage.findFirst({
        where: {
          siteId: site.id,
          tenantId: actor.membership.tenantId,
          completedAt: { not: null },
        },
        select: { objectKey: true, mediaType: true },
      });
      if (!cover) {
        response.status(404).json({ error: 'site_not_found' });
        return;
      }
      if (!bucketName) throw new Error('storage_unavailable');
      const object = await s3.send(
        new GetObjectCommand({ Bucket: bucketName, Key: cover.objectKey }),
        { abortSignal: AbortSignal.timeout(15_000) },
      );
      if (
        !object.Body ||
        !object.ContentLength ||
        object.ContentLength > 3_000_000
      )
        throw new Error('invalid_stored_image');
      const bytes = await object.Body.transformToByteArray();
      if (
        bytes.length > 3_000_000 ||
        !['image/png', 'image/jpeg'].includes(cover.mediaType)
      )
        throw new Error('invalid_stored_image');
      response.type(cover.mediaType).send(Buffer.from(bytes));
    } catch (error) {
      const missing = error instanceof Error && error.name === 'NoSuchKey';
      if (!missing) options.recordEvent?.('cover_image_read_failed');
      response.status(missing ? 404 : 503).json({
        error: missing ? 'site_not_found' : 'cover_image_unavailable',
      });
    }
  });
  router.use(
    '/api/sites/:siteId/cover-image-uploads',
    (request, response, next) => {
      response
        .set('Cache-Control', 'private, no-store')
        .vary('Cookie')
        .vary('Origin');
      if (!options.bucketName) {
        response.status(503).json({ error: 'cover_image_unavailable' });
        return;
      }
      const localSameOrigin =
        request.header('sec-fetch-site') === 'same-origin' &&
        /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(
          options.allowedOrigin,
        );
      if (
        request.headers.origin !== options.allowedOrigin &&
        !(request.headers.origin === undefined && localSameOrigin)
      ) {
        response.status(403).json({ error: 'forbidden' });
        return;
      }
      next();
    },
  );
  router.post(
    '/api/sites/:siteId/cover-image-uploads',
    async (request, response) => {
      if (!options.enabled) {
        response.status(404).json({ error: 'not_found' });
        return;
      }
      const input = startCoverImageRequestSchema.safeParse(request.body);
      const siteId = z.uuid().safeParse(request.params.siteId);
      if (!input.success || !siteId.success) {
        response.status(400).json({ error: 'invalid_request' });
        return;
      }
      try {
        const actor = await authenticate(request);
        if (!actor) {
          response.status(401).json({ error: 'authentication_required' });
          return;
        }
        const site = await prisma.site.findFirst({
          where: {
            id: siteId.data,
            tenantId: actor.membership.tenantId,
            createdByMembershipId: actor.membership.id,
          },
        });
        if (!site) {
          response.status(404).json({ error: 'site_not_found' });
          return;
        }
        const previous = await prisma.siteCoverImage.findUnique({
          where: { siteId: site.id },
        });
        if (previous) {
          if (
            previous.sessionFamilyId !== actor.familyId ||
            previous.idempotencyKey !== input.data.idempotencyKey ||
            previous.checksum !== input.data.checksum ||
            previous.filename !== input.data.filename.normalize('NFC') ||
            previous.byteSize !== input.data.byteSize ||
            previous.mediaType !== input.data.mediaType ||
            (!previous.completedAt && previous.expiresAt <= new Date())
          ) {
            response.status(409).json({ error: 'cover_image_conflict' });
            return;
          }
          response.json({ uploadId: previous.id });
          return;
        }
        const id = randomUUID();
        await prisma.siteCoverImage.create({
          data: {
            ...input.data,
            filename: input.data.filename.normalize('NFC'),
            id,
            siteId: site.id,
            tenantId: actor.membership.tenantId,
            membershipId: actor.membership.id,
            sessionFamilyId: actor.familyId,
            objectKey: `covers/${id}`,
            expiresAt: new Date(Date.now() + 15 * 60_000),
          },
        });
        response.status(201).json({ uploadId: id });
      } catch {
        response.status(503).json({ error: 'cover_image_unavailable' });
      }
    },
  );
  router.post(
    '/api/sites/:siteId/cover-image-uploads/:uploadId/finalize',
    express.raw({ type: ['image/png', 'image/jpeg'], limit: 3_000_000 }),
    async (request, response) => {
      const siteId = z.uuid().safeParse(request.params.siteId);
      const uploadId = z.uuid().safeParse(request.params.uploadId);
      if (
        !siteId.success ||
        !uploadId.success ||
        !Buffer.isBuffer(request.body)
      ) {
        response.status(400).json({ error: 'invalid_request' });
        return;
      }
      try {
        const actor = await authenticate(request);
        if (!actor) {
          response.status(401).json({ error: 'authentication_required' });
          return;
        }
        const pending = await prisma.siteCoverImage.findFirst({
          where: {
            id: uploadId.data,
            siteId: siteId.data,
            tenantId: actor.membership.tenantId,
            membershipId: actor.membership.id,
            sessionFamilyId: actor.familyId,
            site: { createdByMembershipId: actor.membership.id },
          },
        });
        if (!pending) {
          response.status(404).json({ error: 'site_not_found' });
          return;
        }
        const bytes: Buffer = request.body;
        if (
          pending.byteSize !== bytes.length ||
          pending.mediaType !== request.header('content-type') ||
          pending.checksum !== createHash('sha256').update(bytes).digest('hex')
        ) {
          response.status(400).json({ error: 'invalid_image' });
          return;
        }
        if (pending.completedAt) {
          response.json({ destination: `/sites/${siteId.data}/activity` });
          return;
        }
        if (pending.expiresAt <= new Date()) {
          response.status(409).json({ error: 'cover_image_expired' });
          return;
        }
        let clean: Buffer;
        try {
          clean = await sanitizeCoverImage(bytes, pending.mediaType);
        } catch {
          response.status(400).json({ error: 'invalid_image' });
          return;
        }
        // Serialize retries with deletion and finalization; an aborted transaction leaves
        // the pending record available for retry or the cleanup worker.
        await prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "SiteCoverImage" WHERE "id" = ${pending.id}::uuid FOR UPDATE`;
            const current = await tx.siteCoverImage.findUnique({
              where: { id: pending.id },
            });
            if (!current || current.expiresAt <= new Date())
              throw new Error('expired');
            if (current.completedAt) return;
            await s3.send(
              new PutObjectCommand({
                Bucket: bucketName,
                Key: pending.objectKey,
                Body: clean,
                ContentType: pending.mediaType,
                ServerSideEncryption: 'AES256',
              }),
              { abortSignal: AbortSignal.timeout(20_000) },
            );
            await tx.siteCoverImage.update({
              where: { id: pending.id },
              data: { completedAt: new Date() },
            });
          },
          { timeout: 30_000 },
        );
        response.json({ destination: `/sites/${siteId.data}/activity` });
      } catch {
        response.status(503).json({ error: 'cover_image_unavailable' });
      }
    },
  );
  return {
    router,
    async cleanup() {
      await prisma.siteCoverImage.deleteMany({
        where: { completedAt: null, expiresAt: { lt: new Date() } },
      });
      for (const item of await prisma.coverImageDeletion.findMany({
        take: 100,
      })) {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: item.objectKey,
          }),
          { abortSignal: AbortSignal.timeout(20_000) },
        );
        await prisma.coverImageDeletion.delete({
          where: { objectKey: item.objectKey },
        });
      }
    },
  };
}
