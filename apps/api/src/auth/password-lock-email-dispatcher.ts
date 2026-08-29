/** @spec user-login REQ-010 */
import { PasswordLockEmailSendError } from './password-lock-email.js';

interface Dependencies {
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
  recordEvent(name: string): void;
}

export function createPasswordLockEmailDispatcher(dependencies: Dependencies) {
  return {
    async runOnce(): Promise<'idle' | 'delivered' | 'retry' | 'terminal'> {
      const now = dependencies.now();
      const delivery = await dependencies.claim({
        workerId: dependencies.workerId,
        now,
        leaseExpiresAt: new Date(now.getTime() + 60_000),
      });
      if (!delivery) return 'idle';
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
            ? 'password_lock_email_delivered'
            : 'password_lock_email_lease_lost',
        );
        return delivered ? 'delivered' : 'retry';
      } catch (error) {
        const kind =
          error instanceof PasswordLockEmailSendError
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
          dependencies.recordEvent('password_lock_email_terminal_failure');
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
        dependencies.recordEvent('password_lock_email_retry_scheduled');
        return 'retry';
      }
    },
  };
}
