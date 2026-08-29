/** @spec user-login REQ-005..REQ-011 */
import type { Prisma, PrismaClient } from '@prisma/client';

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

async function runSerializable<T>(
  prisma: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let lastConflict: unknown;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: 'Serializable',
      });
    } catch (error) {
      const retryable =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2034';
      if (!retryable) throw error;
      lastConflict = error;
    }
  }
  throw lastConflict;
}

export function createPrismaPasswordLoginStore(prisma: PrismaClient) {
  return {
    async loadAccount(email: string) {
      const account = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          password: { select: { passwordHash: true } },
          passwordAuthenticationState: { select: { lockedUntil: true } },
        },
      });
      if (!account?.password) return null;
      return {
        userId: account.id,
        passwordHash: account.password.passwordHash,
        lockedUntil: account.passwordAuthenticationState?.lockedUntil ?? null,
      };
    },
    async recordFailure(input: { userId: string; now: Date }): Promise<void> {
      await runSerializable(prisma, async (transaction) => {
        const state = await transaction.passwordAuthenticationState.findUnique({
          where: { userId: input.userId },
        });
        if (state?.lockedUntil && state.lockedUntil > input.now) return;
        const windowBoundary = new Date(input.now.getTime() - 15 * 60 * 1_000);
        const priorWindowStartedAt = state?.windowStartedAt;
        const inCurrentWindow =
          priorWindowStartedAt !== null &&
          priorWindowStartedAt !== undefined &&
          priorWindowStartedAt > windowBoundary;
        const failedAttempts = inCurrentWindow
          ? (state?.failedAttempts ?? 0) + 1
          : 1;
        const windowStartedAt = inCurrentWindow
          ? priorWindowStartedAt
          : input.now;
        const lockedUntil =
          failedAttempts >= 5
            ? new Date(input.now.getTime() + 15 * 60 * 1_000)
            : null;
        const data = {
          failedAttempts,
          windowStartedAt,
          lockedUntil,
        };
        await transaction.passwordAuthenticationState.upsert({
          where: { userId: input.userId },
          create: { userId: input.userId, ...data },
          update: data,
        });
        if (failedAttempts === 5)
          await transaction.passwordLockNotificationIntent.upsert({
            where: {
              userId_lockStartedAt: {
                userId: input.userId,
                lockStartedAt: input.now,
              },
            },
            create: {
              userId: input.userId,
              lockStartedAt: input.now,
              nextAttemptAt: input.now,
            },
            update: {},
          });
      });
    },
    async completeSuccess(input: {
      userId: string;
      expectedPasswordHash: string;
      now: Date;
      accessCredentialDigest: string;
      accessExpiresAt: Date;
      refreshCredentialDigest: string;
      absoluteExpiresAt: Date;
      onboardingCredentialDigest: string;
      onboardingExpiresAt: Date;
    }) {
      return runSerializable(prisma, async (transaction) => {
        const user = await transaction.user.findUnique({
          where: { id: input.userId },
          select: {
            emailVerifiedAt: true,
            password: { select: { passwordHash: true } },
            passwordAuthenticationState: {
              select: { lockedUntil: true },
            },
            journeys: {
              where: { entryPath: 'NEW_ORGANIZATION' },
              select: { currentStep: true, completedAt: true },
              take: 2,
            },
            memberships: {
              select: { tenantId: true },
              take: 2,
            },
            sessionFamilies: {
              where: {
                revokedAt: null,
                absoluteExpiresAt: { gt: input.now },
              },
              select: { id: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        });
        const journey = user?.journeys[0];
        if (
          !user ||
          user.password?.passwordHash !== input.expectedPasswordHash ||
          (user.passwordAuthenticationState?.lockedUntil &&
            user.passwordAuthenticationState.lockedUntil > input.now) ||
          user.journeys.length !== 1 ||
          !journey
        )
          return null;

        const resetFailures = () =>
          transaction.passwordAuthenticationState.upsert({
            where: { userId: input.userId },
            create: { userId: input.userId },
            update: {
              failedAttempts: 0,
              windowStartedAt: null,
              lockedUntil: null,
            },
          });
        if (!user.emailVerifiedAt) {
          if (journey.currentStep !== 'VERIFY_EMAIL' || journey.completedAt)
            return null;
          await resetFailures();
          return {
            destination: '/onboarding/verify-email' as const,
            sessionKind: 'verification' as const,
          };
        }

        if (!journey.completedAt) {
          const destination = onboardingDestination(journey.currentStep);
          if (!destination) return null;
          await transaction.onboardingContinuation.upsert({
            where: { userId: input.userId },
            create: {
              userId: input.userId,
              credentialDigest: input.onboardingCredentialDigest,
              expiresAt: input.onboardingExpiresAt,
            },
            update: {
              credentialDigest: input.onboardingCredentialDigest,
              expiresAt: input.onboardingExpiresAt,
            },
          });
          await resetFailures();
          return { destination, sessionKind: 'onboarding' as const };
        }

        const [membership] = user.memberships;
        if (
          journey.currentStep !== 'COMPLETE' ||
          user.memberships.length !== 1 ||
          !membership
        )
          return null;
        const familiesToRevoke = user.sessionFamilies.slice(
          0,
          Math.max(0, user.sessionFamilies.length - 4),
        );
        for (const family of familiesToRevoke)
          await transaction.applicationSessionFamily.update({
            where: { id: family.id },
            data: {
              revokedAt: input.now,
              revocationReason: 'active_family_limit',
            },
          });
        await transaction.applicationSessionFamily.create({
          data: {
            userId: input.userId,
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
        await resetFailures();
        return {
          destination: '/dashboard' as const,
          sessionKind: 'application' as const,
        };
      });
    },
  };
}
