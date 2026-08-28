import { PrismaClient } from '@prisma/client';
import { Logger } from '@aws-lambda-powertools/logger';
import { Resend } from 'resend';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createConsoleVerificationSender } from './onboarding/console-verification-sender.js';
import { createAccountRegistration } from './onboarding/create-account.js';
import { createPrismaPendingAccountStore } from './onboarding/prisma-account-store.js';
import { createPrismaVerificationStore } from './onboarding/prisma-verification-store.js';
import { createResendVerificationSender } from './onboarding/resend-verification-sender.js';
import { createOnboardingSecurity } from './onboarding/security.js';
import { createEmailVerification } from './onboarding/verify-email.js';
import {
  createPersonalProfile,
  createPersonalProfileLoader,
} from './onboarding/personal-profile.js';
import {
  createPrismaPersonalProfileLoader,
  createPrismaPersonalProfileStore,
} from './onboarding/prisma-personal-profile-store.js';
import { loadPlanCatalog } from './onboarding/plan-catalog.js';
import { createPlanSelection } from './onboarding/plan-selection.js';
import { createPrismaPlanSelectionStore } from './onboarding/prisma-plan-selection-store.js';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  createOrganizationProfile,
  createOrganizationProfileDigests,
} from './onboarding/organization-profile.js';
import { createPrismaOrganizationProfileStore } from './onboarding/prisma-organization-profile-store.js';
import {
  createDiscovery,
  createDiscoveryDigests,
} from './onboarding/discovery.js';
import { createPrismaDiscoveryStore } from './onboarding/prisma-discovery-store.js';

const config = loadConfig();
const logger = new Logger({ serviceName: 'hansel-api' });
const prisma = new PrismaClient();
const security = createOnboardingSecurity(config);
let sendVerificationCode: (email: string, code: string) => Promise<void>;
if (config.emailDeliveryMode === 'resend') {
  const resend = new Resend(config.resendApiKey);
  sendVerificationCode = createResendVerificationSender(
    resend,
    config.resendFromEmail,
  );
} else {
  sendVerificationCode = createConsoleVerificationSender();
}
const verification = createEmailVerification({
  ...security,
  ...createPrismaVerificationStore(prisma),
  sendVerificationCode,
  now: () => new Date(),
});
let planCatalog;
try {
  planCatalog = loadPlanCatalog(config.runtimeEnvironment);
} catch (error) {
  logger.error('plan_catalog_validation_failed', { error });
  throw error;
}
const planSelectionStore = createPrismaPlanSelectionStore(prisma);
const organizationProfileDigests = createOrganizationProfileDigests(
  config.verificationDigestKey,
);
const discoveryDigests = createDiscoveryDigests(config.verificationDigestKey);
const onboarding = {
  createAccount: createAccountRegistration({
    ...security,
    storePendingAccount: createPrismaPendingAccountStore(prisma),
    sendVerificationCode,
    now: () => new Date(),
  }),
  loadPersonalProfile: createPersonalProfileLoader({
    load: createPrismaPersonalProfileLoader(prisma),
    digestOnboardingCredential: (credential) =>
      security.digestOnboardingCredential(credential),
    now: () => new Date(),
  }),
  submitPersonalProfile: createPersonalProfile({
    save: createPrismaPersonalProfileStore(prisma),
    digestOnboardingCredential: (credential) =>
      security.digestOnboardingCredential(credential),
    createOnboardingCredential: () => security.createOnboardingCredential(),
    createOnboardingCsrfProof: (credential) =>
      security.createOnboardingCsrfProof(credential),
    verifyOnboardingCsrfProof: (credential, proof) =>
      security.verifyOnboardingCsrfProof(credential, proof),
    now: () => new Date(),
  }),
  ...createPlanSelection({
    catalog: planCatalog,
    contactSalesDestination: config.contactSalesDestination,
    ...planSelectionStore,
    createOnboardingCredential: () => security.createOnboardingCredential(),
    digestOnboardingCredential: (credential) =>
      security.digestOnboardingCredential(credential),
    createOnboardingCsrfProof: (credential) =>
      security.createOnboardingCsrfProof(credential),
    verifyOnboardingCsrfProof: (credential, proof) =>
      security.verifyOnboardingCsrfProof(credential, proof),
    now: () => new Date(),
    recordEvent: (name, details) => {
      logger.info(name, { ...details });
    },
  }),
  ...(() => {
    const feature = createOrganizationProfile({
      ...createPrismaOrganizationProfileStore(prisma),
      ...organizationProfileDigests,
      createSubmissionKey: () => randomBytes(32).toString('base64url'),
      digestOnboardingCredential: (credential) =>
        security.digestOnboardingCredential(credential),
      deriveOnboardingCredential: (credential, submissionKey) =>
        security.deriveOnboardingCredential(credential, submissionKey),
      createOnboardingCsrfProof: (credential) =>
        security.createOnboardingCsrfProof(credential),
      verifyOnboardingCsrfProof: (credential, proof) =>
        security.verifyOnboardingCsrfProof(credential, proof),
      now: () => new Date(),
      recordEvent: (name) => {
        logger.info(name, { correlationId: randomUUID() });
      },
    });
    return {
      loadOrganizationProfile: feature.load.bind(feature),
      submitOrganizationProfile: feature.submit.bind(feature),
      recordOrganizationProfileEvent: (name: string) => {
        logger.info(name, { correlationId: randomUUID() });
      },
    };
  })(),
  ...(() => {
    const feature = createDiscovery({
      ...createPrismaDiscoveryStore(prisma),
      ...discoveryDigests,
      createSubmissionKey: () => randomBytes(32).toString('base64url'),
      digestOnboardingCredential: (credential) =>
        security.digestOnboardingCredential(credential),
      verifyOnboardingCsrfProof: (credential, proof) =>
        security.verifyOnboardingCsrfProof(credential, proof),
      now: () => new Date(),
      recordEvent: (name) => {
        logger.info(name, { correlationId: randomUUID() });
      },
    });
    return {
      loadDiscovery: feature.load.bind(feature),
      completeDiscovery: feature.complete.bind(feature),
      recordDiscoveryEvent: (name: string) => {
        logger.info(name, { correlationId: randomUUID() });
      },
    };
  })(),
  ...verification,
};
const server = createApp(config, undefined, onboarding).listen(
  config.port,
  () => {
    console.log(
      JSON.stringify({
        level: 'INFO',
        message: 'API listening',
        port: config.port,
      }),
    );
  },
);

function shutdown(signal: string): void {
  console.log(
    JSON.stringify({ level: 'INFO', message: 'Shutting down', signal }),
  );
  server.close((error) => {
    void prisma.$disconnect().finally(() => {
      process.exitCode = error ? 1 : 0;
    });
  });
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
