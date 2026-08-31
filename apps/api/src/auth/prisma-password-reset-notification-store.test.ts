import { describe, expect, it, vi } from 'vitest';
import { createPrismaPasswordResetNotificationStore } from './prisma-password-reset-notification-store.js';

const now = new Date('2026-08-31T00:00:00Z');
const leaseExpiresAt = new Date('2026-08-31T00:01:00Z');
function harness() {
  const intent = {
    findFirst: vi.fn().mockResolvedValue({ id: 'intent' }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    findUnique: vi.fn().mockResolvedValue({
      id: 'intent',
      attempts: 1,
      user: { email: 'owner@example.com' },
    }),
  };
  const transaction = { passwordRecoveryNotificationIntent: intent };
  const prisma = {
    $transaction: vi.fn(
      (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
    passwordRecoveryNotificationIntent: {
      findFirst: vi.fn().mockResolvedValue({
        createdAt: new Date('2026-08-30T23:55:00Z'),
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return {
    intent,
    prisma,
    store: createPrismaPasswordResetNotificationStore(prisma as never),
  };
}

describe('Prisma password reset notification store [password-recovery REQ-017]', () => {
  it('observes the oldest pending intent for backlog monitoring', async () => {
    const h = harness();
    await expect(h.store.observeOldestPending(now)).resolves.toEqual({
      createdAt: new Date('2026-08-30T23:55:00Z'),
    });
  });

  it('atomically claims an eligible intent', async () => {
    const h = harness();
    await expect(
      h.store.claim({ workerId: 'worker', now, leaseExpiresAt }),
    ).resolves.toEqual({
      id: 'intent',
      recipient: 'owner@example.com',
      attempts: 1,
    });
    expect(h.intent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'intent', status: 'PENDING' }),
      }),
    );
  });

  it('returns null for empty, raced, and deleted intents', async () => {
    const empty = harness();
    empty.intent.findFirst.mockResolvedValue(null);
    await expect(
      empty.store.claim({ workerId: 'worker', now, leaseExpiresAt }),
    ).resolves.toBeNull();
    const raced = harness();
    raced.intent.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      raced.store.claim({ workerId: 'worker', now, leaseExpiresAt }),
    ).resolves.toBeNull();
    const deleted = harness();
    deleted.intent.findUnique.mockResolvedValue(null);
    await expect(
      deleted.store.claim({ workerId: 'worker', now, leaseExpiresAt }),
    ).resolves.toBeNull();
  });

  it('transitions only a caller-owned lease', async () => {
    const h = harness();
    await expect(
      h.store.markDelivered({
        id: 'intent',
        workerId: 'worker',
        providerId: 'provider',
        deliveredAt: now,
      }),
    ).resolves.toBe(true);
    await expect(
      h.store.markRetry({
        id: 'intent',
        workerId: 'worker',
        nextAttemptAt: leaseExpiresAt,
        errorCode: 'temporary',
      }),
    ).resolves.toBe(true);
    await expect(
      h.store.markTerminal({
        id: 'intent',
        workerId: 'worker',
        terminalAt: now,
        errorCode: 'terminal',
      }),
    ).resolves.toBe(true);
    h.prisma.passwordRecoveryNotificationIntent.updateMany.mockResolvedValue({
      count: 0,
    });
    await expect(
      h.store.markDelivered({
        id: 'intent',
        workerId: 'other',
        providerId: 'provider',
        deliveredAt: now,
      }),
    ).resolves.toBe(false);
  });
});
