import { PrismaClient } from '@prisma/client';
import { Logger } from '@aws-lambda-powertools/logger';
import { Resend } from 'resend';
import {
  createApp,
  type AuthenticationModule,
  type SitesModule,
} from './app.js';
import { dashboardUrl, loadConfig, passwordResetUrl } from './config.js';
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
import { createDashboardSession } from './dashboard/session.js';
import { createPrismaDashboardSessionStore } from './dashboard/prisma-session-store.js';
import {
  createConsoleWelcomeSender,
  createResendWelcomeSender,
  type WelcomeEmailInput,
} from './onboarding/welcome-email.js';
import { createWelcomeEmailDispatcher } from './onboarding/welcome-email-dispatcher.js';
import { createPrismaWelcomeEmailStore } from './onboarding/prisma-welcome-email-store.js';
import { createWelcomeEmailWorker } from './onboarding/welcome-email-worker.js';
import { configureDatabaseUrl } from './database-url.js';
import { readFileSync } from 'node:fs';
import { createPasswordLogin } from './auth/password-login.js';
import { createPrismaPasswordLoginStore } from './auth/prisma-password-login-store.js';
import { createExternalAuthSecurity } from './auth/external-auth-security.js';
import {
  createExternalLogin,
  type ExternalProvider,
} from './auth/external-login.js';
import { createPrismaExternalLoginStore } from './auth/prisma-external-login-store.js';
import { createOpenIdProviderAdapter } from './auth/openid-provider.js';
import { createAppleClientSecret } from './auth/apple-client-secret.js';
import {
  createConsolePasswordLockSender,
  createResendPasswordLockSender,
} from './auth/password-lock-email.js';
import { createPasswordLockEmailDispatcher } from './auth/password-lock-email-dispatcher.js';
import { createPrismaPasswordLockEmailStore } from './auth/prisma-password-lock-email-store.js';
import { createPasswordLockEmailWorker } from './auth/password-lock-email-worker.js';
import { createPasswordRecovery } from './auth/password-recovery.js';
import { createPrismaPasswordRecoveryStore } from './auth/prisma-password-recovery-store.js';
import {
  createConsolePasswordRecoverySender,
  createResendPasswordRecoverySender,
  type PasswordRecoveryEmailInput,
} from './auth/password-recovery-email.js';
import {
  createConsolePasswordResetNotificationSender,
  createResendPasswordResetNotificationSender,
} from './auth/password-reset-notification-email.js';
import { createPasswordResetNotificationDispatcher } from './auth/password-reset-notification-dispatcher.js';
import { createPrismaPasswordResetNotificationStore } from './auth/prisma-password-reset-notification-store.js';
import { createSitesFeature } from './sites/sites.js';
import { createPrismaSitesStore } from './sites/prisma-sites-store.js';
import {
  createConsoleSiteInvitationSender,
  createResendSiteInvitationSender,
  type SiteInvitationEmailInput,
} from './sites/site-invitation-email.js';
import { createPrismaSiteInvitationStore } from './sites/prisma-site-invitation-store.js';
import { createSiteInvitationDispatcher } from './sites/site-invitation-dispatcher.js';
import { createSiteInvitationWorker } from './sites/site-invitation-worker.js';
import { createAllocationPlansFeature } from './sites/allocation-plans.js';
import { createPrismaAllocationPlanStore } from './sites/prisma-allocation-plan-store.js';
import { createS3AllocationPlanObjectStore } from './sites/s3-allocation-plan-object-store.js';

configureDatabaseUrl();
const config = loadConfig();
const logger = new Logger({ serviceName: 'hansel-api' });
const prisma = new PrismaClient();
const security = createOnboardingSecurity(config);
const approvedLogoSvg = readFileSync(
  new URL('../../web/public/assets/hansel-logo-beta.svg', import.meta.url),
  'utf8',
);
let sendVerificationCode: (email: string, code: string) => Promise<void>;
let sendWelcomeEmail: (input: WelcomeEmailInput) => Promise<string>;
let sendPasswordLockEmail: (input: {
  recipient: string;
  intentId: string;
}) => Promise<string>;
let sendPasswordRecoveryEmail: (
  input: PasswordRecoveryEmailInput,
) => Promise<void>;
let sendPasswordResetNotification: (input: {
  recipient: string;
  intentId: string;
}) => Promise<string>;
let sendSiteInvitation: (input: SiteInvitationEmailInput) => Promise<string>;
if (config.emailDeliveryMode === 'resend') {
  const resend = new Resend(config.resendApiKey);
  sendVerificationCode = createResendVerificationSender(
    resend,
    config.resendFromEmail,
  );
  sendWelcomeEmail = createResendWelcomeSender(
    resend,
    config.resendFromEmail,
    dashboardUrl(config),
    approvedLogoSvg,
  );
  sendPasswordLockEmail = createResendPasswordLockSender(
    resend,
    config.resendFromEmail,
  );
  sendPasswordRecoveryEmail = createResendPasswordRecoverySender(
    resend,
    config.resendFromEmail,
    passwordResetUrl(config),
    approvedLogoSvg,
  );
  sendPasswordResetNotification = createResendPasswordResetNotificationSender(
    resend,
    config.resendFromEmail,
  );
  sendSiteInvitation = createResendSiteInvitationSender(
    resend,
    config.resendFromEmail,
    config.allowedOrigin,
  );
} else {
  sendVerificationCode = createConsoleVerificationSender();
  sendWelcomeEmail = createConsoleWelcomeSender((name, details) => {
    logger.info(name, details);
  });
  sendPasswordLockEmail = createConsolePasswordLockSender((name) => {
    logger.info(name, { correlationId: randomUUID() });
  });
  sendPasswordRecoveryEmail = createConsolePasswordRecoverySender((name) => {
    logger.info(name, { correlationId: randomUUID() });
  });
  sendPasswordResetNotification = createConsolePasswordResetNotificationSender(
    (name) => {
      logger.info(name, { correlationId: randomUUID() });
    },
  );
  sendSiteInvitation = createConsoleSiteInvitationSender((name, details) => {
    logger.info(name, { correlationId: details.invitationId });
  });
}
const verification = createEmailVerification({
  ...security,
  ...createPrismaVerificationStore(prisma),
  sendVerificationCode,
  now: () => new Date(),
});
const passwordRecovery = createPasswordRecovery({
  ...createPrismaPasswordRecoveryStore(prisma, (name, details) => {
    logger.info(name, { correlationId: randomUUID(), ...details });
  }),
  createCode: () => security.createVerificationCode(),
  digestCode: (code) => security.digestVerificationCode(code),
  digestIdentifier: (email) => security.digestPasswordRecoveryIdentifier(email),
  hashPassword: (password) => security.hashPassword(password),
  passwordPepperVersion: 1,
  sendResetEmail: sendPasswordRecoveryEmail,
  schedule: (task) => {
    queueMicrotask(task);
  },
  now: () => new Date(),
  recordEvent: (name) => {
    logger.info(name, { correlationId: randomUUID() });
  },
});
const authentication: AuthenticationModule = {
  login: createPasswordLogin({
    ...createPrismaPasswordLoginStore(prisma),
    verifyPassword: (passwordHash, password) =>
      security.verifyPassword(passwordHash, password),
    dummyPasswordHash: await security.hashPassword(
      randomBytes(32).toString('base64url'),
    ),
    requestVerification: async (email) => {
      await verification.resendVerification({ email });
    },
    createApplicationCredential: () => security.createApplicationCredential(),
    digestApplicationCredential: (credential) =>
      security.digestApplicationCredential(credential),
    createOnboardingCredential: () => security.createOnboardingCredential(),
    digestOnboardingCredential: (credential) =>
      security.digestOnboardingCredential(credential),
    createOnboardingCsrfProof: (credential) =>
      security.createOnboardingCsrfProof(credential),
    now: () => new Date(),
    recordEvent: (name) => {
      logger.info(name, { correlationId: randomUUID() });
    },
  }),
  requestPasswordRecovery: (input) => passwordRecovery.request(input),
  resetPassword: (input) => passwordRecovery.reset(input),
  recordEvent: (name) => {
    logger.error(name, { correlationId: randomUUID() });
  },
};
if (config.externalAuthEnabled && config.externalAuth) {
  const externalSecurity = createExternalAuthSecurity(
    config.externalAuth.transactionKey,
  );
  const appleClientSecret = await createAppleClientSecret({
    ...config.externalAuth.apple,
    now: new Date(),
  });
  const callbackUris: Record<ExternalProvider, string> = {
    google: config.externalAuth.google.callbackUri,
    microsoft: config.externalAuth.microsoft.callbackUri,
    apple: config.externalAuth.apple.callbackUri,
  };
  const externalLogin = createExternalLogin({
    ...externalSecurity,
    ...createPrismaExternalLoginStore(prisma),
    providers: {
      google: createOpenIdProviderAdapter({
        issuer: 'https://accounts.google.com',
        clientId: config.externalAuth.google.clientId,
        clientSecret: config.externalAuth.google.clientSecret,
        scope: 'openid email profile',
        usePkce: true,
      }),
      microsoft: createOpenIdProviderAdapter({
        issuer: `https://login.microsoftonline.com/${config.externalAuth.microsoft.tenantId}/v2.0`,
        clientId: config.externalAuth.microsoft.clientId,
        clientSecret: config.externalAuth.microsoft.clientSecret,
        scope: 'openid email profile',
        usePkce: true,
      }),
      apple: createOpenIdProviderAdapter({
        issuer: 'https://appleid.apple.com',
        clientId: config.externalAuth.apple.clientId,
        clientSecret: appleClientSecret,
        scope: 'name email',
        usePkce: false,
        responseMode: 'form_post',
      }),
    },
    callbackUri: (provider) => callbackUris[provider],
    createApplicationCredential: () => security.createApplicationCredential(),
    digestApplicationCredential: (credential) =>
      security.digestApplicationCredential(credential),
    createOnboardingCredential: () => security.createOnboardingCredential(),
    digestOnboardingCredential: (credential) =>
      security.digestOnboardingCredential(credential),
    createOnboardingCsrfProof: (credential) =>
      security.createOnboardingCsrfProof(credential),
    now: () => new Date(),
    recordEvent: (name) => {
      logger.info(name, { correlationId: randomUUID() });
    },
  });
  authentication.startExternal = (provider, intent) =>
    externalLogin.start(provider, intent);
  authentication.callbackExternal = (provider, parameters) => {
    const callbackUrl = new URL(callbackUris[provider]);
    for (const [key, value] of Object.entries(parameters))
      callbackUrl.searchParams.set(key, value);
    return externalLogin.callback(provider, callbackUrl);
  };
}
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
      ...createPrismaDiscoveryStore(
        prisma,
        config.welcomeEmailEnabled,
        (name, details) => {
          logger.info(name, details);
        },
      ),
      ...discoveryDigests,
      createSubmissionKey: () => randomBytes(32).toString('base64url'),
      digestOnboardingCredential: (credential) =>
        security.digestOnboardingCredential(credential),
      createApplicationCredential: () => security.createApplicationCredential(),
      digestApplicationCredential: (credential) =>
        security.digestApplicationCredential(credential),
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
const dashboard = createDashboardSession({
  ...createPrismaDashboardSessionStore(prisma, (name) => {
    logger.info(name, { correlationId: randomUUID() });
  }),
  createCredential: () => security.createApplicationCredential(),
  digestCredential: (credential) =>
    security.digestApplicationCredential(credential),
  now: () => new Date(),
  recordEvent: (name) => {
    logger.info(name, { correlationId: randomUUID() });
  },
});
const sitesStore = createPrismaSitesStore(
  prisma,
  (value) => security.digestApplicationCredential(value),
  randomUUID,
);
const sitesFeature = createSitesFeature({
  ...sitesStore,
  createId: randomUUID,
  createInvitationToken: (invitationId, expiresAt) =>
    security.createSiteInvitationToken(invitationId, expiresAt),
  digestRequest: (request) =>
    security.digestApplicationCredential(
      `site-request:${JSON.stringify(request)}`,
    ),
  now: () => new Date(),
});
const allocationPlansFeature = createAllocationPlansFeature({
  store: createPrismaAllocationPlanStore(prisma),
  objects: createS3AllocationPlanObjectStore({
    bucketName: config.allocationPlansBucketName ?? 'allocation-plans-disabled',
  }),
  createId: randomUUID,
  digest: (value) => security.digestApplicationCredential(value),
  now: () => new Date(),
});
const resolveSitePrincipal = (credential: string) =>
  sitesStore.resolvePrincipal(
    security.digestApplicationCredential(credential),
    new Date(),
  );
const sites: SitesModule = {
  async load(credential) {
    const principal = await resolveSitePrincipal(credential);
    return principal ? sitesFeature.load(principal) : null;
  },
  async create(credential, input) {
    const principal = await resolveSitePrincipal(credential);
    return principal ? sitesFeature.create(principal, input) : null;
  },
  async activity(credential, siteId) {
    const principal = await resolveSitePrincipal(credential);
    return principal ? sitesFeature.activity(principal, siteId) : null;
  },
  async listAllocationPlans(credential, siteId) {
    const principal = await resolveSitePrincipal(credential);
    return principal ? allocationPlansFeature.list(principal, siteId) : null;
  },
  async loadAllocationPlanContent(credential, siteId, planId) {
    const principal = await resolveSitePrincipal(credential);
    return principal
      ? allocationPlansFeature.content(principal, siteId, planId)
      : null;
  },
  async createAllocationPlanUploadBatch(credential, siteId, input) {
    const principal = await resolveSitePrincipal(credential);
    return principal
      ? allocationPlansFeature.createBatch(principal, siteId, input)
      : null;
  },
  async finalizeAllocationPlanUpload(credential, siteId, uploadId) {
    const principal = await resolveSitePrincipal(credential);
    return principal
      ? allocationPlansFeature.finalize(principal, siteId, uploadId)
      : null;
  },
  recordEvent: (name) => {
    logger.info(name, { correlationId: randomUUID() });
  },
};
const siteInvitationDispatcher = createSiteInvitationDispatcher({
  ...createPrismaSiteInvitationStore(prisma),
  createToken: (invitationId, expiresAt) =>
    security.createSiteInvitationToken(invitationId, expiresAt).token,
  send: sendSiteInvitation,
  workerId: randomUUID(),
  now: () => new Date(),
  jitter: Math.random,
  recordEvent: (name, details) => {
    logger.info(name, { correlationId: details.deliveryId, ...details });
  },
});
const siteInvitationWorker = createSiteInvitationWorker({
  runOnce: () => siteInvitationDispatcher.runOnce(),
  schedule: (callback, intervalMs) => setInterval(callback, intervalMs),
  cancel: (timer) => {
    clearInterval(timer as NodeJS.Timeout);
  },
  recordEvent: (name) => {
    logger.error(name, { correlationId: randomUUID() });
  },
});
if (config.sitesEnabled) siteInvitationWorker.start();
const welcomeEmailDispatcher = createWelcomeEmailDispatcher({
  ...createPrismaWelcomeEmailStore(prisma),
  send: sendWelcomeEmail,
  workerId: randomUUID(),
  now: () => new Date(),
  jitter: Math.random,
  recordEvent: (name, details) => {
    logger.info(name, { ...details });
  },
});
const welcomeEmailWorker = createWelcomeEmailWorker({
  runOnce: () => welcomeEmailDispatcher.runOnce(),
  schedule: (callback, intervalMs) => setInterval(callback, intervalMs),
  cancel: (timer) => {
    clearInterval(timer as NodeJS.Timeout);
  },
  intervalMs: 1_000,
  recordEvent: (name) => {
    logger.error(name, { correlationId: randomUUID() });
  },
});
if (config.welcomeEmailEnabled) welcomeEmailWorker.start();
const passwordLockEmailDispatcher = createPasswordLockEmailDispatcher({
  ...createPrismaPasswordLockEmailStore(prisma),
  send: sendPasswordLockEmail,
  workerId: randomUUID(),
  now: () => new Date(),
  recordEvent: (name) => {
    logger.info(name, { correlationId: randomUUID() });
  },
});
const passwordLockEmailWorker = createPasswordLockEmailWorker({
  runOnce: () => passwordLockEmailDispatcher.runOnce(),
  schedule: (callback, intervalMs) => setInterval(callback, intervalMs),
  cancel: (timer) => {
    clearInterval(timer as NodeJS.Timeout);
  },
  recordEvent: (name) => {
    logger.error(name, { correlationId: randomUUID() });
  },
});
if (config.loginEnabled) passwordLockEmailWorker.start();
const passwordResetNotificationDispatcher =
  createPasswordResetNotificationDispatcher({
    ...createPrismaPasswordResetNotificationStore(prisma),
    send: sendPasswordResetNotification,
    workerId: randomUUID(),
    now: () => new Date(),
    recordEvent: (name, details) => {
      logger.info(name, { correlationId: randomUUID(), ...details });
    },
  });
const passwordResetNotificationWorker = createPasswordLockEmailWorker({
  runOnce: () => passwordResetNotificationDispatcher.runOnce(),
  schedule: (callback, intervalMs) => setInterval(callback, intervalMs),
  cancel: (timer) => {
    clearInterval(timer as NodeJS.Timeout);
  },
  failureEvent: 'password_reset_notification_worker_failure',
  recordEvent: (name) => {
    logger.error(name, { correlationId: randomUUID() });
  },
});
if (config.passwordRecoveryEnabled) passwordResetNotificationWorker.start();
const server = createApp(
  config,
  undefined,
  onboarding,
  {
    ...dashboard,
    recordEvent: (name) => {
      logger.info(name, { correlationId: randomUUID() });
    },
  },
  authentication,
  sites,
).listen(config.port, () => {
  console.log(
    JSON.stringify({
      level: 'INFO',
      message: 'API listening',
      port: config.port,
    }),
  );
});

function shutdown(signal: string): void {
  siteInvitationWorker.stop();
  welcomeEmailWorker.stop();
  passwordLockEmailWorker.stop();
  passwordResetNotificationWorker.stop();
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
