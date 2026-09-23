/** Local opt-in smoke check; never requires AWS in CI. @spec allocation-plan-multiple-files AC-001 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { chromium } from '@playwright/test';
import { expect, it } from 'vitest';
import { createOnboardingSecurity } from '../onboarding/security.js';
import { loadConfig } from '../config.js';
import { createS3AllocationPlanObjectStore } from './s3-allocation-plan-object-store.js';

it.skipIf(process.env.ALLOCATION_DRAFT_LIVE !== 'true')(
  'creates one real named allocation from one browser-uploaded file and cleans only its fixtures',
  async () => {
    const databaseUrl = new URL(process.env.DATABASE_URL ?? 'http://invalid');
    if (!['localhost', '127.0.0.1'].includes(databaseUrl.hostname))
      throw new Error('Local database required');
    const prisma = new PrismaClient();
    const siteId = randomUUID(),
      familyId = randomUUID(),
      credential = randomUUID();
    const config = loadConfig();
    if (!config.allocationPlansBucketName)
      throw new Error('Local upload bucket required');
    const objects = createS3AllocationPlanObjectStore({
      bucketName: config.allocationPlansBucketName,
    });
    const browser = await chromium.launch();
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
          name: 'Allocation browser fixture',
          accessScope: 'PRIVATE',
        },
      });
      await prisma.applicationSessionFamily.create({
        data: {
          id: familyId,
          tenantId: member.tenantId,
          userId: member.userId,
          absoluteExpiresAt: new Date(Date.now() + 300_000),
          credentials: {
            create: {
              kind: 'ACCESS',
              credentialDigest:
                createOnboardingSecurity(config).digestApplicationCredential(
                  credential,
                ),
              expiresAt: new Date(Date.now() + 300_000),
            },
          },
        },
      });
      const context = await browser.newContext({
        viewport: { width: 1512, height: 982 },
      });
      await context.addCookies([
        {
          name: 'hansel_access',
          value: credential,
          url: 'http://localhost:5173',
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
      const page = await context.newPage();
      await page.goto(`http://localhost:5173/sites/${siteId}/allocations`);
      await page.getByRole('button', { name: 'Add plan', exact: true }).click();
      await page
        .getByLabel('Allocation name')
        .fill('Single-file browser check');
      await page.getByLabel('Choose allocation files').setInputFiles(
        ['ground.png'].map((name) => ({
          name,
          mimeType: 'image/png',
          buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6p8AAAAASUVORK5CYII=',
            'base64',
          ),
        })),
      );
      let documentLoads = 0;
      page.on('request', (request) => {
        if (request.isNavigationRequest()) documentLoads++;
      });
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      const add = page.getByRole('button', {
        name: 'Add Allocation',
        exact: true,
      });
      await add.waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll('button')).some(
            (button) =>
              button.textContent === 'Add Allocation' && !button.disabled,
          ),
        { timeout: 30_000 },
      );
      await page.screenshot({ path: '/tmp/allocation-live-uploaded.png' });
      expect(await prisma.allocationPlan.count({ where: { siteId } })).toBe(0);
      await add.click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page
        .getByText('Single-file browser check', { exact: true })
        .waitFor();
      expect(documentLoads).toBe(0);
      const plans = await prisma.allocationPlan.findMany({
        where: { siteId },
        include: { files: { orderBy: { position: 'asc' } } },
      });
      expect(plans).toHaveLength(1);
      expect(plans[0]?.files.map((file) => file.filename)).toEqual([
        'ground.png',
      ]);
      expect(
        await prisma.activity.count({
          where: { siteId, kind: 'ALLOCATION_PLAN_ADDED' },
        }),
      ).toBe(1);
      // allocation-details-design AC-001: real private bytes and SPA file switching.
      await page
        .getByRole('link', { name: 'Single-file browser check', exact: true })
        .click();
      await page
        .getByRole('img', { name: 'ground.png', exact: true })
        .waitFor();
      expect(
        await page
          .getByRole('button', { name: 'Select allocation plan' })
          .isDisabled(),
      ).toBe(true);
      expect(documentLoads).toBe(0);
      const canvas = await page.getByTestId('plan-pan-viewport').boundingBox();
      expect(canvas?.y).toBe(151);
    } finally {
      await browser.close();
      const files = await prisma.allocationPlanUpload.findMany({
        where: { siteId },
      });
      for (const file of files) {
        await objects.remove(file.objectKey);
        await objects.remove(`plans/${file.id}`);
      }
      await prisma.activity.deleteMany({ where: { siteId } });
      await prisma.allocationPlanUpload.deleteMany({ where: { siteId } });
      await prisma.allocationPlan.deleteMany({ where: { siteId } });
      await prisma.allocationPlanUploadBatch.deleteMany({ where: { siteId } });
      await prisma.site.deleteMany({ where: { id: siteId } });
      await prisma.applicationSessionFamily.deleteMany({
        where: { id: familyId },
      });
      await prisma.$disconnect();
    }
  },
  90_000,
);
