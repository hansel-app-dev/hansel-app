/** @spec sites-add-new REQ-015 */
import type { SiteInvitationEmailInput } from './site-invitation-email.js';

export interface ClaimedSiteInvitation {
  deliveryId: string;
  invitationId: string;
  recipient: string;
  organizationName: string;
  siteName: string;
  expiresAt: Date;
  attempts: number;
}

interface Dependencies {
  claim(input: {
    workerId: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<ClaimedSiteInvitation | null>;
  markDelivered(input: {
    deliveryId: string;
    workerId: string;
    providerId: string;
    deliveredAt: Date;
  }): Promise<boolean>;
  markRetry(input: {
    deliveryId: string;
    workerId: string;
    nextAttemptAt: Date;
    errorCode: string;
  }): Promise<boolean>;
  markTerminal(input: {
    deliveryId: string;
    workerId: string;
    terminalAt: Date;
    errorCode: string;
  }): Promise<boolean>;
  createToken(invitationId: string, expiresAt: Date): string;
  send(input: SiteInvitationEmailInput): Promise<string>;
  workerId: string;
  now(): Date;
  jitter(): number;
  recordEvent(
    name: string,
    details: { deliveryId: string; invitationId: string; category: string },
  ): void;
}

export function createSiteInvitationDispatcher(dependencies: Dependencies) {
  const transition = async (
    result: Promise<boolean>,
    event: string,
    delivery: ClaimedSiteInvitation,
    category: string,
  ) => {
    const changed = await result;
    dependencies.recordEvent(changed ? event : 'site_invitation_lease_lost', {
      deliveryId: delivery.deliveryId,
      invitationId: delivery.invitationId,
      category: changed ? category : 'lease_lost',
    });
    return changed;
  };
  return {
    async runOnce(): Promise<'idle' | 'delivered' | 'retry' | 'terminal'> {
      const now = dependencies.now();
      const delivery = await dependencies.claim({
        workerId: dependencies.workerId,
        now,
        leaseExpiresAt: new Date(now.getTime() + 60_000),
      });
      if (!delivery) return 'idle';
      if (delivery.expiresAt <= now || delivery.attempts > 5) {
        const reason =
          delivery.expiresAt <= now ? 'expired' : 'retry_exhausted';
        await transition(
          dependencies.markTerminal({
            deliveryId: delivery.deliveryId,
            workerId: dependencies.workerId,
            terminalAt: now,
            errorCode: reason,
          }),
          `site_invitation_${reason}`,
          delivery,
          reason,
        );
        return 'terminal';
      }
      let providerId: string;
      try {
        providerId = await dependencies.send({
          invitationId: delivery.invitationId,
          recipient: delivery.recipient,
          organizationName: delivery.organizationName,
          siteName: delivery.siteName,
          token: dependencies.createToken(
            delivery.invitationId,
            delivery.expiresAt,
          ),
        });
      } catch {
        if (delivery.attempts >= 5) {
          await transition(
            dependencies.markTerminal({
              deliveryId: delivery.deliveryId,
              workerId: dependencies.workerId,
              terminalAt: now,
              errorCode: 'retry_exhausted',
            }),
            'site_invitation_retry_exhausted',
            delivery,
            'retry_exhausted',
          );
          return 'terminal';
        }
        const baseDelay = 60_000 * 2 ** (delivery.attempts - 1);
        const delay = Math.min(
          Math.round(baseDelay * (0.75 + dependencies.jitter() * 0.5)),
          3_600_000,
        );
        await transition(
          dependencies.markRetry({
            deliveryId: delivery.deliveryId,
            workerId: dependencies.workerId,
            nextAttemptAt: new Date(now.getTime() + delay),
            errorCode: 'provider_failure',
          }),
          'site_invitation_retry_scheduled',
          delivery,
          'provider_failure',
        );
        return 'retry';
      }
      await transition(
        dependencies.markDelivered({
          deliveryId: delivery.deliveryId,
          workerId: dependencies.workerId,
          providerId,
          deliveredAt: now,
        }),
        'site_invitation_delivered',
        delivery,
        'provider_accepted',
      );
      return 'delivered';
    },
  };
}
