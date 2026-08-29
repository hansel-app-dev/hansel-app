/** @spec user-login REQ-010 */
import type { PrismaClient } from '@prisma/client';

export function createPrismaPasswordLockEmailStore(prisma: PrismaClient) {
  return {
    async claim(input: { workerId: string; now: Date; leaseExpiresAt: Date }) {
      return prisma.$transaction(async (transaction) => {
        const eligibility = {
          status: 'PENDING' as const,
          nextAttemptAt: { lte: input.now },
          OR: [
            { leaseExpiresAt: null },
            { leaseExpiresAt: { lte: input.now } },
          ],
        };
        const candidate =
          await transaction.passwordLockNotificationIntent.findFirst({
            where: eligibility,
            orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, attempts: true },
          });
        if (!candidate) return null;
        const claimed =
          await transaction.passwordLockNotificationIntent.updateMany({
            where: { id: candidate.id, ...eligibility },
            data: {
              leaseOwner: input.workerId,
              leaseExpiresAt: input.leaseExpiresAt,
              attempts: { increment: 1 },
            },
          });
        if (claimed.count !== 1) return null;
        const delivery =
          await transaction.passwordLockNotificationIntent.findUnique({
            where: { id: candidate.id },
            select: {
              id: true,
              attempts: true,
              user: { select: { email: true } },
            },
          });
        if (!delivery) return null;
        return {
          id: delivery.id,
          recipient: delivery.user.email,
          attempts: delivery.attempts,
        };
      });
    },
    async markDelivered(input: {
      id: string;
      workerId: string;
      providerId: string;
      deliveredAt: Date;
    }) {
      const result = await prisma.passwordLockNotificationIntent.updateMany({
        where: { id: input.id, status: 'PENDING', leaseOwner: input.workerId },
        data: {
          status: 'DELIVERED',
          providerId: input.providerId,
          deliveredAt: input.deliveredAt,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      return result.count === 1;
    },
    async markRetry(input: {
      id: string;
      workerId: string;
      nextAttemptAt: Date;
      errorCode: string;
    }) {
      const result = await prisma.passwordLockNotificationIntent.updateMany({
        where: { id: input.id, status: 'PENDING', leaseOwner: input.workerId },
        data: {
          nextAttemptAt: input.nextAttemptAt,
          lastErrorCode: input.errorCode,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      return result.count === 1;
    },
    async markTerminal(input: {
      id: string;
      workerId: string;
      terminalAt: Date;
      errorCode: string;
    }) {
      const result = await prisma.passwordLockNotificationIntent.updateMany({
        where: { id: input.id, status: 'PENDING', leaseOwner: input.workerId },
        data: {
          status: 'TERMINAL',
          terminalAt: input.terminalAt,
          lastErrorCode: input.errorCode,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      return result.count === 1;
    },
  };
}
