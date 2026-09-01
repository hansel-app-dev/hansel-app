/** @spec sites-add-new REQ-014, REQ-015 */
import type { PrismaClient } from '@prisma/client';
import type { ClaimedSiteInvitation } from './site-invitation-dispatcher.js';

export function createPrismaSiteInvitationStore(prisma: PrismaClient) {
  return {
    async claim(input: {
      workerId: string;
      now: Date;
      leaseExpiresAt: Date;
    }): Promise<ClaimedSiteInvitation | null> {
      return prisma.$transaction(async (transaction) => {
        const eligible = {
          status: 'PENDING' as const,
          nextAttemptAt: { lte: input.now },
          OR: [
            { leaseExpiresAt: null },
            { leaseExpiresAt: { lte: input.now } },
          ],
        };
        const candidate =
          await transaction.siteInvitationDeliveryIntent.findFirst({
            where: eligible,
            orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
          });
        if (!candidate) return null;
        const claimed =
          await transaction.siteInvitationDeliveryIntent.updateMany({
            where: { id: candidate.id, ...eligible },
            data: {
              attempts: { increment: 1 },
              leaseOwner: input.workerId,
              leaseExpiresAt: input.leaseExpiresAt,
            },
          });
        if (claimed.count !== 1) return null;
        const delivery =
          await transaction.siteInvitationDeliveryIntent.findUnique({
            where: { id: candidate.id },
            select: {
              id: true,
              attempts: true,
              invitation: {
                select: {
                  id: true,
                  email: true,
                  expiresAt: true,
                  site: {
                    select: { name: true, tenant: { select: { name: true } } },
                  },
                },
              },
            },
          });
        if (!delivery) return null;
        return {
          deliveryId: delivery.id,
          invitationId: delivery.invitation.id,
          recipient: delivery.invitation.email,
          organizationName: delivery.invitation.site.tenant.name,
          siteName: delivery.invitation.site.name,
          expiresAt: delivery.invitation.expiresAt,
          attempts: delivery.attempts,
        };
      });
    },
    async markDelivered(input: {
      deliveryId: string;
      workerId: string;
      providerId: string;
      deliveredAt: Date;
    }) {
      const result = await prisma.siteInvitationDeliveryIntent.updateMany({
        where: {
          id: input.deliveryId,
          status: 'PENDING',
          leaseOwner: input.workerId,
        },
        data: {
          status: 'DELIVERED',
          providerId: input.providerId,
          deliveredAt: input.deliveredAt,
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCode: null,
        },
      });
      return result.count === 1;
    },
    async markRetry(input: {
      deliveryId: string;
      workerId: string;
      nextAttemptAt: Date;
      errorCode: string;
    }) {
      const result = await prisma.siteInvitationDeliveryIntent.updateMany({
        where: {
          id: input.deliveryId,
          status: 'PENDING',
          leaseOwner: input.workerId,
        },
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
      deliveryId: string;
      workerId: string;
      terminalAt: Date;
      errorCode: string;
    }) {
      const result = await prisma.siteInvitationDeliveryIntent.updateMany({
        where: {
          id: input.deliveryId,
          status: 'PENDING',
          leaseOwner: input.workerId,
        },
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
