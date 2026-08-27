import { PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import {
  createOrganizationProfile,
  createOrganizationProfileDigests,
} from '../src/onboarding/organization-profile.js';
import { createPrismaOrganizationProfileStore } from '../src/onboarding/prisma-organization-profile-store.js';
import { createOnboardingSecurity } from '../src/onboarding/security.js';

export async function seedOrganizationProfileJourney() {
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
      email: `organization-no-js-${testId}@example.com`,
      emailVerifiedAt: new Date(),
      planSelection: {
        create: {
          planId: 'free',
          priceId: 'free',
          billingInterval: null,
          amountMinor: 0,
          currency: 'USD',
          paymentRequired: false,
          maximumSites: 1,
          catalogVersion: 'e2e',
          selectedAt: new Date(),
        },
      },
      journeys: {
        create: {
          entryPath: 'NEW_ORGANIZATION',
          currentStep: 'ORGANIZATION_PROFILE',
        },
      },
      continuation: {
        create: {
          credentialDigest: security.digestOnboardingCredential(credential),
          expiresAt: new Date(Date.now() + 60_000),
        },
      },
    },
  });
  const feature = createOrganizationProfile({
    ...createPrismaOrganizationProfileStore(prisma),
    ...createOrganizationProfileDigests('e2e-verification-digest-key'),
    createSubmissionKey: () => randomBytes(32).toString('base64url'),
    digestOnboardingCredential: (value) =>
      security.digestOnboardingCredential(value),
    deriveOnboardingCredential: (value, key) =>
      security.deriveOnboardingCredential(value, key),
    createOnboardingCsrfProof: (value) =>
      security.createOnboardingCsrfProof(value),
    verifyOnboardingCsrfProof: (value, proof) =>
      security.verifyOnboardingCsrfProof(value, proof),
    now: () => new Date(),
    recordEvent: () => undefined,
  });
  const baseUrl = 'http://127.0.0.1:3012';
  const server = createApp(
    { allowedOrigin: baseUrl, organizationProfileEnabled: true },
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
      loadOrganizationProfile: feature.load.bind(feature),
      submitOrganizationProfile: feature.submit.bind(feature),
    },
  ).listen(3012);
  return {
    baseUrl,
    credential,
    csrfProof,
    assertPersisted: async () => {
      const membership = await prisma.membership.findFirst({
        where: { userId: user.id, roleId: 'owner' },
        include: { tenant: true },
      });
      return membership?.tenant.name;
    },
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
