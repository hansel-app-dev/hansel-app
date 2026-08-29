import { describe, expect, it, vi } from 'vitest';
import { createPrismaWelcomeEmailStore } from './prisma-welcome-email-store.js';

const now = new Date('2026-08-29T12:00:00Z');
const leaseExpiresAt = new Date('2026-08-29T12:01:00Z');

function harness() {
  const transaction = {
    emailDeliveryIntent: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'delivery-id',
        leaseExpiresAt: null,
        attemptCount: 0,
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({
        id: 'delivery-id',
        attemptCount: 1,
        createdAt: new Date('2026-08-29T11:59:00Z'),
        journey: {
          user: {
            email: 'owner@example.com',
            personalProfile: { firstName: 'Ava' },
          },
        },
      }),
    },
  };
  const prisma = {
    $transaction: vi.fn(
      async (callback: (value: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
    emailDeliveryIntent: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'delivery-id',
        attemptCount: 0,
        createdAt: new Date('2026-08-29T11:59:00Z'),
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return {
    store: createPrismaWelcomeEmailStore(prisma as never),
    transaction,
    prisma,
  };
}

describe('Prisma Welcome email store [onboarding-welcome-email REQ-002..REQ-006, REQ-015]', () => {
  it('observes the oldest pending intent without personal data', async () => {
    const h = harness();
    await expect(h.store.observeOldestPending(now)).resolves.toEqual({
      id: 'delivery-id',
      attemptCount: 0,
      createdAt: new Date('2026-08-29T11:59:00Z'),
    });
    expect(h.prisma.emailDeliveryIntent.findFirst).toHaveBeenCalledWith({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, attemptCount: true, createdAt: true },
    });
  });
  it('atomically leases one eligible delivery and derives its recipient', async () => {
    const h = harness();

    await expect(
      h.store.claim({ workerId: 'worker-id', now, leaseExpiresAt }),
    ).resolves.toEqual({
      id: 'delivery-id',
      recipient: 'owner@example.com',
      firstName: 'Ava',
      attemptCount: 1,
      createdAt: new Date('2026-08-29T11:59:00Z'),
      recoveredLease: false,
      attemptLimitReached: false,
    });
    expect(h.transaction.emailDeliveryIntent.findFirst).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        nextAttemptAt: { lte: now },
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
      },
      orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, leaseExpiresAt: true, attemptCount: true },
    });
    expect(h.transaction.emailDeliveryIntent.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'delivery-id',
        status: 'PENDING',
        nextAttemptAt: { lte: now },
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
      },
      data: {
        leaseOwner: 'worker-id',
        leaseExpiresAt,
        attemptCount: { increment: 1 },
      },
    });
  });

  it('changes delivery state only for the current lease owner', async () => {
    const h = harness();
    const nextAttemptAt = new Date('2026-08-29T12:05:00Z');

    await expect(
      h.store.markDelivered({
        id: 'delivery-id',
        workerId: 'worker-id',
        providerMessageId: 'provider-id',
        deliveredAt: now,
      }),
    ).resolves.toBe(true);
    await expect(
      h.store.markRetry({
        id: 'delivery-id',
        workerId: 'worker-id',
        nextAttemptAt,
      }),
    ).resolves.toBe(true);
    await expect(
      h.store.markTerminal({
        id: 'delivery-id',
        workerId: 'worker-id',
        reason: 'provider_permanent',
      }),
    ).resolves.toBe(true);

    expect(h.prisma.emailDeliveryIntent.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'delivery-id',
        status: 'PENDING',
        leaseOwner: 'worker-id',
      },
      data: {
        status: 'DELIVERED',
        providerMessageId: 'provider-id',
        deliveredAt: now,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
    expect(h.prisma.emailDeliveryIntent.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'delivery-id',
        status: 'PENDING',
        leaseOwner: 'worker-id',
      },
      data: {
        nextAttemptAt,
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
    expect(h.prisma.emailDeliveryIntent.updateMany).toHaveBeenNthCalledWith(3, {
      where: {
        id: 'delivery-id',
        status: 'PENDING',
        leaseOwner: 'worker-id',
      },
      data: {
        status: 'TERMINAL',
        terminalFailureReason: 'provider_permanent',
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    });
  });

  it('loses claim races safely and surfaces a missing profile to the dispatcher', async () => {
    const empty = harness();
    empty.transaction.emailDeliveryIntent.findFirst.mockResolvedValue(null);
    await expect(
      empty.store.claim({ workerId: 'worker-id', now, leaseExpiresAt }),
    ).resolves.toBeNull();

    const loser = harness();
    loser.transaction.emailDeliveryIntent.updateMany.mockResolvedValue({
      count: 0,
    });
    await expect(
      loser.store.claim({ workerId: 'worker-id', now, leaseExpiresAt }),
    ).resolves.toBeNull();

    const vanished = harness();
    vanished.transaction.emailDeliveryIntent.findUnique.mockResolvedValue(null);
    await expect(
      vanished.store.claim({ workerId: 'worker-id', now, leaseExpiresAt }),
    ).resolves.toBeNull();

    const missingProfile = harness();
    missingProfile.transaction.emailDeliveryIntent.findFirst.mockResolvedValue({
      id: 'delivery-id',
      leaseExpiresAt: new Date('2026-08-29T11:00:00Z'),
      attemptCount: 1,
    });
    missingProfile.transaction.emailDeliveryIntent.findUnique.mockResolvedValue(
      {
        id: 'delivery-id',
        attemptCount: 2,
        createdAt: new Date('2026-08-29T10:00:00Z'),
        journey: {
          user: { email: 'owner@example.com', personalProfile: null },
        },
      },
    );
    await expect(
      missingProfile.store.claim({
        workerId: 'worker-id',
        now,
        leaseExpiresAt,
      }),
    ).resolves.toMatchObject({ firstName: null, recoveredLease: true });
  });

  it('reclaims an interrupted fifth attempt without incrementing or resending', async () => {
    const h = harness();
    h.transaction.emailDeliveryIntent.findFirst.mockResolvedValue({
      id: 'delivery-id',
      leaseExpiresAt: new Date('2026-08-29T11:00:00Z'),
      attemptCount: 5,
    });
    h.transaction.emailDeliveryIntent.findUnique.mockResolvedValue({
      id: 'delivery-id',
      attemptCount: 5,
      createdAt: new Date('2026-08-29T10:00:00Z'),
      journey: {
        user: {
          email: 'owner@example.com',
          personalProfile: { firstName: 'Ava' },
        },
      },
    });

    await expect(
      h.store.claim({ workerId: 'worker-id', now, leaseExpiresAt }),
    ).resolves.toMatchObject({
      attemptCount: 5,
      recoveredLease: true,
      attemptLimitReached: true,
    });
    expect(h.transaction.emailDeliveryIntent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          leaseOwner: 'worker-id',
          leaseExpiresAt,
        },
      }),
    );
  });

  it('reports a lost lease for every state transition', async () => {
    const h = harness();
    h.prisma.emailDeliveryIntent.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      h.store.markDelivered({
        id: 'delivery-id',
        workerId: 'other-worker',
        providerMessageId: 'provider-id',
        deliveredAt: now,
      }),
    ).resolves.toBe(false);
    await expect(
      h.store.markRetry({
        id: 'delivery-id',
        workerId: 'other-worker',
        nextAttemptAt: leaseExpiresAt,
      }),
    ).resolves.toBe(false);
    await expect(
      h.store.markTerminal({
        id: 'delivery-id',
        workerId: 'other-worker',
        reason: 'provider_permanent',
      }),
    ).resolves.toBe(false);
  });
});
