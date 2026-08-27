import type { PrismaClient } from '@prisma/client';
import type { OrganizationProfileRequest } from '@hansel/contracts';

type SaveResult =
  'created' | 'replay-initial' | 'replay-current' | 'conflict' | 'rejected';
class Rejected extends Error {}

export function createPrismaOrganizationProfileStore(prisma: PrismaClient) {
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
              currentStep: 'ORGANIZATION_PROFILE',
              tenantId: null,
              user: { planSelection: { isNot: null } },
            },
            select: { id: true },
          });
          if (!journey) throw new Rejected();
          await transaction.organizationProfileSubmission.upsert({
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
              nextCredentialDigest: null,
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
    async save(input: {
      credentialDigest: string;
      submissionKeyDigest: string;
      requestDigest: string;
      nextCredentialDigest: string;
      nextCredentialExpiresAt: Date;
      now: Date;
      profile: Omit<OrganizationProfileRequest, 'submissionKey'>;
    }): Promise<SaveResult> {
      try {
        return await prisma.$transaction(async (transaction) => {
          const submission =
            await transaction.organizationProfileSubmission.findUnique({
              where: { submissionKeyDigest: input.submissionKeyDigest },
              select: {
                journeyId: true,
                requestDigest: true,
                credentialDigest: true,
                nextCredentialDigest: true,
                expiresAt: true,
                consumedAt: true,
              },
            });
          if (!submission || submission.expiresAt <= input.now)
            throw new Rejected();
          const initialCredential =
            submission.credentialDigest === input.credentialDigest;
          const currentCredential =
            submission.nextCredentialDigest === input.credentialDigest;
          if (!initialCredential && !currentCredential) throw new Rejected();
          if (submission.consumedAt) {
            if (submission.requestDigest !== input.requestDigest)
              return 'conflict';
            return currentCredential ? 'replay-current' : 'replay-initial';
          }
          if (!initialCredential) throw new Rejected();
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
              currentStep: 'ORGANIZATION_PROFILE',
              tenantId: null,
            },
            data: { currentStep: 'DISCOVERY' },
          });
          if (transition.count !== 1) throw new Rejected();
          const tenant = await transaction.tenant.create({
            data: {
              name: input.profile.organizationName,
              country: input.profile.country,
              industry: input.profile.industry,
              placeService: input.profile.placeService,
              organizationSize: input.profile.organizationSize,
              memberships: {
                create: { userId: continuation.userId, roleId: 'owner' },
              },
            },
            select: { id: true },
          });
          await transaction.onboardingJourney.update({
            where: { id: submission.journeyId },
            data: { tenantId: tenant.id },
          });
          await transaction.organizationProfileSubmission.update({
            where: { journeyId: submission.journeyId },
            data: {
              requestDigest: input.requestDigest,
              nextCredentialDigest: input.nextCredentialDigest,
              outcome: 'discovery',
              consumedAt: input.now,
            },
          });
          await transaction.onboardingContinuation.update({
            where: { userId: continuation.userId },
            data: {
              credentialDigest: input.nextCredentialDigest,
              expiresAt: input.nextCredentialExpiresAt,
            },
          });
          return 'created';
        });
      } catch (error) {
        if (error instanceof Rejected) {
          const submission =
            await prisma.organizationProfileSubmission.findUnique({
              where: { submissionKeyDigest: input.submissionKeyDigest },
              select: {
                credentialDigest: true,
                nextCredentialDigest: true,
                requestDigest: true,
                consumedAt: true,
                expiresAt: true,
              },
            });
          if (
            submission?.consumedAt &&
            submission.expiresAt > input.now &&
            (submission.credentialDigest === input.credentialDigest ||
              submission.nextCredentialDigest === input.credentialDigest)
          )
            return submission.requestDigest === input.requestDigest
              ? submission.nextCredentialDigest === input.credentialDigest
                ? 'replay-current'
                : 'replay-initial'
              : 'conflict';
          return 'rejected';
        }
        if ((error as { code?: string }).code === 'P2002') return 'rejected';
        throw error instanceof Error
          ? error
          : new Error('Unexpected organization profile database failure', {
              cause: error,
            });
      }
    },
  };
}
