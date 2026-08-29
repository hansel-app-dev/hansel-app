/** @spec onboarding-welcome-email REQ-004..REQ-006, REQ-014 */
import {
  WelcomeEmailSendError,
  type WelcomeEmailInput,
} from './welcome-email.js';

function retryDelay(attemptCount: number): number {
  if (attemptCount <= 1) return 60_000;
  if (attemptCount === 2) return 300_000;
  if (attemptCount === 3) return 1_800_000;
  return 7_200_000;
}

export interface ClaimedWelcomeEmail {
  id: string;
  recipient: string;
  firstName: string | null;
  attemptCount: number;
  createdAt: Date;
  recoveredLease: boolean;
  attemptLimitReached: boolean;
}

export interface PendingWelcomeEmail {
  id: string;
  attemptCount: number;
  createdAt: Date;
}

export interface WelcomeEmailEventDetails {
  correlationId: string;
  intentId: string;
  template: 'ONBOARDING_WELCOME';
  state: string;
  attempt: number;
  ageSeconds: number;
  category: string;
}

interface WelcomeEmailDispatcherDependencies {
  observeOldestPending(now: Date): Promise<PendingWelcomeEmail | null>;
  claim(input: {
    workerId: string;
    now: Date;
    leaseExpiresAt: Date;
  }): Promise<ClaimedWelcomeEmail | null>;
  markDelivered(input: {
    id: string;
    workerId: string;
    providerMessageId: string;
    deliveredAt: Date;
  }): Promise<boolean>;
  markRetry(input: {
    id: string;
    workerId: string;
    nextAttemptAt: Date;
  }): Promise<boolean>;
  markTerminal(input: {
    id: string;
    workerId: string;
    reason: string;
  }): Promise<boolean>;
  send(input: WelcomeEmailInput): Promise<string>;
  workerId: string;
  now(): Date;
  jitter(): number;
  recordEvent(name: string, details: WelcomeEmailEventDetails): void;
}

export function createWelcomeEmailDispatcher(
  dependencies: WelcomeEmailDispatcherDependencies,
) {
  const recordTransition = async (
    transition: Promise<boolean>,
    event: string,
    delivery: ClaimedWelcomeEmail,
    state: string,
    category: string,
  ): Promise<boolean> => {
    if (!(await transition)) {
      dependencies.recordEvent(
        'welcome_email_lease_lost',
        eventDetails(delivery, 'pending', 'lease_lost'),
      );
      return false;
    }
    dependencies.recordEvent(event, eventDetails(delivery, state, category));
    return true;
  };

  const ageSeconds = (createdAt: Date): number =>
    Math.max(
      0,
      Math.floor((dependencies.now().getTime() - createdAt.getTime()) / 1_000),
    );
  const eventDetails = (
    delivery: Pick<ClaimedWelcomeEmail, 'id' | 'attemptCount' | 'createdAt'>,
    state: string,
    category: string,
  ): WelcomeEmailEventDetails => ({
    correlationId: delivery.id,
    intentId: delivery.id,
    template: 'ONBOARDING_WELCOME',
    state,
    attempt: delivery.attemptCount,
    ageSeconds: ageSeconds(delivery.createdAt),
    category,
  });

  return {
    async runOnce(): Promise<'idle' | 'delivered' | 'retry' | 'terminal'> {
      const now = dependencies.now();
      const oldest = await dependencies.observeOldestPending(now);
      dependencies.recordEvent(
        'welcome_email_pending_age_observed',
        oldest
          ? eventDetails(oldest, 'pending', 'age_observed')
          : {
              correlationId: dependencies.workerId,
              intentId: 'none',
              template: 'ONBOARDING_WELCOME',
              state: 'idle',
              attempt: 0,
              ageSeconds: 0,
              category: 'age_observed',
            },
      );
      const delivery = await dependencies.claim({
        workerId: dependencies.workerId,
        now,
        leaseExpiresAt: new Date(now.getTime() + 60_000),
      });
      if (!delivery) return 'idle';
      dependencies.recordEvent(
        delivery.recoveredLease
          ? 'welcome_email_lease_recovered'
          : 'welcome_email_claimed',
        eventDetails(
          delivery,
          'pending',
          delivery.recoveredLease ? 'lease_recovered' : 'claimed',
        ),
      );
      if (now.getTime() - delivery.createdAt.getTime() > 15 * 60 * 1_000)
        dependencies.recordEvent(
          'welcome_email_pending_delayed',
          eventDetails(delivery, 'pending', 'delayed'),
        );
      if (delivery.attemptLimitReached)
        return (await recordTransition(
          dependencies.markTerminal({
            id: delivery.id,
            workerId: dependencies.workerId,
            reason: 'retry_exhausted',
          }),
          'welcome_email_retry_exhausted',
          delivery,
          'terminal',
          'retry_exhausted',
        ))
          ? 'terminal'
          : 'retry';
      if (!delivery.firstName) {
        return (await recordTransition(
          dependencies.markTerminal({
            id: delivery.id,
            workerId: dependencies.workerId,
            reason: 'profile_unavailable',
          }),
          'welcome_email_profile_unavailable',
          delivery,
          'terminal',
          'profile_unavailable',
        ))
          ? 'terminal'
          : 'retry';
      }
      const retryDeadline =
        delivery.createdAt.getTime() + 23 * 60 * 60 * 1_000 - 60_000;
      if (now.getTime() >= retryDeadline)
        return (await recordTransition(
          dependencies.markTerminal({
            id: delivery.id,
            workerId: dependencies.workerId,
            reason: 'retry_window_exhausted',
          }),
          'welcome_email_retry_window_exhausted',
          delivery,
          'terminal',
          'retry_window_exhausted',
        ))
          ? 'terminal'
          : 'retry';
      let providerMessageId: string;
      try {
        providerMessageId = await dependencies.send({
          recipient: delivery.recipient,
          firstName: delivery.firstName,
          idempotencyKey: `onboarding-welcome/${delivery.id}`,
        });
      } catch (error) {
        const kind =
          error instanceof WelcomeEmailSendError ? error.kind : 'ambiguous';
        const terminalReason =
          kind === 'permanent'
            ? 'provider_permanent'
            : delivery.attemptCount >= 5
              ? 'retry_exhausted'
              : null;
        if (terminalReason) {
          return (await recordTransition(
            dependencies.markTerminal({
              id: delivery.id,
              workerId: dependencies.workerId,
              reason: terminalReason,
            }),
            `welcome_email_${terminalReason}`,
            delivery,
            'terminal',
            terminalReason,
          ))
            ? 'terminal'
            : 'retry';
        }
        const baseDelay = retryDelay(delivery.attemptCount);
        const delay = Math.round(
          baseDelay * (0.75 + 0.5 * dependencies.jitter()),
        );
        const nextAttemptAt = new Date(
          Math.min(now.getTime() + delay, retryDeadline),
        );
        await recordTransition(
          dependencies.markRetry({
            id: delivery.id,
            workerId: dependencies.workerId,
            nextAttemptAt,
          }),
          `welcome_email_${kind}_failure`,
          delivery,
          'pending',
          `${kind}_failure`,
        );
        return 'retry';
      }
      return (await recordTransition(
        dependencies.markDelivered({
          id: delivery.id,
          workerId: dependencies.workerId,
          providerMessageId,
          deliveredAt: now,
        }),
        'welcome_email_delivered',
        delivery,
        'delivered',
        'provider_accepted',
      ))
        ? 'delivered'
        : 'retry';
    },
  };
}
