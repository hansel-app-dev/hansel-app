import { Prisma, type PrismaClient } from '@prisma/client';
import type { PendingAccount } from './create-account.js';
import { createPrismaVerificationStore } from './prisma-verification-store.js';

export function createPrismaPendingAccountStore(prisma: PrismaClient) {
  return async function storePendingAccount(
    input: PendingAccount,
  ): Promise<{ shouldSend: boolean }> {
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
        return { shouldSend: true };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const shouldSend = await createPrismaVerificationStore(prisma).resend({
          email: input.email,
          codeDigest: input.verificationCodeDigest,
          expiresAt: input.verificationExpiresAt,
          now: input.consentedAt,
        });
        return { shouldSend };
      }
      throw error;
    }
  };
}
