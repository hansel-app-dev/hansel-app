import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createPrismaExternalLoginStore } from './prisma-external-login-store.js';
import { createPrismaPasswordLoginStore } from './prisma-password-login-store.js';

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

const passwordHash = 'integration-password-hash';
const now = new Date('2026-08-30T00:00:00.000Z');

async function seedUser(input: {
  verified?: boolean;
  currentStep?:
    'VERIFY_EMAIL' | 'PERSONAL_PROFILE' | 'PLAN_SELECTION' | 'COMPLETE';
  completed?: boolean;
  memberships?: number;
}) {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `login-integration-${suffix}@example.com`,
      emailVerifiedAt: input.verified === false ? null : now,
      password: { create: { passwordHash } },
      journeys: {
        create: {
          entryPath: 'NEW_ORGANIZATION',
          currentStep: input.currentStep ?? 'COMPLETE',
          completedAt: input.completed === false ? null : now,
        },
      },
    },
  });
  const tenants = [];
  for (let index = 0; index < (input.memberships ?? 1); index += 1) {
    tenants.push(
      await prisma.tenant.create({
        data: {
          name: `Login integration ${suffix}-${String(index)}`,
          country: 'AU',
          industry: 'healthcare',
          placeService: 'clinics',
          organizationSize: 'employees_1_10',
          memberships: { create: { userId: user.id, roleId: 'owner' } },
        },
      }),
    );
  }
  return { user, tenants };
}

const successInput = (userId: string, suffix = randomUUID()) => ({
  userId,
  expectedPasswordHash: passwordHash,
  now,
  accessCredentialDigest: `access-${suffix}`,
  accessExpiresAt: new Date('2026-08-30T00:15:00.000Z'),
  refreshCredentialDigest: `refresh-${suffix}`,
  absoluteExpiresAt: new Date('2026-09-29T00:00:00.000Z'),
  onboardingCredentialDigest: `onboarding-${suffix}`,
  onboardingExpiresAt: new Date('2026-08-30T00:15:00.000Z'),
});

integration(
  'PostgreSQL login stores [user-login REQ-009, REQ-011, REQ-021]',
  () => {
    afterAll(() => prisma.$disconnect());

    it('atomically creates Google onboarding, rejects email collision and deduplicates races [google-local-auth REQ-003, REQ-004]', async () => {
      const suffix = randomUUID();
      const email = `google-onboarding-${suffix}@example.com`;
      const store = createPrismaExternalLoginStore(prisma);
      const input = {
        ...successInput(suffix),
        provider: 'google' as const,
        subject: suffix,
        intent: 'onboarding' as const,
        verifiedEmail: email,
        termsVersion: '2026-08-27',
        privacyVersion: '2026-08-27',
      };
      try {
        await Promise.all([
          store.completeIdentityLogin(input),
          store.completeIdentityLogin({
            ...input,
            onboardingCredentialDigest: `other-${suffix}`,
          }),
        ]);
        const users = await prisma.user.findMany({
          where: { email },
          include: {
            externalIdentities: true,
            consents: true,
            journeys: true,
            continuation: true,
            sessionFamilies: true,
          },
        });
        expect(users).toHaveLength(1);
        expect(users[0]?.externalIdentities).toHaveLength(1);
        expect(users[0]?.consents).toHaveLength(1);
        expect(users[0]?.journeys[0]?.currentStep).toBe('PERSONAL_PROFILE');
        expect(users[0]?.continuation).not.toBeNull();
        expect(users[0]?.sessionFamilies).toHaveLength(0);
        await expect(
          store.completeIdentityLogin({
            ...input,
            subject: `collision-${suffix}`,
          }),
        ).resolves.toBeNull();
        expect(
          await prisma.externalIdentity.count({
            where: { subject: `collision-${suffix}` },
          }),
        ).toBe(0);
        await expect(
          store.completeIdentityLogin({ ...input, intent: 'login' }),
        ).resolves.toEqual({
          destination: '/onboarding/about-you',
          sessionKind: 'onboarding',
        });
      } finally {
        await prisma.user.deleteMany({ where: { email } });
      }
    });

    it('issues a session, evicts the oldest family, and resets failure state atomically', async () => {
      const seeded = await seedUser({ memberships: 1 });
      const tenant = seeded.tenants[0];
      if (!tenant) throw new Error('Expected a seeded tenant');
      await prisma.passwordAuthenticationState.create({
        data: {
          userId: seeded.user.id,
          failedAttempts: 3,
          windowStartedAt: now,
        },
      });
      const oldest = await prisma.applicationSessionFamily.create({
        data: {
          userId: seeded.user.id,
          tenantId: tenant.id,
          absoluteExpiresAt: new Date('2026-09-01T00:00:00.000Z'),
        },
      });
      for (let index = 0; index < 4; index += 1)
        await prisma.applicationSessionFamily.create({
          data: {
            userId: seeded.user.id,
            tenantId: tenant.id,
            absoluteExpiresAt: new Date('2026-09-02T00:00:00.000Z'),
          },
        });

      const store = createPrismaPasswordLoginStore(prisma);
      await expect(
        store.completeSuccess(successInput(seeded.user.id)),
      ).resolves.toEqual({
        destination: '/dashboard',
        sessionKind: 'application',
      });
      await expect(
        prisma.applicationSessionFamily.findUniqueOrThrow({
          where: { id: oldest.id },
        }),
      ).resolves.toMatchObject({
        revokedAt: now,
        revocationReason: 'active_family_limit',
      });
      await expect(
        prisma.applicationSessionFamily.count({
          where: {
            userId: seeded.user.id,
            revokedAt: null,
            absoluteExpiresAt: { gt: now },
          },
        }),
      ).resolves.toBe(5);
      await expect(
        prisma.passwordAuthenticationState.findUniqueOrThrow({
          where: { userId: seeded.user.id },
        }),
      ).resolves.toMatchObject({
        failedAttempts: 0,
        windowStartedAt: null,
        lockedUntil: null,
      });
    });

    it('resumes verified onboarding and recovers unverified verification without a session family', async () => {
      const verified = await seedUser({
        currentStep: 'PLAN_SELECTION',
        completed: false,
        memberships: 0,
      });
      const unverified = await seedUser({
        verified: false,
        currentStep: 'VERIFY_EMAIL',
        completed: false,
        memberships: 0,
      });
      const store = createPrismaPasswordLoginStore(prisma);
      await expect(
        store.completeSuccess(successInput(verified.user.id)),
      ).resolves.toEqual({
        destination: '/onboarding/plan-selection',
        sessionKind: 'onboarding',
      });
      await expect(
        prisma.onboardingContinuation.findUnique({
          where: { userId: verified.user.id },
        }),
      ).resolves.toMatchObject({
        credentialDigest: expect.stringMatching(/^onboarding-/),
      });
      await expect(
        store.completeSuccess(successInput(unverified.user.id)),
      ).resolves.toEqual({
        destination: '/onboarding/verify-email',
        sessionKind: 'verification',
      });
      await expect(
        prisma.applicationSessionFamily.count({
          where: { userId: { in: [verified.user.id, unverified.user.id] } },
        }),
      ).resolves.toBe(0);
    });

    it('enforces one concurrent lock window and one durable notification without extension', async () => {
      const seeded = await seedUser({ memberships: 0 });
      const store = createPrismaPasswordLoginStore(prisma);
      await Promise.all(
        Array.from({ length: 5 }, () =>
          store.recordFailure({ userId: seeded.user.id, now }),
        ),
      );
      const lockedUntil = new Date('2026-08-30T00:15:00.000Z');
      await expect(
        prisma.passwordAuthenticationState.findUniqueOrThrow({
          where: { userId: seeded.user.id },
        }),
      ).resolves.toMatchObject({ failedAttempts: 5, lockedUntil });
      await expect(
        prisma.passwordLockNotificationIntent.count({
          where: { userId: seeded.user.id },
        }),
      ).resolves.toBe(1);

      await store.recordFailure({
        userId: seeded.user.id,
        now: new Date('2026-08-30T00:05:00.000Z'),
      });
      await expect(
        prisma.passwordAuthenticationState.findUniqueOrThrow({
          where: { userId: seeded.user.id },
        }),
      ).resolves.toMatchObject({ failedAttempts: 5, lockedUntil });

      await store.recordFailure({
        userId: seeded.user.id,
        now: new Date('2026-08-30T00:16:00.000Z'),
      });
      await expect(
        prisma.passwordAuthenticationState.findUniqueOrThrow({
          where: { userId: seeded.user.id },
        }),
      ).resolves.toMatchObject({ failedAttempts: 1, lockedUntil: null });
    });

    it('rolls back session issuance for ambiguous membership selection', async () => {
      const seeded = await seedUser({ memberships: 2 });
      const store = createPrismaPasswordLoginStore(prisma);
      await expect(
        store.completeSuccess(successInput(seeded.user.id)),
      ).resolves.toBeNull();
      await expect(
        prisma.applicationSessionFamily.count({
          where: { userId: seeded.user.id },
        }),
      ).resolves.toBe(0);
    });

    it('enforces external identity uniqueness and consumes authorization state once', async () => {
      const first = await seedUser({ memberships: 0 });
      const second = await seedUser({ memberships: 0 });
      const subject = `subject-${randomUUID()}`;
      await prisma.externalIdentity.create({
        data: {
          userId: first.user.id,
          provider: 'GOOGLE',
          subject,
        },
      });
      await expect(
        prisma.externalIdentity.create({
          data: {
            userId: second.user.id,
            provider: 'GOOGLE',
            subject,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });

      const store = createPrismaExternalLoginStore(prisma);
      const sealedSecrets = `sealed-${randomUUID()}`;
      await store.createTransaction({
        provider: 'google',
        intent: 'login',
        stateDigest: `state-${randomUUID()}`,
        nonceDigest: 'nonce',
        pkceVerifierDigest: 'verifier',
        sealedSecrets,
        redirectUri: 'https://app.hanselapp.io/auth/callback/google',
        expiresAt: new Date('2026-08-30T00:10:00.000Z'),
      });
      const transaction =
        await prisma.externalAuthorizationTransaction.findFirstOrThrow({
          where: { sealedSecrets },
          orderBy: { createdAt: 'desc' },
        });
      const consume = () =>
        store.consumeTransaction({
          provider: 'google',
          stateDigest: transaction.stateDigest,
          now,
        });
      await expect(consume()).resolves.toMatchObject({ intent: 'login' });
      await expect(consume()).resolves.toBeNull();
    });
  },
);
