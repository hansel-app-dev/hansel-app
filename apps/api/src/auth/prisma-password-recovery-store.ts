/** @spec password-recovery REQ-005..REQ-011 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';

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

function digestsMatch(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export function createPrismaPasswordRecoveryStore(
  prisma: PrismaClient,
  recordEvent?: (name: string, details?: { count: number }) => void,
) {
  return {
    async requestChallenge(input: {
      email: string;
      identifierDigest: string;
      codeDigest: string;
      expiresAt: Date;
      now: Date;
    }) {
      return runSerializable(prisma, async (transaction) => {
        const expired = await transaction.passwordRecoveryInitiation.findMany({
          where: { expiresAt: { lte: input.now } },
          orderBy: { expiresAt: 'asc' },
          take: 100,
          select: { id: true },
        });
        await transaction.passwordRecoveryInitiation.deleteMany({
          where: { id: { in: expired.map(({ id }) => id) } },
        });
        const hourAgo = new Date(input.now.getTime() - 60 * 60 * 1_000);
        const attempts = await transaction.passwordRecoveryInitiation.count({
          where: {
            identifierDigest: input.identifierDigest,
            requestedAt: { gt: hourAgo },
          },
        });
        if (attempts >= 3) return false;
        await transaction.passwordRecoveryInitiation.create({
          data: {
            identifierDigest: input.identifierDigest,
            requestedAt: input.now,
            expiresAt: new Date(
              input.now.getTime() + 30 * 24 * 60 * 60 * 1_000,
            ),
          },
        });
        const user = await transaction.user.findUnique({
          where: { email: input.email },
          select: {
            id: true,
            email: true,
            emailVerifiedAt: true,
            password: { select: { userId: true } },
            personalProfile: { select: { firstName: true } },
            challenges: {
              where: { purpose: 'PASSWORD_RECOVERY' },
              orderBy: { sentAt: 'desc' },
              take: 1,
              select: { sentAt: true },
            },
          },
        });
        const latest = user?.challenges[0];
        if (
          !user?.emailVerifiedAt ||
          !user.password ||
          (latest && input.now.getTime() - latest.sentAt.getTime() < 60_000)
        )
          return false;
        await transaction.verificationChallenge.updateMany({
          where: {
            userId: user.id,
            purpose: 'PASSWORD_RECOVERY',
            consumedAt: null,
          },
          data: { consumedAt: input.now },
        });
        const challenge = await transaction.verificationChallenge.create({
          data: {
            userId: user.id,
            purpose: 'PASSWORD_RECOVERY',
            codeDigest: input.codeDigest,
            expiresAt: input.expiresAt,
            sentAt: input.now,
          },
          select: { id: true },
        });
        return {
          challengeId: challenge.id,
          recipient: user.email,
          firstName: user.personalProfile?.firstName ?? null,
        };
      });
    },

    async resetPassword(input: {
      email: string;
      codeDigest: string;
      passwordHash: string;
      pepperVersion: number;
      now: Date;
    }) {
      const result = await runSerializable(prisma, async (transaction) => {
        const user = await transaction.user.findUnique({
          where: { email: input.email },
          select: {
            id: true,
            emailVerifiedAt: true,
            password: { select: { userId: true } },
            challenges: {
              where: { purpose: 'PASSWORD_RECOVERY' },
              orderBy: { sentAt: 'desc' },
              take: 1,
              select: {
                id: true,
                codeDigest: true,
                expiresAt: true,
                failedAttempts: true,
                consumedAt: true,
              },
            },
          },
        });
        const challenge = user?.challenges[0];
        if (
          !user?.emailVerifiedAt ||
          !user.password ||
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
        await transaction.passwordCredential.update({
          where: { userId: user.id },
          data: {
            passwordHash: input.passwordHash,
            pepperVersion: input.pepperVersion,
          },
        });
        await transaction.passwordAuthenticationState.upsert({
          where: { userId: user.id },
          create: { userId: user.id },
          update: {
            failedAttempts: 0,
            windowStartedAt: null,
            lockedUntil: null,
          },
        });
        const revokedSessions =
          await transaction.applicationSessionFamily.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: {
              revokedAt: input.now,
              revocationReason: 'password_recovery',
            },
          });
        await transaction.onboardingContinuation.deleteMany({
          where: { userId: user.id },
        });
        await transaction.verificationChallenge.updateMany({
          where: {
            userId: user.id,
            purpose: 'PASSWORD_RECOVERY',
            consumedAt: null,
          },
          data: { consumedAt: input.now },
        });
        await transaction.passwordRecoveryNotificationIntent.create({
          data: {
            userId: user.id,
            resetChallengeId: challenge.id,
            nextAttemptAt: input.now,
          },
        });
        return { revokedSessionCount: revokedSessions.count };
      });
      if (!result) return false;
      recordEvent?.('password_recovery_sessions_revoked', {
        count: result.revokedSessionCount,
      });
      recordEvent?.('password_reset_notification_created', { count: 1 });
      return true;
    },
  };
}
