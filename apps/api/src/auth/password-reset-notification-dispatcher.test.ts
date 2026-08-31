import { describe, expect, it, vi } from 'vitest';
import { createPasswordResetNotificationDispatcher } from './password-reset-notification-dispatcher.js';
import { PasswordResetNotificationSendError } from './password-reset-notification-email.js';

const now = new Date('2026-08-31T00:00:00Z');
function harness(attempts = 1) {
  const dependencies = {
    observeOldestPending: vi.fn().mockResolvedValue({
      createdAt: new Date('2026-08-30T23:55:00Z'),
    }),
    claim: vi.fn().mockResolvedValue({
      id: 'intent',
      recipient: 'owner@example.com',
      attempts,
    }),
    markDelivered: vi.fn().mockResolvedValue(true),
    markRetry: vi.fn().mockResolvedValue(true),
    markTerminal: vi.fn().mockResolvedValue(true),
    send: vi.fn().mockResolvedValue('provider'),
    workerId: 'worker',
    now: () => now,
    recordEvent: vi.fn(),
  };
  return {
    ...dependencies,
    dispatcher: createPasswordResetNotificationDispatcher(dependencies),
  };
}

describe('password reset notification dispatcher [password-recovery REQ-017]', () => {
  it('handles idle, delivered, and lease-lost outcomes', async () => {
    const idle = harness();
    idle.claim.mockResolvedValue(null);
    await expect(idle.dispatcher.runOnce()).resolves.toBe('idle');
    expect(idle.recordEvent).toHaveBeenCalledWith(
      'password_reset_notification_pending_age_observed',
      { ageSeconds: 300 },
    );
    const empty = harness();
    empty.observeOldestPending.mockResolvedValue(null);
    empty.claim.mockResolvedValue(null);
    await expect(empty.dispatcher.runOnce()).resolves.toBe('idle');
    expect(empty.recordEvent).toHaveBeenCalledWith(
      'password_reset_notification_pending_age_observed',
      { ageSeconds: 0 },
    );
    const clockSkew = harness();
    clockSkew.observeOldestPending.mockResolvedValue({
      createdAt: new Date(now.getTime() + 60_000),
    });
    await expect(clockSkew.dispatcher.runOnce()).resolves.toBe('delivered');
    expect(clockSkew.recordEvent).toHaveBeenCalledWith(
      'password_reset_notification_pending_age_observed',
      { ageSeconds: 0 },
    );
    const delivered = harness();
    await expect(delivered.dispatcher.runOnce()).resolves.toBe('delivered');
    expect(delivered.recordEvent).toHaveBeenCalledWith(
      'password_reset_notification_claimed',
    );
    expect(delivered.markDelivered).toHaveBeenCalledWith({
      id: 'intent',
      workerId: 'worker',
      providerId: 'provider',
      deliveredAt: now,
    });
    const lost = harness();
    lost.markDelivered.mockResolvedValue(false);
    await expect(lost.dispatcher.runOnce()).resolves.toBe('retry');
    expect(lost.recordEvent).toHaveBeenCalledWith(
      'password_reset_notification_lease_lost',
    );
  });

  it.each([
    [
      new PasswordResetNotificationSendError('permanent'),
      1,
      'provider_permanent',
    ],
    [new PasswordResetNotificationSendError('transient'), 5, 'retry_exhausted'],
  ] as const)(
    'terminates permanent and exhausted delivery',
    async (error, attempts, errorCode) => {
      const h = harness(attempts);
      h.send.mockRejectedValue(error);
      await expect(h.dispatcher.runOnce()).resolves.toBe('terminal');
      expect(h.markTerminal).toHaveBeenCalledWith({
        id: 'intent',
        workerId: 'worker',
        terminalAt: now,
        errorCode,
      });
    },
  );

  it.each([
    [
      new PasswordResetNotificationSendError('transient'),
      1,
      'transient_failure',
      60_000,
    ],
    [
      new PasswordResetNotificationSendError('ambiguous'),
      4,
      'ambiguous_failure',
      7_200_000,
    ],
    [new Error('private'), 2, 'ambiguous_failure', 300_000],
  ] as const)(
    'schedules bounded retries',
    async (error, attempts, errorCode, delay) => {
      const h = harness(attempts);
      h.send.mockRejectedValue(error);
      await expect(h.dispatcher.runOnce()).resolves.toBe('retry');
      expect(h.markRetry).toHaveBeenCalledWith({
        id: 'intent',
        workerId: 'worker',
        nextAttemptAt: new Date(now.getTime() + delay),
        errorCode,
      });
    },
  );
});
