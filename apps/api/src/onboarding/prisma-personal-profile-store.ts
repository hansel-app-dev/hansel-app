import type { PrismaClient } from '@prisma/client';
import {
  personalProfileRequestSchema,
  type PersonalProfileRequest,
} from '@hansel/contracts';

interface SavePersonalProfileInput {
  credentialDigest: string;
  nextCredentialDigest: string;
  nextCredentialExpiresAt: Date;
  now: Date;
  profile: PersonalProfileRequest;
}

class TransitionRejected extends Error {}

export function createPrismaPersonalProfileLoader(prisma: PrismaClient) {
  return async function loadPersonalProfile(input: {
    credentialDigest: string;
    now: Date;
  }) {
    const continuation = await prisma.onboardingContinuation.findUnique({
      where: { credentialDigest: input.credentialDigest },
      select: {
        expiresAt: true,
        user: {
          select: {
            personalProfile: {
              select: {
                firstName: true,
                lastName: true,
                jobTitle: true,
                jobTitleOther: true,
                department: true,
                departmentOther: true,
              },
            },
            journeys: {
              where: {
                entryPath: 'NEW_ORGANIZATION',
                currentStep: { in: ['PERSONAL_PROFILE', 'PLAN_SELECTION'] },
              },
              select: { id: true },
            },
          },
        },
      },
    });
    if (
      !continuation ||
      continuation.expiresAt <= input.now ||
      continuation.user.journeys.length !== 1
    )
      return null;
    const profile = continuation.user.personalProfile;
    return {
      profile: profile
        ? personalProfileRequestSchema.parse({
            firstName: profile.firstName,
            lastName: profile.lastName,
            jobTitle: profile.jobTitle,
            ...(profile.jobTitleOther
              ? { jobTitleOther: profile.jobTitleOther }
              : {}),
            department: profile.department,
            ...(profile.departmentOther
              ? { departmentOther: profile.departmentOther }
              : {}),
          })
        : null,
    };
  };
}

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
            entryPath: 'NEW_ORGANIZATION',
            currentStep: 'PERSONAL_PROFILE',
          },
          data: { currentStep: 'PLAN_SELECTION' },
        });
        if (transition.count > 1) throw new TransitionRejected();
        const editableJourneys = await transaction.onboardingJourney.count({
          where: {
            userId: continuation.userId,
            entryPath: 'NEW_ORGANIZATION',
            currentStep: 'PLAN_SELECTION',
          },
        });
        if (editableJourneys !== 1) throw new TransitionRejected();

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
        const rotated = await transaction.onboardingContinuation.updateMany({
          where: {
            userId: continuation.userId,
            credentialDigest: input.credentialDigest,
          },
          data: {
            credentialDigest: input.nextCredentialDigest,
            expiresAt: input.nextCredentialExpiresAt,
          },
        });
        if (rotated.count !== 1) throw new TransitionRejected();
        return true;
      });
    } catch (error) {
      if (error instanceof TransitionRejected) return false;
      throw error;
    }
  };
}
