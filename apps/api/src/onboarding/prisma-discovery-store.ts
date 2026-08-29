/** @spec onboarding-discovery REQ-005..REQ-009, REQ-017 */
import type { PrismaClient } from '@prisma/client';
import type { DiscoveryAnswers } from './discovery.js';

type CompleteResult = 'created' | 'replay' | 'conflict' | 'rejected';
class Rejected extends Error {}

export function createPrismaDiscoveryStore(prisma: PrismaClient) {
  return {
    async prepare(input: {
      credentialDigest: string;
      submissionKeyDigest: string;
      now: Date;
      expiresAt: Date;
    }): Promise<boolean> {
      try {
        return await prisma.$transaction(async (transaction) => {
          const continuation =
            await transaction.onboardingContinuation.findUnique({
              where: { credentialDigest: input.credentialDigest },
              select: { userId: true, expiresAt: true },
            });
          if (!continuation || continuation.expiresAt <= input.now)
            throw new Rejected();
          const journey = await transaction.onboardingJourney.findFirst({
            where: {
              userId: continuation.userId,
              entryPath: 'NEW_ORGANIZATION',
              currentStep: 'DISCOVERY',
              completedAt: null,
              tenantId: { not: null },
              tenant: {
                memberships: {
                  some: { userId: continuation.userId, roleId: 'owner' },
                },
              },
            },
            select: { id: true },
          });
          if (!journey) throw new Rejected();
          await transaction.onboardingDiscoverySubmission.upsert({
            where: { journeyId: journey.id },
            create: {
              journeyId: journey.id,
              submissionKeyDigest: input.submissionKeyDigest,
              credentialDigest: input.credentialDigest,
              expiresAt: input.expiresAt,
            },
            update: {
              submissionKeyDigest: input.submissionKeyDigest,
              credentialDigest: input.credentialDigest,
              requestDigest: null,
              outcome: null,
              consumedAt: null,
              expiresAt: input.expiresAt,
            },
          });
          return true;
        });
      } catch (error) {
        if (error instanceof Rejected) return false;
        throw error;
      }
    },
    async complete(input: {
      credentialDigest: string;
      submissionKeyDigest: string;
      requestDigest: string;
      now: Date;
      answers: DiscoveryAnswers;
      applicationSession: {
        accessCredentialDigest: string;
        refreshCredentialDigest: string;
        accessExpiresAt: Date;
        absoluteExpiresAt: Date;
      };
    }): Promise<CompleteResult> {
      try {
        return await prisma.$transaction(async (transaction) => {
          const submission =
            await transaction.onboardingDiscoverySubmission.findUnique({
              where: { submissionKeyDigest: input.submissionKeyDigest },
              select: {
                journeyId: true,
                credentialDigest: true,
                requestDigest: true,
                expiresAt: true,
                consumedAt: true,
              },
            });
          if (
            !submission ||
            submission.expiresAt <= input.now ||
            submission.credentialDigest !== input.credentialDigest
          )
            throw new Rejected();
          if (submission.consumedAt)
            return submission.requestDigest === input.requestDigest
              ? 'replay'
              : 'conflict';
          const continuation =
            await transaction.onboardingContinuation.findUnique({
              where: { credentialDigest: input.credentialDigest },
              select: { userId: true, expiresAt: true },
            });
          if (!continuation || continuation.expiresAt <= input.now)
            throw new Rejected();
          const transition = await transaction.onboardingJourney.updateMany({
            where: {
              id: submission.journeyId,
              userId: continuation.userId,
              entryPath: 'NEW_ORGANIZATION',
              currentStep: 'DISCOVERY',
              completedAt: null,
              tenantId: { not: null },
              tenant: {
                memberships: {
                  some: { userId: continuation.userId, roleId: 'owner' },
                },
              },
            },
            data: { currentStep: 'COMPLETE', completedAt: input.now },
          });
          if (transition.count !== 1) throw new Rejected();
          const journey = await transaction.onboardingJourney.findUnique({
            where: { id: submission.journeyId },
            select: { tenantId: true },
          });
          if (!journey?.tenantId) throw new Rejected();
          await transaction.onboardingDiscoveryResponse.create({
            data: { journeyId: submission.journeyId, ...input.answers },
          });
          await transaction.onboardingDiscoverySubmission.update({
            where: { journeyId: submission.journeyId },
            data: {
              requestDigest: input.requestDigest,
              outcome: '/dashboard',
              consumedAt: input.now,
            },
          });
          await transaction.applicationSessionFamily.create({
            data: {
              userId: continuation.userId,
              tenantId: journey.tenantId,
              absoluteExpiresAt: input.applicationSession.absoluteExpiresAt,
              credentials: {
                create: [
                  {
                    kind: 'ACCESS',
                    credentialDigest:
                      input.applicationSession.accessCredentialDigest,
                    expiresAt: input.applicationSession.accessExpiresAt,
                  },
                  {
                    kind: 'REFRESH',
                    credentialDigest:
                      input.applicationSession.refreshCredentialDigest,
                    expiresAt: input.applicationSession.absoluteExpiresAt,
                  },
                ],
              },
            },
          });
          await transaction.onboardingContinuation.delete({
            where: { userId: continuation.userId },
          });
          return 'created';
        });
      } catch (error) {
        if (
          error instanceof Rejected ||
          (error as { code?: string }).code === 'P2002'
        ) {
          const submission =
            await prisma.onboardingDiscoverySubmission.findUnique({
              where: { submissionKeyDigest: input.submissionKeyDigest },
              select: {
                credentialDigest: true,
                requestDigest: true,
                consumedAt: true,
                expiresAt: true,
              },
            });
          if (
            submission?.consumedAt &&
            submission.expiresAt > input.now &&
            submission.credentialDigest === input.credentialDigest
          )
            return submission.requestDigest === input.requestDigest
              ? 'replay'
              : 'conflict';
          return 'rejected';
        }
        throw error instanceof Error
          ? error
          : new Error('Unexpected discovery database failure', {
              cause: error,
            });
      }
    },
  };
}
