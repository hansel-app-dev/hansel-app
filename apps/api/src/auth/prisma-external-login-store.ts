/** @spec user-login REQ-011, REQ-013, REQ-014 */
import type {
  ExternalAuthIntent,
  ExternalAuthProvider,
  PrismaClient,
} from '@prisma/client';
import type { ExternalIntent, ExternalProvider } from './external-login.js';

const providers: Record<ExternalProvider, ExternalAuthProvider> = {
  google: 'GOOGLE',
  microsoft: 'MICROSOFT',
  apple: 'APPLE',
};
const intents: Record<ExternalIntent, ExternalAuthIntent> = {
  login: 'LOGIN',
  onboarding: 'ONBOARDING',
};
const onboardingDestinations = {
  PERSONAL_PROFILE: '/onboarding/about-you',
  PLAN_SELECTION: '/onboarding/plan-selection',
  PAYMENT: '/onboarding/payment',
  ORGANIZATION_PROFILE: '/onboarding/organization-profile',
  DISCOVERY: '/onboarding/discovery',
} as const;

function onboardingDestination(step: string) {
  switch (step) {
    case 'PERSONAL_PROFILE':
      return onboardingDestinations.PERSONAL_PROFILE;
    case 'PLAN_SELECTION':
      return onboardingDestinations.PLAN_SELECTION;
    case 'PAYMENT':
      return onboardingDestinations.PAYMENT;
    case 'ORGANIZATION_PROFILE':
      return onboardingDestinations.ORGANIZATION_PROFILE;
    case 'DISCOVERY':
      return onboardingDestinations.DISCOVERY;
    default:
      return null;
  }
}

export function createPrismaExternalLoginStore(prisma: PrismaClient) {
  return {
    async createTransaction(input: {
      provider: ExternalProvider;
      intent: ExternalIntent;
      stateDigest: string;
      nonceDigest: string;
      pkceVerifierDigest: string;
      sealedSecrets: string;
      redirectUri: string;
      expiresAt: Date;
    }): Promise<void> {
      await prisma.externalAuthorizationTransaction.create({
        data: {
          ...input,
          provider: providers[input.provider],
          intent: intents[input.intent],
        },
      });
    },

    async consumeTransaction(input: {
      provider: ExternalProvider;
      stateDigest: string;
      now: Date;
    }) {
      return prisma.$transaction(
        async (transaction) => {
          const consumed =
            await transaction.externalAuthorizationTransaction.updateMany({
              where: {
                provider: providers[input.provider],
                stateDigest: input.stateDigest,
                consumedAt: null,
                expiresAt: { gt: input.now },
              },
              data: { consumedAt: input.now },
            });
          if (consumed.count !== 1) return null;
          const found =
            await transaction.externalAuthorizationTransaction.findUnique({
              where: { stateDigest: input.stateDigest },
              select: {
                intent: true,
                redirectUri: true,
                nonceDigest: true,
                pkceVerifierDigest: true,
                sealedSecrets: true,
              },
            });
          if (!found) return null;
          return {
            ...found,
            intent:
              found.intent === 'LOGIN'
                ? ('login' as const)
                : ('onboarding' as const),
          };
        },
        { isolationLevel: 'Serializable' },
      );
    },

    async completeIdentityLogin(input: {
      provider: ExternalProvider;
      subject: string;
      now: Date;
      accessCredentialDigest: string;
      accessExpiresAt: Date;
      refreshCredentialDigest: string;
      absoluteExpiresAt: Date;
      onboardingCredentialDigest: string;
      onboardingExpiresAt: Date;
    }) {
      return prisma.$transaction(
        async (transaction) => {
          const identity = await transaction.externalIdentity.findUnique({
            where: {
              provider_subject: {
                provider: providers[input.provider],
                subject: input.subject,
              },
            },
            select: {
              user: {
                select: {
                  id: true,
                  emailVerifiedAt: true,
                  journeys: {
                    where: { entryPath: 'NEW_ORGANIZATION' },
                    select: { currentStep: true, completedAt: true },
                    take: 2,
                  },
                  memberships: { select: { tenantId: true }, take: 2 },
                  sessionFamilies: {
                    where: {
                      revokedAt: null,
                      absoluteExpiresAt: { gt: input.now },
                    },
                    select: { id: true },
                    orderBy: { createdAt: 'asc' },
                  },
                },
              },
            },
          });
          const user = identity?.user;
          const journey = user?.journeys[0];
          if (!user?.emailVerifiedAt || user.journeys.length !== 1 || !journey)
            return null;
          if (!journey.completedAt) {
            const destination = onboardingDestination(journey.currentStep);
            if (!destination) return null;
            await transaction.onboardingContinuation.upsert({
              where: { userId: user.id },
              create: {
                userId: user.id,
                credentialDigest: input.onboardingCredentialDigest,
                expiresAt: input.onboardingExpiresAt,
              },
              update: {
                credentialDigest: input.onboardingCredentialDigest,
                expiresAt: input.onboardingExpiresAt,
              },
            });
            return { destination, sessionKind: 'onboarding' as const };
          }
          const [membership] = user.memberships;
          if (
            journey.currentStep !== 'COMPLETE' ||
            user.memberships.length !== 1 ||
            !membership
          )
            return null;
          for (const family of user.sessionFamilies.slice(
            0,
            Math.max(0, user.sessionFamilies.length - 4),
          ))
            await transaction.applicationSessionFamily.update({
              where: { id: family.id },
              data: {
                revokedAt: input.now,
                revocationReason: 'active_family_limit',
              },
            });
          await transaction.applicationSessionFamily.create({
            data: {
              userId: user.id,
              tenantId: membership.tenantId,
              absoluteExpiresAt: input.absoluteExpiresAt,
              credentials: {
                create: [
                  {
                    kind: 'ACCESS',
                    credentialDigest: input.accessCredentialDigest,
                    expiresAt: input.accessExpiresAt,
                  },
                  {
                    kind: 'REFRESH',
                    credentialDigest: input.refreshCredentialDigest,
                    expiresAt: input.absoluteExpiresAt,
                  },
                ],
              },
            },
          });
          return {
            destination: '/dashboard' as const,
            sessionKind: 'application' as const,
          };
        },
        { isolationLevel: 'Serializable' },
      );
    },
  };
}
