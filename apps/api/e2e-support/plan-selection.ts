import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createOnboardingSecurity } from '../src/onboarding/security.js';
import { createApp } from '../src/app.js';
import { loadPlanCatalog } from '../src/onboarding/plan-catalog.js';
import { createPlanSelection } from '../src/onboarding/plan-selection.js';
import { createPrismaPlanSelectionStore } from '../src/onboarding/prisma-plan-selection-store.js';

export async function seedPlanSelectionJourney() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://hansel:hansel@127.0.0.1:5433/hansel?schema=public',
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
  await prisma.user.create({
    data: {
      email: `plan-no-js-${testId}@example.com`,
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
        create: {
          credentialDigest: security.digestOnboardingCredential(credential),
          expiresAt: new Date(Date.now() + 60_000),
        },
      },
    },
  });
  const baseUrl = 'http://127.0.0.1:3011';
  const planSelection = createPlanSelection({
    catalog: loadPlanCatalog('test'),
    contactSalesDestination: 'https://sales.example.com/hansel',
    ...createPrismaPlanSelectionStore(prisma),
    createOnboardingCredential: () => security.createOnboardingCredential(),
    digestOnboardingCredential: (value) =>
      security.digestOnboardingCredential(value),
    createOnboardingCsrfProof: (value) =>
      security.createOnboardingCsrfProof(value),
    verifyOnboardingCsrfProof: (value, proof) =>
      security.verifyOnboardingCsrfProof(value, proof),
    now: () => new Date(),
    recordEvent: () => undefined,
  });
  const server = createApp({ allowedOrigin: baseUrl }, undefined, {
    createAccount: () => Promise.resolve({ nextStep: 'verify-email' as const }),
    verifyEmail: () =>
      Promise.resolve({
        nextStep: 'personal-profile' as const,
        onboardingCredential: '',
        csrfProof: '',
      }),
    resendVerification: () => Promise.resolve({ status: 'accepted' as const }),
    submitPersonalProfile: () =>
      Promise.resolve({
        nextStep: 'plan-selection' as const,
        onboardingCredential: '',
        csrfProof: '',
      }),
    ...planSelection,
  }).listen(3011);
  return {
    baseUrl,
    credential,
    csrfProof,
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
