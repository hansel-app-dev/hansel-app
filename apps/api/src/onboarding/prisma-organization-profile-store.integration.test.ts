import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createPrismaOrganizationProfileStore } from './prisma-organization-profile-store.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl ?? 'postgresql://unused:unused@127.0.0.1:1/skipped',
    },
  },
});
const profile = {
  organizationName: 'Hansel',
  country: 'AU',
  industry: 'healthcare' as const,
  placeService: 'clinics',
  organizationSize: 'employees_11_50' as const,
};
async function seed(
  step: 'ORGANIZATION_PROFILE' | 'PLAN_SELECTION' = 'ORGANIZATION_PROFILE',
  withPlan = true,
  priceId = 'free',
) {
  const id = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `organization-${id}@example.com`,
      journeys: {
        create: { entryPath: 'NEW_ORGANIZATION', currentStep: step },
      },
      continuation: {
        create: {
          credentialDigest: `credential-${id}`,
          expiresAt: new Date(Date.now() + 60_000),
        },
      },
      ...(withPlan
        ? {
            planSelection: {
              create: {
                planId: priceId === 'free' ? 'free' : 'plus',
                priceId,
                billingInterval: priceId === 'free' ? null : 'ANNUAL',
                amountMinor: priceId === 'free' ? 0 : 39000,
                currency: 'USD',
                paymentRequired: priceId !== 'free',
                maximumSites: priceId === 'free' ? 1 : null,
                catalogVersion: 'test',
                selectedAt: new Date(),
              },
            },
          }
        : {}),
    },
    include: { journeys: true },
  });
  const journey = user.journeys[0];
  if (!journey) throw new Error('Expected seeded onboarding journey');
  return {
    user,
    journey,
    credentialDigest: `credential-${id}`,
  };
}
const saveInput = (
  credentialDigest: string,
  submissionKeyDigest: string,
  requestDigest = 'request',
) => ({
  credentialDigest,
  submissionKeyDigest,
  requestDigest,
  nextCredentialDigest: `next-${randomUUID()}`,
  nextCredentialExpiresAt: new Date(Date.now() + 60_000),
  now: new Date(),
  profile,
});

integration(
  'PostgreSQL organization profile [onboarding-organization-profile REQ-008..REQ-010, REQ-016]',
  () => {
    afterAll(() => prisma.$disconnect());
    it('creates one organization, sole Owner, and discovery transition atomically', async () => {
      const seeded = await seed();
      const store = createPrismaOrganizationProfileStore(prisma);
      expect(
        await store.prepare({
          credentialDigest: seeded.credentialDigest,
          submissionKeyDigest: 'key-' + randomUUID(),
          now: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ).toBe(true);
      const submission =
        await prisma.organizationProfileSubmission.findUniqueOrThrow({
          where: { journeyId: seeded.journey.id },
        });
      expect(
        await store.save(
          saveInput(seeded.credentialDigest, submission.submissionKeyDigest),
        ),
      ).toBe('created');
      const journey = await prisma.onboardingJourney.findUniqueOrThrow({
        where: { id: seeded.journey.id },
        include: { tenant: { include: { memberships: true } } },
      });
      expect(journey.currentStep).toBe('DISCOVERY');
      expect(journey.tenant).toMatchObject({
        name: 'Hansel',
        country: 'AU',
        industry: 'healthcare',
        placeService: 'clinics',
        organizationSize: 'employees_11_50',
      });
      expect(journey.tenant?.memberships).toHaveLength(1);
      expect(journey.tenant?.memberships[0]).toMatchObject({
        userId: seeded.user.id,
        roleId: 'owner',
      });
    });
    it('replays the same digest and conflicts on changed input', async () => {
      const seeded = await seed();
      const store = createPrismaOrganizationProfileStore(prisma);
      const key = `key-${randomUUID()}`;
      await store.prepare({
        credentialDigest: seeded.credentialDigest,
        submissionKeyDigest: key,
        now: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });
      expect(await store.save(saveInput(seeded.credentialDigest, key))).toBe(
        'created',
      );
      expect(await store.save(saveInput(seeded.credentialDigest, key))).toBe(
        'replay-initial',
      );
      const rotated = await prisma.onboardingContinuation.findUniqueOrThrow({
        where: { userId: seeded.user.id },
      });
      expect(await store.save(saveInput(rotated.credentialDigest, key))).toBe(
        'replay-current',
      );
      expect(await store.save(saveInput('another-user', key))).toBe('rejected');
      expect(
        await store.save(saveInput(seeded.credentialDigest, key, 'changed')),
      ).toBe('conflict');
    });
    it('rejects wrong-step preparation and permits one concurrent winner', async () => {
      const wrong = await seed('PLAN_SELECTION');
      const store = createPrismaOrganizationProfileStore(prisma);
      expect(
        await store.prepare({
          credentialDigest: wrong.credentialDigest,
          submissionKeyDigest: `key-${randomUUID()}`,
          now: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ).toBe(false);
      const paid = await seed('ORGANIZATION_PROFILE', true, 'plus_annual');
      expect(
        await store.prepare({
          credentialDigest: paid.credentialDigest,
          submissionKeyDigest: `key-${randomUUID()}`,
          now: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ).toBe(true);
      const noPlan = await seed('ORGANIZATION_PROFILE', false);
      expect(
        await store.prepare({
          credentialDigest: noPlan.credentialDigest,
          submissionKeyDigest: `key-${randomUUID()}`,
          now: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ).toBe(false);
      const seeded = await seed();
      const key = `key-${randomUUID()}`;
      await store.prepare({
        credentialDigest: seeded.credentialDigest,
        submissionKeyDigest: key,
        now: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });
      const results = await Promise.all([
        store.save(saveInput(seeded.credentialDigest, key)),
        store.save(saveInput(seeded.credentialDigest, key)),
      ]);
      expect(results.sort()).toEqual(['created', 'replay-initial']);
      await expect(
        prisma.tenant.count({
          where: { memberships: { some: { userId: seeded.user.id } } },
        }),
      ).resolves.toBe(1);
    });
  },
);
