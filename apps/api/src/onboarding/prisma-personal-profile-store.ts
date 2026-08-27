import type { PrismaClient } from '@prisma/client';
import type { PersonalProfileRequest } from '@hansel/contracts';

interface SavePersonalProfileInput {
  credentialDigest: string;
  nextCredentialDigest: string;
  nextCredentialExpiresAt: Date;
  now: Date;
  profile: PersonalProfileRequest;
}

class TransitionRejected extends Error {}

export function createPrismaPersonalProfileStore(prisma: PrismaClient) {
  return async function savePersonalProfile(
    input: SavePersonalProfileInput,
  ): Promise<boolean> {
    try {
      return await prisma.$transaction(async (transaction) => {
        const continuation =
          await transaction.onboardingContinuation.findUnique({
            where: { credentialDigest: input.credentialDigest },
            select: { userId: true, expiresAt: true },
          });
        if (!continuation || continuation.expiresAt <= input.now)
          throw new TransitionRejected();

        const transition = await transaction.onboardingJourney.updateMany({
          where: {
            userId: continuation.userId,
            currentStep: 'PERSONAL_PROFILE',
          },
          data: { currentStep: 'PLAN_SELECTION' },
        });
        if (transition.count !== 1) throw new TransitionRejected();

        const profile = {
          firstName: input.profile.firstName,
          lastName: input.profile.lastName,
          jobTitle: input.profile.jobTitle,
          jobTitleOther: input.profile.jobTitleOther ?? null,
          department: input.profile.department,
          departmentOther: input.profile.departmentOther ?? null,
        };
        await transaction.personalProfile.upsert({
          where: { userId: continuation.userId },
          create: { userId: continuation.userId, ...profile },
          update: profile,
        });
        await transaction.onboardingContinuation.update({
          where: { userId: continuation.userId },
          data: {
            credentialDigest: input.nextCredentialDigest,
            expiresAt: input.nextCredentialExpiresAt,
          },
        });
        return true;
      });
    } catch (error) {
      if (error instanceof TransitionRejected) return false;
      throw error;
    }
  };
}
