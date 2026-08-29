import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createPrismaDiscoveryStore } from './prisma-discovery-store.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl ?? 'postgresql://unused:unused@127.0.0.1:1/skipped',
    },
  },
});
const now = () => new Date();
const applicationSession = () => {
  const issuedAt = now();
  return {
    accessCredentialDigest: `access-${randomUUID()}`,
    refreshCredentialDigest: `refresh-${randomUUID()}`,
    accessExpiresAt: new Date(issuedAt.getTime() + 15 * 60 * 1_000),
    absoluteExpiresAt: new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1_000),
  };
};

async function seed() {
  const id = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `discovery-${id}@example.com`,
      continuation: {
        create: {
          credentialDigest: `credential-${id}`,
          expiresAt: new Date(Date.now() + 60_000),
        },
      },
    },
  });
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Hansel',
      country: 'AU',
      industry: 'healthcare',
      placeService: 'clinics',
      organizationSize: 'employees_11_50',
      memberships: {
        create: { userId: user.id, roleId: 'owner' },
      },
    },
  });
  const journey = await prisma.onboardingJourney.create({
    data: {
      userId: user.id,
      tenantId: tenant.id,
      entryPath: 'NEW_ORGANIZATION',
      currentStep: 'DISCOVERY',
    },
  });
  return {
    user,
    tenant,
    journey,
    credentialDigest: `credential-${id}`,
  };
}

async function prepare(
  store: ReturnType<typeof createPrismaDiscoveryStore>,
  credentialDigest: string,
) {
  const submissionKeyDigest = `key-${randomUUID()}`;
  await expect(
    store.prepare({
      credentialDigest,
      submissionKeyDigest,
      now: now(),
      expiresAt: new Date(Date.now() + 60_000),
    }),
  ).resolves.toBe(true);
  return submissionKeyDigest;
}

const submitted = {
  outcome: 'submitted' as const,
  currentManagement: 'other' as const,
  currentManagementOther: 'Custom CMS',
  challenges: null,
};
const skipped = {
  outcome: 'skipped' as const,
  currentManagement: null,
  currentManagementOther: null,
  challenges: null,
};

integration(
  'PostgreSQL discovery completion [onboarding-discovery REQ-005..REQ-009, REQ-017; onboarding-welcome-email REQ-001..REQ-003, REQ-017]',
  () => {
    afterAll(() => prisma.$disconnect());

    it.each([
      ['submitted', submitted],
      ['skipped', skipped],
    ])('atomically persists an explicit %s outcome', async (_name, answers) => {
      const seeded = await seed();
      const store = createPrismaDiscoveryStore(prisma);
      const key = await prepare(store, seeded.credentialDigest);
      const completedAt = now();
      await expect(
        store.complete({
          credentialDigest: seeded.credentialDigest,
          submissionKeyDigest: key,
          requestDigest: `request-${randomUUID()}`,
          now: completedAt,
          answers,
          applicationSession: applicationSession(),
        }),
      ).resolves.toBe('created');
      await expect(
        prisma.onboardingJourney.findUniqueOrThrow({
          where: { id: seeded.journey.id },
          include: { discoveryResponse: true },
        }),
      ).resolves.toMatchObject({
        currentStep: 'COMPLETE',
        completedAt,
        discoveryResponse: answers,
      });
      await expect(
        prisma.onboardingContinuation.findUnique({
          where: { userId: seeded.user.id },
        }),
      ).resolves.toBeNull();
      const family = await prisma.applicationSessionFamily.findFirstOrThrow({
        where: { userId: seeded.user.id, tenantId: seeded.tenant.id },
        include: { credentials: true },
      });
      expect(family.credentials.map(({ kind }) => kind).sort()).toEqual([
        'ACCESS',
        'REFRESH',
      ]);
      await expect(
        prisma.emailDeliveryIntent.count({
          where: {
            journeyId: seeded.journey.id,
            kind: 'ONBOARDING_WELCOME',
          },
        }),
      ).resolves.toBe(1);
    });

    it('permits one concurrent winner, replays equivalent input, and rejects changed input', async () => {
      const seeded = await seed();
      const store = createPrismaDiscoveryStore(prisma);
      const key = await prepare(store, seeded.credentialDigest);
      const input = {
        credentialDigest: seeded.credentialDigest,
        submissionKeyDigest: key,
        requestDigest: `request-${randomUUID()}`,
        now: now(),
        answers: submitted,
        applicationSession: applicationSession(),
      };
      await expect(
        Promise.all([store.complete(input), store.complete(input)]),
      ).resolves.toEqual(expect.arrayContaining(['created', 'replay']));
      await expect(store.complete(input)).resolves.toBe('replay');
      await expect(
        store.complete({ ...input, requestDigest: 'changed' }),
      ).resolves.toBe('conflict');
      await expect(
        prisma.onboardingDiscoveryResponse.count({
          where: { journeyId: seeded.journey.id },
        }),
      ).resolves.toBe(1);
      await expect(
        prisma.applicationSessionFamily.count({
          where: { userId: seeded.user.id, tenantId: seeded.tenant.id },
        }),
      ).resolves.toBe(1);
      await expect(
        prisma.emailDeliveryIntent.count({
          where: { journeyId: seeded.journey.id },
        }),
      ).resolves.toBe(1);
    });

    it('rejects a wrong tenant owner and rolls back an invalid database answer', async () => {
      const seeded = await seed();
      await prisma.membership.updateMany({
        where: { tenantId: seeded.tenant.id, userId: seeded.user.id },
        data: { roleId: 'admin' },
      });
      const store = createPrismaDiscoveryStore(prisma);
      await expect(
        store.prepare({
          credentialDigest: seeded.credentialDigest,
          submissionKeyDigest: `key-${randomUUID()}`,
          now: now(),
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ).resolves.toBe(false);

      await prisma.membership.updateMany({
        where: { tenantId: seeded.tenant.id, userId: seeded.user.id },
        data: { roleId: 'owner' },
      });
      const key = await prepare(store, seeded.credentialDigest);
      await expect(
        store.complete({
          credentialDigest: seeded.credentialDigest,
          submissionKeyDigest: key,
          requestDigest: `request-${randomUUID()}`,
          now: now(),
          answers: {
            ...submitted,
            currentManagementOther: '',
          },
          applicationSession: applicationSession(),
        }),
      ).rejects.toThrow();
      await expect(
        prisma.onboardingJourney.findUniqueOrThrow({
          where: { id: seeded.journey.id },
        }),
      ).resolves.toMatchObject({ currentStep: 'DISCOVERY', completedAt: null });
      await expect(
        prisma.onboardingDiscoveryResponse.count({
          where: { journeyId: seeded.journey.id },
        }),
      ).resolves.toBe(0);
      await expect(
        prisma.applicationSessionFamily.count({
          where: { userId: seeded.user.id, tenantId: seeded.tenant.id },
        }),
      ).resolves.toBe(0);
      await expect(
        prisma.emailDeliveryIntent.count({
          where: { journeyId: seeded.journey.id },
        }),
      ).resolves.toBe(0);
    });

    it('rolls back completion when the Welcome intent cannot be persisted', async () => {
      const seeded = await seed();
      await prisma.emailDeliveryIntent.create({
        data: {
          journeyId: seeded.journey.id,
          kind: 'ONBOARDING_WELCOME',
          nextAttemptAt: now(),
        },
      });
      const store = createPrismaDiscoveryStore(prisma);
      const key = await prepare(store, seeded.credentialDigest);

      await expect(
        store.complete({
          credentialDigest: seeded.credentialDigest,
          submissionKeyDigest: key,
          requestDigest: `request-${randomUUID()}`,
          now: now(),
          answers: submitted,
          applicationSession: applicationSession(),
        }),
      ).resolves.toBe('rejected');
      await expect(
        prisma.onboardingJourney.findUniqueOrThrow({
          where: { id: seeded.journey.id },
        }),
      ).resolves.toMatchObject({ currentStep: 'DISCOVERY', completedAt: null });
      await expect(
        prisma.onboardingDiscoveryResponse.count({
          where: { journeyId: seeded.journey.id },
        }),
      ).resolves.toBe(0);
      await expect(
        prisma.applicationSessionFamily.count({
          where: { userId: seeded.user.id },
        }),
      ).resolves.toBe(0);
      await expect(
        prisma.onboardingContinuation.count({
          where: { userId: seeded.user.id },
        }),
      ).resolves.toBe(1);
    });
  },
);
