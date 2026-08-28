import type { OnboardingStep, PrismaClient } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';

type VerificationNextStep =
  'personal-profile' | 'plan-selection' | 'organization-profile';

function toVerificationNextStep(
  step: OnboardingStep,
): VerificationNextStep | null {
  if (step === 'PERSONAL_PROFILE') return 'personal-profile';
  if (step === 'PLAN_SELECTION') return 'plan-selection';
  if (step === 'ORGANIZATION_PROFILE') return 'organization-profile';
  return null;
}

function digestsMatch(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

class VerificationTransitionRejected extends Error {}

export function createPrismaVerificationStore(prisma: PrismaClient) {
  return {
    async verify(input: {
      email: string;
      codeDigest: string;
      onboardingCredentialDigest: string;
      onboardingCredentialExpiresAt: Date;
      now: Date;
    }) {
      try {
        return await prisma.$transaction(async (transaction) => {
          const user = await transaction.user.findUnique({
            where: { email: input.email },
            select: {
              id: true,
              emailVerifiedAt: true,
              journeys: {
                where: {
                  entryPath: 'NEW_ORGANIZATION',
                  completedAt: null,
                },
                select: { currentStep: true },
              },
              challenges: {
                where: { purpose: 'ONBOARDING_EMAIL' },
                orderBy: { sentAt: 'desc' },
                take: 1,
              },
            },
          });
          const challenge = user?.challenges[0];
          const recoveryJourney = user?.journeys[0];
          const recoveryNextStep =
            user?.emailVerifiedAt &&
            user.journeys.length === 1 &&
            recoveryJourney
              ? toVerificationNextStep(recoveryJourney.currentStep)
              : null;
          if (
            !user ||
            !challenge ||
            (user.emailVerifiedAt && !recoveryNextStep) ||
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
          if (!recoveryNextStep) {
            await transaction.user.update({
              where: { id: user.id },
              data: { emailVerifiedAt: input.now },
            });
            const transition = await transaction.onboardingJourney.updateMany({
              where: { userId: user.id, currentStep: 'VERIFY_EMAIL' },
              data: { currentStep: 'PERSONAL_PROFILE' },
            });
            if (transition.count !== 1)
              throw new VerificationTransitionRejected();
          }
          await transaction.onboardingContinuation.upsert({
            where: { userId: user.id },
            create: {
              userId: user.id,
              credentialDigest: input.onboardingCredentialDigest,
              expiresAt: input.onboardingCredentialExpiresAt,
            },
            update: {
              credentialDigest: input.onboardingCredentialDigest,
              expiresAt: input.onboardingCredentialExpiresAt,
            },
          });
          return recoveryNextStep ?? 'personal-profile';
        });
      } catch (error) {
        if (error instanceof VerificationTransitionRejected) return false;
        throw error;
      }
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
            journeys: {
              where: {
                entryPath: 'NEW_ORGANIZATION',
                currentStep: {
                  in: [
                    'PERSONAL_PROFILE',
                    'PLAN_SELECTION',
                    'ORGANIZATION_PROFILE',
                  ],
                },
                completedAt: null,
              },
              select: { id: true },
            },
            challenges: {
              where: { purpose: 'ONBOARDING_EMAIL' },
              orderBy: { sentAt: 'desc' },
              take: 1,
            },
          },
        });
        const latest = user?.challenges[0];
        const sendsInLastHour = user
          ? await transaction.verificationChallenge.count({
              where: {
                userId: user.id,
                purpose: 'ONBOARDING_EMAIL',
                sentAt: { gte: hourAgo },
              },
            })
          : 0;
        const hasResumableJourney = Boolean(
          user?.emailVerifiedAt && user.journeys.length === 1,
        );
        if (
          !user ||
          (user.emailVerifiedAt && !hasResumableJourney) ||
          !latest ||
          sendsInLastHour >= 5 ||
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
