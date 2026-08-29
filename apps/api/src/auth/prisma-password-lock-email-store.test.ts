import { describe, expect, it, vi } from 'vitest';
import { createPrismaPasswordLockEmailStore } from './prisma-password-lock-email-store.js';

const now = new Date('2026-08-30T00:00:00Z');
const leaseExpiresAt = new Date('2026-08-30T00:01:00Z');

function harness() {
  const transaction = {
    passwordLockNotificationIntent: {
      findFirst: vi.fn().mockResolvedValue({ id: 'intent-id', attempts: 0 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({
        id: 'intent-id',
        attempts: 1,
        user: { email: 'owner@example.com' },
      }),
    },
  };
  const prisma = {
    $transaction: vi.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
    passwordLockNotificationIntent: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return {
    store: createPrismaPasswordLockEmailStore(prisma as never),
    transaction,
    prisma,
  };
}

describe('Prisma password lock email store [user-login REQ-010]', () => {
  it('atomically claims one eligible intent', async () => {
    const h = harness();
    await expect(
      h.store.claim({ workerId: 'worker-id', now, leaseExpiresAt }),
    ).resolves.toEqual({
      id: 'intent-id',
      recipient: 'owner@example.com',
      attempts: 1,
    });
    expect(
      h.transaction.passwordLockNotificationIntent.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: 'intent-id',
        status: 'PENDING',
        nextAttemptAt: { lte: now },
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
      },
      data: {
        leaseOwner: 'worker-id',
        leaseExpiresAt,
        attempts: { increment: 1 },
      },
    });
  });

  it('returns null for empty queues, lost races, and deleted candidates', async () => {
    const empty = harness();
    empty.transaction.passwordLockNotificationIntent.findFirst.mockResolvedValue(
      null,
    );
    await expect(
      empty.store.claim({ workerId: 'worker-id', now, leaseExpiresAt }),
    ).resolves.toBeNull();

    const lost = harness();
    lost.transaction.passwordLockNotificationIntent.updateMany.mockResolvedValue(
      { count: 0 },
    );
    await expect(
      lost.store.claim({ workerId: 'worker-id', now, leaseExpiresAt }),
    ).resolves.toBeNull();

    const deleted = harness();
    deleted.transaction.passwordLockNotificationIntent.findUnique.mockResolvedValue(
      null,
    );
    await expect(
      deleted.store.claim({ workerId: 'worker-id', now, leaseExpiresAt }),
    ).resolves.toBeNull();
  });

  it('transitions only intents leased by the caller', async () => {
    const h = harness();
    const nextAttemptAt = new Date('2026-08-30T00:05:00Z');
    await expect(
      h.store.markDelivered({
        id: 'intent-id',
        workerId: 'worker-id',
        providerId: 'provider-id',
        deliveredAt: now,
      }),
    ).resolves.toBe(true);
    await expect(
      h.store.markRetry({
        id: 'intent-id',
        workerId: 'worker-id',
        nextAttemptAt,
        errorCode: 'temporary_failure',
      }),
    ).resolves.toBe(true);
    await expect(
      h.store.markTerminal({
        id: 'intent-id',
        workerId: 'worker-id',
        terminalAt: now,
        errorCode: 'retry_exhausted',
      }),
    ).resolves.toBe(true);
    expect(
      h.prisma.passwordLockNotificationIntent.updateMany,
    ).toHaveBeenCalledTimes(3);

    h.prisma.passwordLockNotificationIntent.updateMany.mockResolvedValue({
      count: 0,
    });
    await expect(
      h.store.markDelivered({
        id: 'intent-id',
        workerId: 'other-worker',
        providerId: 'provider-id',
        deliveredAt: now,
      }),
    ).resolves.toBe(false);
  });
});
