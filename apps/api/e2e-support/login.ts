import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createOnboardingSecurity } from '../src/onboarding/security.js';

export async function seedLoginAccount(
  state: 'completed' | 'incomplete' | 'unverified' = 'completed',
) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url:
          process.env.E2E_DATABASE_URL ??
          'postgresql://hansel:hansel@127.0.0.1:5433/hansel?schema=public',
      },
    },
  });
  const security = createOnboardingSecurity({
    passwordPepper: 'e2e-password-pepper',
    verificationDigestKey: 'e2e-verification-digest-key',
  });
  const unique = randomUUID();
  const email = `login-${unique}@example.com`;
  const password = 'Correct password for Hansel!7';
  const user = await prisma.user.create({
    data: {
      email,
      emailVerifiedAt: state === 'unverified' ? null : new Date(),
      password: {
        create: { passwordHash: await security.hashPassword(password) },
      },
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
          currentStep:
            state === 'completed'
              ? 'COMPLETE'
              : state === 'unverified'
                ? 'VERIFY_EMAIL'
                : 'PERSONAL_PROFILE',
          completedAt: state === 'completed' ? new Date() : null,
        },
      },
    },
  });
  const tenant =
    state === 'completed'
      ? await prisma.tenant.create({
          data: {
            name: 'Hansel Login E2E',
            country: 'AU',
            industry: 'healthcare',
            placeService: 'clinics',
            organizationSize: 'employees_11_50',
            memberships: { create: { userId: user.id, roleId: 'owner' } },
          },
        })
      : null;
  return {
    email,
    password,
    readVerificationChallengeCount: () =>
      prisma.verificationChallenge.count({ where: { userId: user.id } }),
    disconnect: async () => {
      await prisma.user.delete({ where: { id: user.id } });
      if (tenant) await prisma.tenant.delete({ where: { id: tenant.id } });
      await prisma.$disconnect();
    },
  };
}
