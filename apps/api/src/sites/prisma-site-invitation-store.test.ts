import { describe, expect, it, vi } from 'vitest';
import { createPrismaSiteInvitationStore } from './prisma-site-invitation-store.js';

const now = new Date('2026-09-01T12:00:00Z');
const leaseExpiresAt = new Date('2026-09-01T12:01:00Z');

function harness() {
  const transaction = {
    siteInvitationDeliveryIntent: {
      findFirst: vi.fn().mockResolvedValue({ id: 'delivery-id' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({
        id: 'delivery-id',
        attempts: 1,
        invitation: {
          id: 'invitation-id',
          email: 'viewer@example.com',
          expiresAt: new Date('2026-09-08T12:00:00Z'),
          site: { name: 'Sydney', tenant: { name: 'Hansel' } },
        },
      }),
    },
  };
  const prisma = {
    $transaction: vi.fn(
      (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
    siteInvitationDeliveryIntent: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return {
    store: createPrismaSiteInvitationStore(prisma as never),
    transaction,
    prisma,
  };
}

describe('Prisma site invitation store [sites-add-new REQ-014, REQ-015]', () => {
  it('atomically claims and resolves one delivery', async () => {
    const h = harness();
    await expect(
      h.store.claim({ workerId: 'worker-id', now, leaseExpiresAt }),
    ).resolves.toEqual({
      deliveryId: 'delivery-id',
      invitationId: 'invitation-id',
      recipient: 'viewer@example.com',
      organizationName: 'Hansel',
      siteName: 'Sydney',
      expiresAt: new Date('2026-09-08T12:00:00Z'),
      attempts: 1,
    });
    expect(
      h.transaction.siteInvitationDeliveryIntent.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          attempts: { increment: 1 },
          leaseOwner: 'worker-id',
          leaseExpiresAt,
        },
      }),
    );
  });

  it('loses empty, raced, and vanished claims safely', async () => {
    const empty = harness();
    empty.transaction.siteInvitationDeliveryIntent.findFirst.mockResolvedValue(
      null,
    );
    await expect(
      empty.store.claim({ workerId: 'w', now, leaseExpiresAt }),
    ).resolves.toBeNull();
    const raced = harness();
    raced.transaction.siteInvitationDeliveryIntent.updateMany.mockResolvedValue(
      { count: 0 },
    );
    await expect(
      raced.store.claim({ workerId: 'w', now, leaseExpiresAt }),
    ).resolves.toBeNull();
    const vanished = harness();
    vanished.transaction.siteInvitationDeliveryIntent.findUnique.mockResolvedValue(
      null,
    );
    await expect(
      vanished.store.claim({ workerId: 'w', now, leaseExpiresAt }),
    ).resolves.toBeNull();
  });

  it('changes state only while the worker owns the lease', async () => {
    const h = harness();
    await expect(
      h.store.markDelivered({
        deliveryId: 'delivery-id',
        workerId: 'worker-id',
        providerId: 'provider-id',
        deliveredAt: now,
      }),
    ).resolves.toBe(true);
    await expect(
      h.store.markRetry({
        deliveryId: 'delivery-id',
        workerId: 'worker-id',
        nextAttemptAt: leaseExpiresAt,
        errorCode: 'provider_failure',
      }),
    ).resolves.toBe(true);
    await expect(
      h.store.markTerminal({
        deliveryId: 'delivery-id',
        workerId: 'worker-id',
        terminalAt: now,
        errorCode: 'expired',
      }),
    ).resolves.toBe(true);
    h.prisma.siteInvitationDeliveryIntent.updateMany.mockResolvedValue({
      count: 0,
    });
    await expect(
      h.store.markDelivered({
        deliveryId: 'delivery-id',
        workerId: 'lost',
        providerId: 'provider-id',
        deliveredAt: now,
      }),
    ).resolves.toBe(false);
    expect(
      h.prisma.siteInvitationDeliveryIntent.updateMany,
    ).toHaveBeenCalledTimes(4);
  });
});
