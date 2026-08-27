import { PrismaClient } from '@prisma/client';
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
import { createPersonalProfile } from './onboarding/personal-profile.js';
import { createPrismaPersonalProfileStore } from './onboarding/prisma-personal-profile-store.js';

const config = loadConfig();
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
const onboarding = {
  createAccount: createAccountRegistration({
    ...security,
    storePendingAccount: createPrismaPendingAccountStore(prisma),
    sendVerificationCode,
    now: () => new Date(),
  }),
  submitPersonalProfile: createPersonalProfile({
    save: createPrismaPersonalProfileStore(prisma),
    digestOnboardingCredential: (credential) =>
      security.digestOnboardingCredential(credential),
    verifyOnboardingCsrfProof: (credential, proof) =>
      security.verifyOnboardingCsrfProof(credential, proof),
    now: () => new Date(),
  }),
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
