import { describe, expect, it, vi } from 'vitest';
import { createWelcomeEmailDispatcher } from './welcome-email-dispatcher.js';
import { WelcomeEmailSendError } from './welcome-email.js';

const now = new Date('2026-08-29T12:00:00Z');

function harness() {
  const delivery = {
    id: 'delivery-id',
    recipient: 'owner@example.com',
    firstName: 'Ava',
    attemptCount: 1,
    createdAt: new Date('2026-08-29T11:59:00Z'),
    recoveredLease: false,
    attemptLimitReached: false,
  };
  const claim = vi.fn().mockResolvedValue(delivery);
  const observeOldestPending = vi.fn().mockResolvedValue(delivery);
  const markDelivered = vi.fn().mockResolvedValue(true);
  const markRetry = vi.fn().mockResolvedValue(true);
  const markTerminal = vi.fn().mockResolvedValue(true);
  const send = vi.fn().mockResolvedValue('provider-id');
  const recordEvent = vi.fn();
  const dispatcher = createWelcomeEmailDispatcher({
    claim,
    observeOldestPending,
    markDelivered,
    markRetry,
    markTerminal,
    send,
    workerId: 'worker-id',
    now: () => now,
    jitter: () => 0.5,
    recordEvent,
  });
  return {
    delivery,
    dispatcher,
    claim,
    observeOldestPending,
    markDelivered,
    markRetry,
    markTerminal,
    send,
    recordEvent,
  };
}

describe('Welcome email dispatcher [onboarding-welcome-email REQ-004..REQ-006, REQ-014]', () => {
  it('claims and delivers one pending Welcome email', async () => {
    const h = harness();

    await expect(h.dispatcher.runOnce()).resolves.toBe('delivered');
    expect(h.claim).toHaveBeenCalledWith({
      workerId: 'worker-id',
      now,
      leaseExpiresAt: new Date('2026-08-29T12:01:00Z'),
    });
    expect(h.send).toHaveBeenCalledWith({
      recipient: 'owner@example.com',
      firstName: 'Ava',
      idempotencyKey: 'onboarding-welcome/delivery-id',
    });
    expect(h.markDelivered).toHaveBeenCalledWith({
      id: 'delivery-id',
      workerId: 'worker-id',
      providerMessageId: 'provider-id',
      deliveredAt: now,
    });
    expect(h.recordEvent).toHaveBeenCalledWith(
      'welcome_email_claimed',
      expect.objectContaining({
        correlationId: 'delivery-id',
        intentId: 'delivery-id',
        template: 'ONBOARDING_WELCOME',
        state: 'pending',
        attempt: 1,
        ageSeconds: 60,
        category: 'claimed',
      }),
    );
    expect(h.recordEvent).toHaveBeenCalledWith(
      'welcome_email_delivered',
      expect.objectContaining({ state: 'delivered' }),
    );
  });

  it('reports idle polls and recovered leases without sending private data', async () => {
    const idle = harness();
    idle.claim.mockResolvedValue(null);
    idle.observeOldestPending.mockResolvedValue(null);
    await expect(idle.dispatcher.runOnce()).resolves.toBe('idle');
    expect(idle.send).not.toHaveBeenCalled();

    const recovered = harness();
    recovered.claim.mockResolvedValue({
      ...recovered.delivery,
      recoveredLease: true,
    });
    await expect(recovered.dispatcher.runOnce()).resolves.toBe('delivered');
    expect(recovered.recordEvent).toHaveBeenCalledWith(
      'welcome_email_lease_recovered',
      expect.objectContaining({ category: 'lease_recovered' }),
    );

    const delayed = harness();
    delayed.claim.mockResolvedValue({
      ...delayed.delivery,
      createdAt: new Date('2026-08-29T11:44:00Z'),
    });
    await expect(delayed.dispatcher.runOnce()).resolves.toBe('delivered');
    expect(delayed.recordEvent).toHaveBeenCalledWith(
      'welcome_email_pending_delayed',
      expect.objectContaining({ ageSeconds: 960 }),
    );
    expect(idle.recordEvent).toHaveBeenCalledWith(
      'welcome_email_pending_age_observed',
      expect.objectContaining({
        correlationId: 'worker-id',
        intentId: 'none',
        state: 'idle',
        ageSeconds: 0,
      }),
    );

    const future = harness();
    future.observeOldestPending.mockResolvedValue({
      ...future.delivery,
      createdAt: new Date('2026-08-29T12:01:00Z'),
    });
    future.claim.mockResolvedValue(null);
    await future.dispatcher.runOnce();
    expect(future.recordEvent).toHaveBeenCalledWith(
      'welcome_email_pending_age_observed',
      expect.objectContaining({ ageSeconds: 0 }),
    );
  });

  it('terminates safely when the accepted profile is unavailable', async () => {
    const h = harness();
    h.claim.mockResolvedValue({ ...h.delivery, firstName: null });

    await expect(h.dispatcher.runOnce()).resolves.toBe('terminal');
    expect(h.send).not.toHaveBeenCalled();
    expect(h.markTerminal).toHaveBeenCalledWith({
      id: 'delivery-id',
      workerId: 'worker-id',
      reason: 'profile_unavailable',
    });
    expect(h.recordEvent).toHaveBeenCalledWith(
      'welcome_email_profile_unavailable',
      expect.objectContaining({ state: 'terminal' }),
    );
  });

  it('terminates an interrupted fifth attempt without another send', async () => {
    const h = harness();
    h.claim.mockResolvedValue({
      ...h.delivery,
      attemptCount: 5,
      recoveredLease: true,
      attemptLimitReached: true,
    });

    await expect(h.dispatcher.runOnce()).resolves.toBe('terminal');
    expect(h.send).not.toHaveBeenCalled();
    expect(h.markTerminal).toHaveBeenCalledWith({
      id: 'delivery-id',
      workerId: 'worker-id',
      reason: 'retry_exhausted',
    });
  });

  it.each([{ attemptLimitReached: true }, { firstName: null }])(
    'reports lease loss before a pre-send terminal state',
    async (override) => {
      const h = harness();
      h.claim.mockResolvedValue({ ...h.delivery, ...override });
      h.markTerminal.mockResolvedValue(false);

      await expect(h.dispatcher.runOnce()).resolves.toBe('retry');
      expect(h.send).not.toHaveBeenCalled();
      expect(h.recordEvent).toHaveBeenCalledWith(
        'welcome_email_lease_lost',
        expect.objectContaining({ category: 'lease_lost' }),
      );
    },
  );

  it.each([
    [1, '2026-08-29T12:01:00Z'],
    [2, '2026-08-29T12:05:00Z'],
    [3, '2026-08-29T12:30:00Z'],
    [4, '2026-08-29T14:00:00Z'],
  ])(
    'schedules bounded retry delay %s for a transient provider failure',
    async (attemptCount, nextAttemptAt) => {
      const h = harness();
      h.claim.mockResolvedValue({ ...h.delivery, attemptCount });
      h.send.mockRejectedValue(new WelcomeEmailSendError('transient'));

      await expect(h.dispatcher.runOnce()).resolves.toBe('retry');
      expect(h.markRetry).toHaveBeenCalledWith({
        id: 'delivery-id',
        workerId: 'worker-id',
        nextAttemptAt: new Date(nextAttemptAt),
      });
      expect(h.markDelivered).not.toHaveBeenCalled();
      expect(h.recordEvent).toHaveBeenCalledWith(
        'welcome_email_transient_failure',
        expect.objectContaining({ category: 'transient_failure' }),
      );
    },
  );

  it('treats an unexpected sender failure as ambiguous without leaking it', async () => {
    const h = harness();
    h.send.mockRejectedValue(new Error('private sender detail'));

    await expect(h.dispatcher.runOnce()).resolves.toBe('retry');
    expect(h.recordEvent).toHaveBeenCalledWith(
      'welcome_email_ambiguous_failure',
      expect.objectContaining({ category: 'ambiguous_failure' }),
    );
    expect(JSON.stringify(h.recordEvent.mock.calls)).not.toContain('private');
  });

  it.each(['delivered', 'retry', 'terminal'] as const)(
    'reports lease loss while recording %s state',
    async (transition) => {
      const h = harness();
      if (transition === 'delivered') h.markDelivered.mockResolvedValue(false);
      if (transition === 'retry') {
        h.send.mockRejectedValue(new WelcomeEmailSendError('transient'));
        h.markRetry.mockResolvedValue(false);
      }
      if (transition === 'terminal') {
        h.send.mockRejectedValue(new WelcomeEmailSendError('permanent'));
        h.markTerminal.mockResolvedValue(false);
      }

      await expect(h.dispatcher.runOnce()).resolves.toBe('retry');
      expect(h.recordEvent).toHaveBeenCalledWith(
        'welcome_email_lease_lost',
        expect.any(Object),
      );
      expect(
        h.recordEvent.mock.calls.some(
          (call) => call[0] === `welcome_email_${transition}`,
        ),
      ).toBe(false);
    },
  );

  it.each([
    [
      new WelcomeEmailSendError('permanent'),
      1,
      new Date('2026-08-29T11:59:00Z'),
      'provider_permanent',
    ],
    [
      new WelcomeEmailSendError('transient'),
      5,
      new Date('2026-08-29T11:59:00Z'),
      'retry_exhausted',
    ],
  ] as const)(
    'terminates unsafe or exhausted delivery',
    async (error, attemptCount, createdAt, reason) => {
      const h = harness();
      h.claim.mockResolvedValue({
        ...h.delivery,
        attemptCount,
        createdAt,
      });
      h.send.mockRejectedValue(error);

      await expect(h.dispatcher.runOnce()).resolves.toBe('terminal');
      expect(h.markTerminal).toHaveBeenCalledWith({
        id: 'delivery-id',
        workerId: 'worker-id',
        reason,
      });
      expect(h.markRetry).not.toHaveBeenCalled();
      expect(h.recordEvent).toHaveBeenCalledWith(
        `welcome_email_${reason}`,
        expect.objectContaining({ category: reason }),
      );
    },
  );

  it('stops before sending at the 23-hour retry safety boundary', async () => {
    const h = harness();
    h.claim.mockResolvedValue({
      ...h.delivery,
      createdAt: new Date('2026-08-28T13:01:00Z'),
    });

    await expect(h.dispatcher.runOnce()).resolves.toBe('terminal');
    expect(h.send).not.toHaveBeenCalled();
    expect(h.markTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'retry_window_exhausted' }),
    );

    const leaseLost = harness();
    leaseLost.claim.mockResolvedValue({
      ...leaseLost.delivery,
      createdAt: new Date('2026-08-28T13:01:00Z'),
    });
    leaseLost.markTerminal.mockResolvedValue(false);
    await expect(leaseLost.dispatcher.runOnce()).resolves.toBe('retry');
  });

  it('caps an ambiguous retry before the provider idempotency window', async () => {
    const h = harness();
    h.claim.mockResolvedValue({
      ...h.delivery,
      attemptCount: 4,
      createdAt: new Date('2026-08-28T13:01:30Z'),
    });
    h.send.mockRejectedValue(new WelcomeEmailSendError('ambiguous'));

    await expect(h.dispatcher.runOnce()).resolves.toBe('retry');
    expect(h.markRetry).toHaveBeenCalledWith({
      id: 'delivery-id',
      workerId: 'worker-id',
      nextAttemptAt: new Date('2026-08-29T12:00:30Z'),
    });
  });
});
