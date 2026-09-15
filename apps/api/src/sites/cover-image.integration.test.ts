import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import express from 'express';
import request from 'supertest';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import { createCoverImageRoutes } from './cover-image.js';
import { loadConfig } from '../config.js';
import { createOnboardingSecurity } from '../onboarding/security.js';
import { startCoverImageResponseSchema } from '@hansel/contracts';
import { chromium } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

it.skipIf(process.env.COVER_IMAGE_INTEGRATION !== 'true')(
  'persists a real cover, retries idempotently, rejects unauthenticated upload, and cleans up',
  async () => {
    const prisma = new PrismaClient();
    const s3 = new S3Client({});
    const bucketName = process.env.ALLOCATION_PLANS_BUCKET_NAME;
    if (!bucketName) throw new Error('Integration storage bucket is required');
    const siteId = randomUUID();
    const familyId = randomUUID();
    const credential = randomUUID();
    const security = createOnboardingSecurity(loadConfig());
    let objectKey: string | undefined;
    try {
      const member = await prisma.membership.findFirstOrThrow({
        where: {
          roleId: 'owner',
          user: {
            personalProfile: { isNot: null },
            planSelection: { isNot: null },
          },
        },
      });
      await prisma.site.create({
        data: {
          id: siteId,
          tenantId: member.tenantId,
          createdByMembershipId: member.id,
          name: 'Cover upload integration fixture',
          accessScope: 'PRIVATE',
        },
      });
      await prisma.applicationSessionFamily.create({
        data: {
          id: familyId,
          tenantId: member.tenantId,
          userId: member.userId,
          absoluteExpiresAt: new Date(Date.now() + 60_000),
          credentials: {
            create: {
              kind: 'ACCESS',
              credentialDigest:
                security.digestApplicationCredential(credential),
              expiresAt: new Date(Date.now() + 60_000),
            },
          },
        },
      });
      const routes = createCoverImageRoutes({
        prisma,
        s3,
        bucketName,
        enabled: true,
        allowedOrigin: 'http://localhost:5173',
        digest: (value) => security.digestApplicationCredential(value),
      });
      const app =
        process.env.COVER_IMAGE_LIVE_URL ??
        express().use(express.json()).use(routes.router);
      const bytes = await sharp({
        create: { width: 8, height: 8, channels: 3, background: '#123456' },
      })
        .png()
        .withMetadata()
        .toBuffer();
      const path = `/api/sites/${siteId}/cover-image-uploads`;
      const input = {
        idempotencyKey: randomUUID(),
        filename: 'cover.png',
        mediaType: 'image/png',
        byteSize: bytes.length,
        checksum: createHash('sha256').update(bytes).digest('hex'),
      };
      await request(app)
        .post(path)
        .set('Origin', 'http://localhost:5173')
        .send(input)
        .expect(401);
      const start = await request(app)
        .post(path)
        .set('Origin', 'http://localhost:5173')
        .set('Cookie', `hansel_access=${credential}`)
        .send(input)
        .expect(201);
      await request(app)
        .post(path)
        .set('Origin', 'https://untrusted.example')
        .set('Cookie', `hansel_access=${credential}`)
        .send(input)
        .expect(403);
      await request(app)
        .post(`/api/sites/${randomUUID()}/cover-image-uploads`)
        .set('Origin', 'http://localhost:5173')
        .set('Cookie', `hansel_access=${credential}`)
        .send(input)
        .expect(404);
      await request(app)
        .post(path)
        .set('Origin', 'http://localhost:5173')
        .set('Cookie', `hansel_access=${credential}`)
        .send({ ...input, checksum: '0'.repeat(64) })
        .expect(409);
      const finalPath = `${path}/${startCoverImageResponseSchema.parse(start.body).uploadId}/finalize`;
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await request(app)
          .post(finalPath)
          .set('Origin', 'http://localhost:5173')
          .set('Cookie', `hansel_access=${credential}`)
          .set('Content-Type', 'image/png')
          .send(bytes)
          .expect(200);
        expect(result.body).toEqual({
          destination: `/sites/${siteId}/activity`,
        });
        expect(result.headers['cache-control']).toContain('no-store');
      }
      const saved = await prisma.siteCoverImage.findUniqueOrThrow({
        where: { siteId },
      });
      objectKey = saved.objectKey;
      expect(saved.completedAt).not.toBeNull();
      const object = await s3.send(
        new GetObjectCommand({ Bucket: bucketName, Key: objectKey }),
      );
      expect(object.ServerSideEncryption).toBe('AES256');
      if (!object.Body) throw new Error('Missing stored cover');
      const metadata = await sharp(
        await object.Body.transformToByteArray(),
      ).metadata();
      expect(metadata.width).toBe(8);
      expect(metadata.exif).toBeUndefined();
      // @spec site-cover-image-display REQ-001..REQ-007
      const read = await request(app)
        .get(`/api/sites/${siteId}/cover-image`)
        .set('Cookie', `hansel_access=${credential}`)
        .expect(200);
      expect(read.headers['content-type']).toContain('image/png');
      expect(read.headers['cache-control']).toBe('private, no-store');
      if (process.env.COVER_IMAGE_BROWSER === 'true') {
        const browser = await chromium.launch({ headless: true });
        try {
          const context = await browser.newContext({
            viewport: { width: 1512, height: 982 },
          });
          const page = await context.newPage();
          await page.context().addCookies([
            {
              name: 'hansel_access',
              value: credential,
              url: 'http://localhost:5173',
              httpOnly: true,
              sameSite: 'Lax',
            },
          ]);
          await page.goto('http://localhost:5173/sites');
          await page.screenshot({ path: '/tmp/hansel-cover-before.png' });
          const image = page.locator(`a[href="/sites/${siteId}/activity"] img`);
          try {
            await image.waitFor({ state: 'visible', timeout: 10_000 });
          } catch (error) {
            await page.screenshot({ path: '/tmp/hansel-cover-failure.png' });
            throw error;
          }
          await image.evaluate((element) =>
            (element as HTMLImageElement).decode(),
          );
          expect(
            await image.evaluate(
              (element) => (element as HTMLImageElement).naturalWidth,
            ),
          ).toBe(8);
          await page.screenshot({ path: '/tmp/hansel-site-cover-grid.png' });
          const accessibility = await new AxeBuilder({ page })
            .include('[aria-label="Sites grid"]')
            .analyze();
          expect(
            accessibility.violations.filter(
              ({ impact }) => impact === 'serious' || impact === 'critical',
            ),
          ).toEqual([]);
          await page.evaluate(() => {
            document.body.style.zoom = '2';
          });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true);
          await page.evaluate(() => {
            document.body.style.zoom = '1';
          });
          await page.setViewportSize({ width: 320, height: 800 });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true);
          await page
            .getByRole('button', { name: 'List view', exact: true })
            .click();
          expect(await page.locator('table img').count()).toBe(0);
          await page
            .getByRole('button', { name: 'Grid view', exact: true })
            .click();
          await image.waitFor({ state: 'visible' });
          await page.evaluate(() => {
            document.documentElement.setAttribute(
              'data-cover-navigation-check',
              'present',
            );
          });
          await image.click();
          expect(new URL(page.url()).pathname).toBe(
            `/sites/${siteId}/activity`,
          );
          expect(
            await page
              .locator('html')
              .getAttribute('data-cover-navigation-check'),
          ).toBe('present');
        } finally {
          await browser.close();
        }
      }
    } finally {
      await prisma.site.deleteMany({ where: { id: siteId } });
      if (objectKey) {
        await s3.send(
          new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey }),
        );
        await prisma.coverImageDeletion.deleteMany({ where: { objectKey } });
      }
      await prisma.applicationSessionFamily.deleteMany({
        where: { id: familyId },
      });
      await prisma.$disconnect();
    }
  },
  60_000,
);
