import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createPrismaWelcomeEmailStore } from './prisma-welcome-email-store.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl ?? 'postgresql://unused:unused@127.0.0.1:1/skipped',
    },
  },
});

async function seedIntent() {
  const id = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `welcome-${id}@example.com`,
      personalProfile: {
        create: {
          firstName: 'Ava',
          lastName: 'Owner',
          jobTitle: 'owner',
          department: 'operations',
        },
      },
    },
  });
  const tenant = await prisma.tenant.create({
    data: {
      name: `Welcome ${id}`,
      country: 'AU',
      industry: 'healthcare',
      placeService: 'clinics',
      organizationSize: 'employees_11_50',
      memberships: { create: { userId: user.id, roleId: 'owner' } },
    },
  });
  const journey = await prisma.onboardingJourney.create({
    data: {
      userId: user.id,
      tenantId: tenant.id,
      entryPath: 'NEW_ORGANIZATION',
      currentStep: 'COMPLETE',
      completedAt: new Date(),
      emailDeliveryIntents: {
        create: {
          kind: 'ONBOARDING_WELCOME',
          nextAttemptAt: new Date('2000-01-01T00:00:00Z'),
        },
      },
    },
  });
  return { user, tenant, journey };
}

integration(
  'PostgreSQL Welcome email delivery [onboarding-welcome-email REQ-002..REQ-006, REQ-015]',
  () => {
    afterAll(() => prisma.$disconnect());

    it('gives concurrent workers one lease and persists delivery once', async () => {
      const seeded = await seedIntent();
      const store = createPrismaWelcomeEmailStore(prisma);
      const now = new Date();
      const leaseExpiresAt = new Date(now.getTime() + 60_000);

      const claims = await Promise.all([
        store.claim({ workerId: 'worker-one', now, leaseExpiresAt }),
        store.claim({ workerId: 'worker-two', now, leaseExpiresAt }),
      ]);
      expect(claims.filter(Boolean)).toHaveLength(1);
      const claimed = claims.find((claim) => claim !== null);
      if (!claimed) throw new Error('Expected one claimed delivery');
      expect(claimed).toMatchObject({
        recipient: seeded.user.email,
        firstName: 'Ava',
        attemptCount: 1,
      });
      const workerId = claims[0] ? 'worker-one' : 'worker-two';
      await expect(
        store.markDelivered({
          id: claimed.id,
          workerId,
          providerMessageId: 'provider-id',
          deliveredAt: now,
        }),
      ).resolves.toBe(true);
      await expect(
        prisma.emailDeliveryIntent.findUniqueOrThrow({
          where: {
            journeyId_kind: {
              journeyId: seeded.journey.id,
              kind: 'ONBOARDING_WELCOME',
            },
          },
        }),
      ).resolves.toMatchObject({
        status: 'DELIVERED',
        attemptCount: 1,
        providerMessageId: 'provider-id',
        leaseOwner: null,
        leaseExpiresAt: null,
      });
    });

    it('recovers an expired lease and persists a retry', async () => {
      const seeded = await seedIntent();
      const expired = new Date(Date.now() - 60_000);
      await prisma.emailDeliveryIntent.update({
        where: {
          journeyId_kind: {
            journeyId: seeded.journey.id,
            kind: 'ONBOARDING_WELCOME',
          },
        },
        data: { leaseOwner: 'dead-worker', leaseExpiresAt: expired },
      });
      const store = createPrismaWelcomeEmailStore(prisma);
      const now = new Date();
      const claimed = await store.claim({
        workerId: 'recovery-worker',
        now,
        leaseExpiresAt: new Date(now.getTime() + 60_000),
      });
      expect(claimed).toMatchObject({ recoveredLease: true, attemptCount: 1 });
      if (!claimed) throw new Error('Expected an expired lease to be claimed');
      const nextAttemptAt = new Date(now.getTime() + 300_000);
      await expect(
        store.markRetry({
          id: claimed.id,
          workerId: 'recovery-worker',
          nextAttemptAt,
        }),
      ).resolves.toBe(true);
      await expect(
        prisma.emailDeliveryIntent.findUniqueOrThrow({
          where: { id: claimed.id },
        }),
      ).resolves.toMatchObject({
        status: 'PENDING',
        attemptCount: 1,
        nextAttemptAt,
        leaseOwner: null,
        leaseExpiresAt: null,
      });
    });

    it('derives the journey owner and persists a terminal transition', async () => {
      const seeded = await seedIntent();
      await prisma.user.create({
        data: {
          email: `unrelated-${randomUUID()}@example.com`,
          personalProfile: {
            create: {
              firstName: 'Wrong',
              lastName: 'Person',
              jobTitle: 'editor',
              department: 'design',
            },
          },
        },
      });
      const store = createPrismaWelcomeEmailStore(prisma);
      const now = new Date();
      const claim = await store.claim({
        workerId: 'terminal-worker',
        now,
        leaseExpiresAt: new Date(now.getTime() + 60_000),
      });
      expect(claim).toMatchObject({
        recipient: seeded.user.email,
        firstName: 'Ava',
      });
      expect(seeded.journey.tenantId).toBe(seeded.tenant.id);
      if (!claim)
        throw new Error('Expected the intended journey to be claimed');
      await expect(
        store.markTerminal({
          id: claim.id,
          workerId: 'terminal-worker',
          reason: 'provider_permanent',
        }),
      ).resolves.toBe(true);
      await expect(
        prisma.emailDeliveryIntent.findUniqueOrThrow({
          where: { id: claim.id },
        }),
      ).resolves.toMatchObject({
        status: 'TERMINAL',
        terminalFailureReason: 'provider_permanent',
        leaseOwner: null,
        leaseExpiresAt: null,
      });
    });
  },
);
