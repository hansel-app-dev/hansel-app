import { PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import {
  createDiscovery,
  createDiscoveryDigests,
} from '../src/onboarding/discovery.js';
import { createPrismaDiscoveryStore } from '../src/onboarding/prisma-discovery-store.js';
import { createOnboardingSecurity } from '../src/onboarding/security.js';

export async function seedDiscoveryJourney() {
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
  const credential = security.createOnboardingCredential();
  const csrfProof = security.createOnboardingCsrfProof(credential);
  const testId = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `discovery-no-js-${testId}@example.com`,
      emailVerifiedAt: new Date(),
      continuation: {
        create: {
          credentialDigest: security.digestOnboardingCredential(credential),
          expiresAt: new Date(Date.now() + 60_000),
        },
      },
    },
  });
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Hansel E2E',
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
      currentStep: 'DISCOVERY',
    },
  });
  const feature = createDiscovery({
    ...createPrismaDiscoveryStore(prisma),
    ...createDiscoveryDigests('e2e-verification-digest-key'),
    createSubmissionKey: () => randomBytes(32).toString('base64url'),
    digestOnboardingCredential: (value) =>
      security.digestOnboardingCredential(value),
    verifyOnboardingCsrfProof: (value, proof) =>
      security.verifyOnboardingCsrfProof(value, proof),
    now: () => new Date(),
    recordEvent: () => undefined,
  });
  const baseUrl = 'http://127.0.0.1:3013';
  const server = createApp(
    { allowedOrigin: baseUrl, discoveryEnabled: true },
    undefined,
    {
      createAccount: () =>
        Promise.resolve({ nextStep: 'verify-email' as const }),
      verifyEmail: () =>
        Promise.resolve({
          nextStep: 'personal-profile' as const,
          onboardingCredential: '',
          csrfProof: '',
        }),
      resendVerification: () =>
        Promise.resolve({ status: 'accepted' as const }),
      submitPersonalProfile: () =>
        Promise.resolve({
          nextStep: 'plan-selection' as const,
          onboardingCredential: '',
          csrfProof: '',
        }),
      loadDiscovery: feature.load.bind(feature),
      completeDiscovery: feature.complete.bind(feature),
    },
  ).listen(3013);
  return {
    baseUrl,
    credential,
    csrfProof,
    assertPersisted: async () =>
      prisma.onboardingJourney.findUnique({
        where: { id: journey.id },
        include: { discoveryResponse: true },
      }),
    disconnect: async () => {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        }),
      );
      await prisma.$disconnect();
    },
  };
}
