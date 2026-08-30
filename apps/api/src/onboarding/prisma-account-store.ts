import { Prisma, type PrismaClient } from '@prisma/client';
import type { CreateOnboardingAccountResponse } from '@hansel/contracts';
import type { PendingAccount } from './create-account.js';

export function createPrismaPendingAccountStore(prisma: PrismaClient) {
  return async function storePendingAccount(input: PendingAccount): Promise<{
    shouldSend: boolean;
    nextStep: CreateOnboardingAccountResponse['nextStep'];
  }> {
    try {
      return await prisma.$transaction(async (transaction) => {
        await transaction.user.create({
          data: {
            email: input.email,
            password: { create: { passwordHash: input.passwordHash } },
            consents: {
              create: {
                termsVersion: input.termsVersion,
                privacyVersion: input.privacyVersion,
                onboardingPath: 'new-organization',
                country: 'unknown',
                consentedAt: input.consentedAt,
              },
            },
            challenges: {
              create: {
                purpose: 'ONBOARDING_EMAIL',
                codeDigest: input.verificationCodeDigest,
                expiresAt: input.verificationExpiresAt,
                sentAt: input.consentedAt,
              },
            },
            journeys: {
              create: {
                entryPath: 'NEW_ORGANIZATION',
                currentStep: 'VERIFY_EMAIL',
              },
            },
          },
        });
        return { shouldSend: true, nextStep: 'verify-email' as const };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { shouldSend: false, nextStep: 'login' as const };
      }
      throw error;
    }
  };
}
