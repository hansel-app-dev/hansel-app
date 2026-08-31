import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createOnboardingSecurity } from '../onboarding/security.js';
import {
  createPasswordRecovery,
  PasswordResetRejectedError,
} from './password-recovery.js';
import { createPrismaPasswordRecoveryStore } from './prisma-password-recovery-store.js';

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
const now = new Date('2026-08-31T12:00:00.000Z');
const security = createOnboardingSecurity({
  passwordPepper: 'integration-password-pepper',
  verificationDigestKey: 'integration-verification-key',
});

async function seedRecoveryUser() {
  const suffix = randomUUID();
  const oldPassword = 'Original secure password!7A';
  const user = await prisma.user.create({
    data: {
      email: `recovery-${suffix}@example.com`,
      emailVerifiedAt: now,
      password: {
        create: { passwordHash: await security.hashPassword(oldPassword) },
      },
      personalProfile: {
        create: {
          firstName: 'Ava',
          lastName: 'Owner',
          jobTitle: 'owner',
          department: 'management',
        },
      },
      journeys: {
        create: {
          entryPath: 'NEW_ORGANIZATION',
          currentStep: 'COMPLETE',
          completedAt: now,
        },
      },
    },
  });
  const tenant = await prisma.tenant.create({
    data: {
      name: `Recovery ${suffix}`,
      country: 'AU',
      industry: 'healthcare',
      placeService: 'clinics',
      organizationSize: 'employees_1_10',
      memberships: { create: { userId: user.id, roleId: 'owner' } },
    },
  });
  return { user, tenant, oldPassword };
}

function recoveryService(at: Date, code = '123456') {
  return createPasswordRecovery({
    ...createPrismaPasswordRecoveryStore(prisma),
    createCode: () => code,
    digestCode: (value) => security.digestVerificationCode(value),
    digestIdentifier: (email) =>
      security.digestPasswordRecoveryIdentifier(email),
    hashPassword: (password) => security.hashPassword(password),
    passwordPepperVersion: 1,
    sendResetEmail: () => Promise.resolve(),
    schedule: (task) => {
      task();
    },
    now: () => at,
    recordEvent: () => undefined,
  });
}

integration(
  'PostgreSQL password recovery [password-recovery REQ-005..REQ-011, REQ-022]',
  () => {
    afterAll(() => prisma.$disconnect());

    it('enforces cooldown, replacement, unknown subject limits, and retention', async () => {
      const seeded = await seedRecoveryUser();
      const store = createPrismaPasswordRecoveryStore(prisma);
      const identifierDigest = security.digestPasswordRecoveryIdentifier(
        seeded.user.email,
      );
      const requestAt = async (
        at: Date,
        digest = identifierDigest,
        email = seeded.user.email,
      ) =>
        store.requestChallenge({
          email,
          identifierDigest: digest,
          codeDigest: security.digestVerificationCode('123456'),
          expiresAt: new Date(at.getTime() + 15 * 60_000),
          now: at,
        });

      await expect(requestAt(now)).resolves.toMatchObject({
        recipient: seeded.user.email,
      });
      await expect(requestAt(new Date(now.getTime() + 30_000))).resolves.toBe(
        false,
      );
      await expect(
        requestAt(new Date(now.getTime() + 60_000)),
      ).resolves.toMatchObject({ recipient: seeded.user.email });
      await expect(
        prisma.verificationChallenge.count({
          where: {
            userId: seeded.user.id,
            purpose: 'PASSWORD_RECOVERY',
            consumedAt: null,
          },
        }),
      ).resolves.toBe(1);

      const unknownDigest = `unknown-${randomUUID()}`;
      const unknownEmail = `unknown-${randomUUID()}@example.com`;
      for (let index = 0; index < 4; index += 1)
        await expect(
          requestAt(
            new Date(now.getTime() + index * 60_000),
            unknownDigest,
            unknownEmail,
          ),
        ).resolves.toBe(false);
      await expect(
        prisma.passwordRecoveryInitiation.count({
          where: { identifierDigest: unknownDigest },
        }),
      ).resolves.toBe(3);

      await prisma.passwordRecoveryInitiation.create({
        data: {
          identifierDigest: `expired-${randomUUID()}`,
          requestedAt: new Date(now.getTime() - 31 * 24 * 60 * 60_000),
          expiresAt: new Date(now.getTime() - 24 * 60 * 60_000),
        },
      });
      await requestAt(new Date(now.getTime() + 60 * 60_000));
      await expect(
        prisma.passwordRecoveryInitiation.count({
          where: { expiresAt: { lte: now } },
        }),
      ).resolves.toBe(0);
    });

    it('has one concurrent winner and atomically replaces access without tenant mutation', async () => {
      const seeded = await seedRecoveryUser();
      await prisma.passwordAuthenticationState.create({
        data: {
          userId: seeded.user.id,
          failedAttempts: 5,
          windowStartedAt: now,
          lockedUntil: new Date(now.getTime() + 15 * 60_000),
        },
      });
      await prisma.applicationSessionFamily.create({
        data: {
          userId: seeded.user.id,
          tenantId: seeded.tenant.id,
          absoluteExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60_000),
        },
      });
      await prisma.onboardingContinuation.create({
        data: {
          userId: seeded.user.id,
          credentialDigest: `continuation-${randomUUID()}`,
          expiresAt: new Date(now.getTime() + 15 * 60_000),
        },
      });
      const service = recoveryService(now);
      await service.request({ email: seeded.user.email });
      const newPassword = 'Replacement secure password!8B';
      const results = await Promise.allSettled([
        service.reset({
          email: seeded.user.email,
          code: '123456',
          password: newPassword,
        }),
        service.reset({
          email: seeded.user.email,
          code: '123456',
          password: newPassword,
        }),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
      expect(
        results.find((result) => result.status === 'rejected'),
      ).toMatchObject({
        reason: expect.any(PasswordResetRejectedError),
      });

      const credential = await prisma.passwordCredential.findUniqueOrThrow({
        where: { userId: seeded.user.id },
      });
      await expect(
        security.verifyPassword(credential.passwordHash, newPassword),
      ).resolves.toBe(true);
      await expect(
        security.verifyPassword(credential.passwordHash, seeded.oldPassword),
      ).resolves.toBe(false);
      await expect(
        prisma.passwordAuthenticationState.findUniqueOrThrow({
          where: { userId: seeded.user.id },
        }),
      ).resolves.toMatchObject({
        failedAttempts: 0,
        windowStartedAt: null,
        lockedUntil: null,
      });
      await expect(
        prisma.applicationSessionFamily.findFirstOrThrow({
          where: { userId: seeded.user.id },
        }),
      ).resolves.toMatchObject({
        revokedAt: now,
        revocationReason: 'password_recovery',
      });
      await expect(
        prisma.onboardingContinuation.count({
          where: { userId: seeded.user.id },
        }),
      ).resolves.toBe(0);
      await expect(
        prisma.passwordRecoveryNotificationIntent.count({
          where: { userId: seeded.user.id },
        }),
      ).resolves.toBe(1);
      await expect(
        prisma.membership.findFirstOrThrow({
          where: { userId: seeded.user.id },
        }),
      ).resolves.toMatchObject({ tenantId: seeded.tenant.id, roleId: 'owner' });
      await expect(
        prisma.personalProfile.findUniqueOrThrow({
          where: { userId: seeded.user.id },
        }),
      ).resolves.toMatchObject({ firstName: 'Ava', lastName: 'Owner' });
    });

    it('rejects expired and five-failure challenges and rolls back notification conflicts', async () => {
      const seeded = await seedRecoveryUser();
      const store = createPrismaPasswordRecoveryStore(prisma);
      const expired = await prisma.verificationChallenge.create({
        data: {
          userId: seeded.user.id,
          purpose: 'PASSWORD_RECOVERY',
          codeDigest: security.digestVerificationCode('111111'),
          sentAt: new Date(now.getTime() - 20 * 60_000),
          expiresAt: new Date(now.getTime() - 5 * 60_000),
        },
      });
      await expect(
        store.resetPassword({
          email: seeded.user.email,
          codeDigest: security.digestVerificationCode('111111'),
          passwordHash: 'not-stored',
          pepperVersion: 1,
          now,
        }),
      ).resolves.toBe(false);
      await prisma.verificationChallenge.update({
        where: { id: expired.id },
        data: { consumedAt: now },
      });
      const current = await prisma.verificationChallenge.create({
        data: {
          userId: seeded.user.id,
          purpose: 'PASSWORD_RECOVERY',
          codeDigest: security.digestVerificationCode('222222'),
          sentAt: now,
          expiresAt: new Date(now.getTime() + 15 * 60_000),
        },
      });
      for (let attempt = 0; attempt < 5; attempt += 1)
        await expect(
          store.resetPassword({
            email: seeded.user.email,
            codeDigest: security.digestVerificationCode('000000'),
            passwordHash: 'not-stored',
            pepperVersion: 1,
            now,
          }),
        ).resolves.toBe(false);
      await expect(
        store.resetPassword({
          email: seeded.user.email,
          codeDigest: security.digestVerificationCode('222222'),
          passwordHash: 'not-stored',
          pepperVersion: 1,
          now,
        }),
      ).resolves.toBe(false);
      await expect(
        prisma.verificationChallenge.findUniqueOrThrow({
          where: { id: current.id },
        }),
      ).resolves.toMatchObject({ failedAttempts: 5 });

      const rollbackChallenge = await prisma.verificationChallenge.create({
        data: {
          userId: seeded.user.id,
          purpose: 'PASSWORD_RECOVERY',
          codeDigest: security.digestVerificationCode('333333'),
          sentAt: new Date(now.getTime() + 60_000),
          expiresAt: new Date(now.getTime() + 16 * 60_000),
        },
      });
      await prisma.passwordRecoveryNotificationIntent.create({
        data: {
          userId: seeded.user.id,
          resetChallengeId: rollbackChallenge.id,
          nextAttemptAt: now,
        },
      });
      const before = await prisma.passwordCredential.findUniqueOrThrow({
        where: { userId: seeded.user.id },
      });
      await expect(
        store.resetPassword({
          email: seeded.user.email,
          codeDigest: security.digestVerificationCode('333333'),
          passwordHash: 'must-roll-back',
          pepperVersion: 2,
          now: new Date(now.getTime() + 60_000),
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
      await expect(
        prisma.passwordCredential.findUniqueOrThrow({
          where: { userId: seeded.user.id },
        }),
      ).resolves.toMatchObject({
        passwordHash: before.passwordHash,
        pepperVersion: before.pepperVersion,
      });
      await expect(
        prisma.verificationChallenge.findUniqueOrThrow({
          where: { id: rollbackChallenge.id },
        }),
      ).resolves.toMatchObject({ consumedAt: null });
    });
  },
);
