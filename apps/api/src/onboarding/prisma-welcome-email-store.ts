/** @spec onboarding-welcome-email REQ-002..REQ-006, REQ-015 */
import type { PrismaClient } from '@prisma/client';
import type { ClaimedWelcomeEmail } from './welcome-email-dispatcher.js';

export function createPrismaWelcomeEmailStore(prisma: PrismaClient) {
  return {
    async observeOldestPending(_now: Date) {
      return prisma.emailDeliveryIntent.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, attemptCount: true, createdAt: true },
      });
    },
    async claim(input: {
      workerId: string;
      now: Date;
      leaseExpiresAt: Date;
    }): Promise<(ClaimedWelcomeEmail & { recoveredLease: boolean }) | null> {
      return prisma.$transaction(async (transaction) => {
        const eligibility = {
          status: 'PENDING' as const,
          nextAttemptAt: { lte: input.now },
          OR: [
            { leaseExpiresAt: null },
            { leaseExpiresAt: { lte: input.now } },
          ],
        };
        const candidate = await transaction.emailDeliveryIntent.findFirst({
          where: eligibility,
          orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, leaseExpiresAt: true, attemptCount: true },
        });
        if (!candidate) return null;
        const claimed = await transaction.emailDeliveryIntent.updateMany({
          where: { id: candidate.id, ...eligibility },
          data: {
            leaseOwner: input.workerId,
            leaseExpiresAt: input.leaseExpiresAt,
            ...(candidate.attemptCount < 5
              ? { attemptCount: { increment: 1 } }
              : {}),
          },
        });
        if (claimed.count !== 1) return null;
        const delivery = await transaction.emailDeliveryIntent.findUnique({
          where: { id: candidate.id },
          select: {
            id: true,
            attemptCount: true,
            createdAt: true,
            journey: {
              select: {
                user: {
                  select: {
                    email: true,
                    personalProfile: { select: { firstName: true } },
                  },
                },
              },
            },
          },
        });
        if (!delivery) return null;
        return {
          id: delivery.id,
          recipient: delivery.journey.user.email,
          firstName: delivery.journey.user.personalProfile?.firstName ?? null,
          attemptCount: delivery.attemptCount,
          createdAt: delivery.createdAt,
          recoveredLease: candidate.leaseExpiresAt !== null,
          attemptLimitReached: candidate.attemptCount >= 5,
        };
      });
    },
    async markDelivered(input: {
      id: string;
      workerId: string;
      providerMessageId: string;
      deliveredAt: Date;
    }): Promise<boolean> {
      const result = await prisma.emailDeliveryIntent.updateMany({
        where: {
          id: input.id,
          status: 'PENDING',
          leaseOwner: input.workerId,
        },
        data: {
          status: 'DELIVERED',
          providerMessageId: input.providerMessageId,
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
    }): Promise<boolean> {
      const result = await prisma.emailDeliveryIntent.updateMany({
        where: {
          id: input.id,
          status: 'PENDING',
          leaseOwner: input.workerId,
        },
        data: {
          nextAttemptAt: input.nextAttemptAt,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      return result.count === 1;
    },
    async markTerminal(input: {
      id: string;
      workerId: string;
      reason: string;
    }): Promise<boolean> {
      const result = await prisma.emailDeliveryIntent.updateMany({
        where: {
          id: input.id,
          status: 'PENDING',
          leaseOwner: input.workerId,
        },
        data: {
          status: 'TERMINAL',
          terminalFailureReason: input.reason,
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      return result.count === 1;
    },
  };
}
