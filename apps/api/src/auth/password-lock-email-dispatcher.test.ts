import { describe, expect, it, vi } from 'vitest';
import { createPasswordLockEmailDispatcher } from './password-lock-email-dispatcher.js';
import { PasswordLockEmailSendError } from './password-lock-email.js';

const now = new Date('2026-08-30T00:00:00Z');

function harness(attempts = 1) {
  const claim = vi.fn().mockResolvedValue({
    id: 'intent-id',
    recipient: 'owner@example.com',
    attempts,
  });
  const markDelivered = vi.fn().mockResolvedValue(true);
  const markRetry = vi.fn().mockResolvedValue(true);
  const markTerminal = vi.fn().mockResolvedValue(true);
  const send = vi.fn().mockResolvedValue('provider-id');
  const recordEvent = vi.fn();
  const dispatcher = createPasswordLockEmailDispatcher({
    claim,
    markDelivered,
    markRetry,
    markTerminal,
    send,
    workerId: 'worker-id',
    now: () => now,
    recordEvent,
  });
  return {
    claim,
    markDelivered,
    markRetry,
    markTerminal,
    send,
    recordEvent,
    dispatcher,
  };
}

describe('password lock email dispatcher [user-login REQ-010]', () => {
  it('reports idle and delivers a claimed intent', async () => {
    const idle = harness();
    idle.claim.mockResolvedValue(null);
    await expect(idle.dispatcher.runOnce()).resolves.toBe('idle');

    const delivered = harness();
    await expect(delivered.dispatcher.runOnce()).resolves.toBe('delivered');
    expect(delivered.claim).toHaveBeenCalledWith({
      workerId: 'worker-id',
      now,
      leaseExpiresAt: new Date('2026-08-30T00:01:00Z'),
    });
    expect(delivered.send).toHaveBeenCalledWith({
      recipient: 'owner@example.com',
      intentId: 'intent-id',
    });
    expect(delivered.markDelivered).toHaveBeenCalledWith({
      id: 'intent-id',
      workerId: 'worker-id',
      providerId: 'provider-id',
      deliveredAt: now,
    });
    expect(delivered.recordEvent).toHaveBeenCalledWith(
      'password_lock_email_delivered',
    );
  });

  it('treats a lost delivery lease as retryable', async () => {
    const h = harness();
    h.markDelivered.mockResolvedValue(false);
    await expect(h.dispatcher.runOnce()).resolves.toBe('retry');
    expect(h.recordEvent).toHaveBeenCalledWith(
      'password_lock_email_lease_lost',
    );
  });

  it.each([
    [new PasswordLockEmailSendError('permanent'), 1, 'provider_permanent'],
    [new PasswordLockEmailSendError('transient'), 5, 'retry_exhausted'],
  ] as const)(
    'terminates permanent or exhausted failures',
    async (error, attempts, code) => {
      const h = harness(attempts);
      h.send.mockRejectedValue(error);
      await expect(h.dispatcher.runOnce()).resolves.toBe('terminal');
      expect(h.markTerminal).toHaveBeenCalledWith({
        id: 'intent-id',
        workerId: 'worker-id',
        terminalAt: now,
        errorCode: code,
      });
    },
  );

  it.each([
    [
      new PasswordLockEmailSendError('transient'),
      1,
      'transient_failure',
      60_000,
    ],
    [
      new PasswordLockEmailSendError('ambiguous'),
      4,
      'ambiguous_failure',
      7_200_000,
    ],
    [new Error('private detail'), 2, 'ambiguous_failure', 300_000],
  ] as const)(
    'schedules bounded retries without leaking errors',
    async (error, attempts, code, delay) => {
      const h = harness(attempts);
      h.send.mockRejectedValue(error);
      await expect(h.dispatcher.runOnce()).resolves.toBe('retry');
      expect(h.markRetry).toHaveBeenCalledWith({
        id: 'intent-id',
        workerId: 'worker-id',
        nextAttemptAt: new Date(now.getTime() + delay),
        errorCode: code,
      });
      expect(h.recordEvent).toHaveBeenCalledWith(
        'password_lock_email_retry_scheduled',
      );
    },
  );
});
