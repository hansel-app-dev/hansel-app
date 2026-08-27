import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { loadPlanCatalog } from './plan-catalog.js';
import { createPrismaPlanSelectionStore } from './prisma-plan-selection-store.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);
const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        databaseUrl ??
        'postgresql://unused:unused@127.0.0.1:1/skipped?schema=public',
    },
  },
});
const catalog = loadPlanCatalog('test');
const entry = (priceId: 'free' | 'plus_annual' | 'enterprise') => {
  const found = catalog.entries.find(
    (candidate) => candidate.priceId === priceId,
  );
  if (!found) throw new Error(`Missing test plan ${priceId}`);
  return found;
};

async function seed() {
  const testId = randomUUID();
  const credentialDigest = `plan-${testId}`;
  const user = await prisma.user.create({
    data: {
      email: `plan-integration-${testId}@example.com`,
      emailVerifiedAt: new Date(),
      personalProfile: {
        create: {
          firstName: 'Nabin',
          lastName: 'Singh',
          jobTitle: 'manager',
          department: 'marketing_communications',
        },
      },
      journeys: {
        create: {
          entryPath: 'NEW_ORGANIZATION',
          currentStep: 'PLAN_SELECTION',
        },
      },
      continuation: {
        create: { credentialDigest, expiresAt: new Date(Date.now() + 60_000) },
      },
    },
  });
  return { user, credentialDigest };
}

integration(
  'PostgreSQL plan-selection transition [onboarding-plan-selection REQ-006, REQ-007, REQ-008, REQ-009, REQ-011, REQ-017]',
  () => {
    afterAll(() => prisma.$disconnect());

    it('persists a Free snapshot and advances without payment', async () => {
      const { user, credentialDigest } = await seed();
      const store = createPrismaPlanSelectionStore(prisma);
      await expect(
        store.save({
          credentialDigest,
          nextCredentialDigest: `next-${randomUUID()}`,
          nextCredentialExpiresAt: new Date(Date.now() + 60_000),
          now: new Date(),
          catalogVersion: catalog.version,
          entry: entry('free'),
        }),
      ).resolves.toBe(true);
      await expect(
        prisma.onboardingJourney.findFirst({
          where: { userId: user.id },
          select: { currentStep: true },
        }),
      ).resolves.toEqual({ currentStep: 'ORGANIZATION_PROFILE' });
      await expect(
        prisma.onboardingPlanSelection.findUnique({
          where: { userId: user.id },
          select: {
            id: true,
            priceId: true,
            amountMinor: true,
            paymentRequired: true,
            maximumSites: true,
          },
        }),
      ).resolves.toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        priceId: 'free',
        amountMinor: 0,
        paymentRequired: false,
        maximumSites: 1,
      });
    });

    it('has one winner under concurrent paid-plan submissions', async () => {
      const { user, credentialDigest } = await seed();
      const store = createPrismaPlanSelectionStore(prisma);
      const save = () =>
        store.save({
          credentialDigest,
          nextCredentialDigest: `next-${randomUUID()}`,
          nextCredentialExpiresAt: new Date(Date.now() + 60_000),
          now: new Date(),
          catalogVersion: catalog.version,
          entry: entry('plus_annual'),
        });
      await expect(
        Promise.all([save(), save()]).then((results) => results.sort()),
      ).resolves.toEqual([false, true]);
      await expect(
        prisma.onboardingJourney.findFirst({
          where: { userId: user.id },
          select: { currentStep: true },
        }),
      ).resolves.toEqual({ currentStep: 'PAYMENT' });
      await expect(
        prisma.onboardingPlanSelection.count({ where: { userId: user.id } }),
      ).resolves.toBe(1);
      await expect(
        prisma.onboardingPlanSelection.findUnique({
          where: { userId: user.id },
          select: {
            priceId: true,
            amountMinor: true,
            currency: true,
            catalogVersion: true,
          },
        }),
      ).resolves.toEqual({
        priceId: 'plus_annual',
        amountMinor: 39000,
        currency: 'USD',
        catalogVersion: catalog.version,
      });
      await expect(
        store.save({
          credentialDigest,
          nextCredentialDigest: `replacement-${randomUUID()}`,
          nextCredentialExpiresAt: new Date(Date.now() + 60_000),
          now: new Date(),
          catalogVersion: 'replacement',
          entry: entry('free'),
        }),
      ).resolves.toBe(false);
      await expect(
        prisma.onboardingPlanSelection.findUnique({
          where: { userId: user.id },
          select: { priceId: true, catalogVersion: true },
        }),
      ).resolves.toEqual({
        priceId: 'plus_annual',
        catalogVersion: catalog.version,
      });
    });

    it('persists Enterprise contact intent without entering payment', async () => {
      const { user, credentialDigest } = await seed();
      const store = createPrismaPlanSelectionStore(prisma);
      await expect(
        store.save({
          credentialDigest,
          nextCredentialDigest: `next-${randomUUID()}`,
          nextCredentialExpiresAt: new Date(Date.now() + 60_000),
          now: new Date(),
          catalogVersion: catalog.version,
          entry: entry('enterprise'),
        }),
      ).resolves.toBe(true);
      await expect(
        prisma.onboardingJourney.findFirst({
          where: { userId: user.id },
          select: { currentStep: true },
        }),
      ).resolves.toEqual({ currentStep: 'PLAN_SELECTION' });
      await expect(
        prisma.onboardingPlanSelection.findUnique({
          where: { userId: user.id },
          select: { priceId: true, paymentRequired: true },
        }),
      ).resolves.toEqual({ priceId: 'enterprise', paymentRequired: false });
    });

    it('rolls back a wrong-step transition without creating a snapshot', async () => {
      const { user, credentialDigest } = await seed();
      await prisma.onboardingJourney.updateMany({
        where: { userId: user.id },
        data: { currentStep: 'PERSONAL_PROFILE' },
      });
      const store = createPrismaPlanSelectionStore(prisma);
      await expect(
        store.save({
          credentialDigest,
          nextCredentialDigest: `next-${randomUUID()}`,
          nextCredentialExpiresAt: new Date(Date.now() + 60_000),
          now: new Date(),
          catalogVersion: catalog.version,
          entry: entry('free'),
        }),
      ).resolves.toBe(false);
      await expect(
        prisma.onboardingPlanSelection.count({ where: { userId: user.id } }),
      ).resolves.toBe(0);
      await expect(
        prisma.onboardingContinuation.findUnique({
          where: { userId: user.id },
          select: { credentialDigest: true },
        }),
      ).resolves.toEqual({ credentialDigest });
    });
  },
);
