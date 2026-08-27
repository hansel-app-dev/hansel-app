import type { PrismaClient } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';

function digestsMatch(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export function createPrismaVerificationStore(prisma: PrismaClient) {
  return {
    async verify(input: { email: string; codeDigest: string; now: Date }) {
      return prisma.$transaction(async (transaction) => {
        const user = await transaction.user.findUnique({
          where: { email: input.email },
          select: {
            id: true,
            challenges: {
              where: { purpose: 'ONBOARDING_EMAIL' },
              orderBy: { sentAt: 'desc' },
              take: 1,
            },
          },
        });
        const challenge = user?.challenges[0];
        if (
          !user ||
          !challenge ||
          challenge.consumedAt ||
          challenge.expiresAt <= input.now ||
          challenge.failedAttempts >= 5
        )
          return false;

        if (!digestsMatch(challenge.codeDigest, input.codeDigest)) {
          await transaction.verificationChallenge.updateMany({
            where: {
              id: challenge.id,
              consumedAt: null,
              failedAttempts: challenge.failedAttempts,
            },
            data: { failedAttempts: { increment: 1 } },
          });
          return false;
        }

        const consumed = await transaction.verificationChallenge.updateMany({
          where: {
            id: challenge.id,
            codeDigest: input.codeDigest,
            consumedAt: null,
          },
          data: { consumedAt: input.now },
        });
        if (consumed.count !== 1) return false;
        await transaction.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: input.now },
        });
        await transaction.onboardingJourney.updateMany({
          where: { userId: user.id, currentStep: 'VERIFY_EMAIL' },
          data: { currentStep: 'PERSONAL_PROFILE' },
        });
        return true;
      });
    },

    async resend(input: {
      email: string;
      codeDigest: string;
      expiresAt: Date;
      now: Date;
    }) {
      return prisma.$transaction(async (transaction) => {
        const hourAgo = new Date(input.now.getTime() - 60 * 60 * 1000);
        const user = await transaction.user.findUnique({
          where: { email: input.email },
          select: {
            id: true,
            emailVerifiedAt: true,
            challenges: {
              where: { purpose: 'ONBOARDING_EMAIL', sentAt: { gte: hourAgo } },
              orderBy: { sentAt: 'desc' },
            },
          },
        });
        const latest = user?.challenges[0];
        if (
          !user ||
          user.emailVerifiedAt ||
          !latest ||
          user.challenges.length >= 5 ||
          input.now.getTime() - latest.sentAt.getTime() < 60_000
        )
          return false;

        await transaction.verificationChallenge.updateMany({
          where: {
            userId: user.id,
            purpose: 'ONBOARDING_EMAIL',
            consumedAt: null,
          },
          data: { consumedAt: input.now },
        });
        await transaction.verificationChallenge.create({
          data: {
            userId: user.id,
            purpose: 'ONBOARDING_EMAIL',
            codeDigest: input.codeDigest,
            expiresAt: input.expiresAt,
            sentAt: input.now,
          },
        });
        return true;
      });
    },
  };
}
