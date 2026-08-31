/** @spec password-recovery REQ-017 */
import { PasswordResetNotificationSendError } from './password-reset-notification-email.js';

interface Dependencies {
  observeOldestPending(now: Date): Promise<{ createdAt: Date } | null>;
  claim(input: {
    workerId: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<{ id: string; recipient: string; attempts: number } | null>;
  markDelivered(input: {
    id: string;
    workerId: string;
    providerId: string;
    deliveredAt: Date;
  }): Promise<boolean>;
  markRetry(input: {
    id: string;
    workerId: string;
    nextAttemptAt: Date;
    errorCode: string;
  }): Promise<boolean>;
  markTerminal(input: {
    id: string;
    workerId: string;
    terminalAt: Date;
    errorCode: string;
  }): Promise<boolean>;
  send(input: { recipient: string; intentId: string }): Promise<string>;
  workerId: string;
  now(): Date;
  recordEvent(name: string, details?: { ageSeconds: number }): void;
}

export function createPasswordResetNotificationDispatcher(
  dependencies: Dependencies,
) {
  return {
    async runOnce(): Promise<'idle' | 'delivered' | 'retry' | 'terminal'> {
      const now = dependencies.now();
      const oldest = await dependencies.observeOldestPending(now);
      dependencies.recordEvent(
        'password_reset_notification_pending_age_observed',
        {
          ageSeconds: oldest
            ? Math.max(
                0,
                Math.floor(
                  (now.getTime() - oldest.createdAt.getTime()) / 1_000,
                ),
              )
            : 0,
        },
      );
      const delivery = await dependencies.claim({
        workerId: dependencies.workerId,
        now,
        leaseExpiresAt: new Date(now.getTime() + 60_000),
      });
      if (!delivery) return 'idle';
      dependencies.recordEvent('password_reset_notification_claimed');
      try {
        const providerId = await dependencies.send({
          recipient: delivery.recipient,
          intentId: delivery.id,
        });
        const delivered = await dependencies.markDelivered({
          id: delivery.id,
          workerId: dependencies.workerId,
          providerId,
          deliveredAt: now,
        });
        dependencies.recordEvent(
          delivered
            ? 'password_reset_notification_delivered'
            : 'password_reset_notification_lease_lost',
        );
        return delivered ? 'delivered' : 'retry';
      } catch (error) {
        const kind =
          error instanceof PasswordResetNotificationSendError
            ? error.kind
            : 'ambiguous';
        if (kind === 'permanent' || delivery.attempts >= 5) {
          await dependencies.markTerminal({
            id: delivery.id,
            workerId: dependencies.workerId,
            terminalAt: now,
            errorCode:
              kind === 'permanent' ? 'provider_permanent' : 'retry_exhausted',
          });
          dependencies.recordEvent(
            'password_reset_notification_terminal_failure',
          );
          return 'terminal';
        }
        await dependencies.markRetry({
          id: delivery.id,
          workerId: dependencies.workerId,
          nextAttemptAt: new Date(
            now.getTime() +
              Math.min(60_000 * 5 ** (delivery.attempts - 1), 7_200_000),
          ),
          errorCode: `${kind}_failure`,
        });
        dependencies.recordEvent('password_reset_notification_retry_scheduled');
        return 'retry';
      }
    },
  };
}
