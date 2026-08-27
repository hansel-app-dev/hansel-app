import { SESv2Client } from '@aws-sdk/client-sesv2';
import { PrismaClient } from '@prisma/client';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createConsoleVerificationSender } from './onboarding/console-verification-sender.js';
import { createAccountRegistration } from './onboarding/create-account.js';
import { createPrismaPendingAccountStore } from './onboarding/prisma-account-store.js';
import { createPrismaVerificationStore } from './onboarding/prisma-verification-store.js';
import { createOnboardingSecurity } from './onboarding/security.js';
import { createSesVerificationSender } from './onboarding/ses-verification-sender.js';
import { createEmailVerification } from './onboarding/verify-email.js';

const config = loadConfig();
const prisma = new PrismaClient();
const security = createOnboardingSecurity(config);
let ses: SESv2Client | undefined;
let sendVerificationCode: (email: string, code: string) => Promise<void>;
if (config.emailDeliveryMode === 'ses') {
  ses = new SESv2Client({ region: config.awsRegion });
  sendVerificationCode = createSesVerificationSender(ses, config.sesFromEmail);
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
      ses?.destroy();
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
