import { describe, expect, it, vi } from 'vitest';
import { loadPlanCatalog } from './plan-catalog.js';
import { createPrismaPlanSelectionStore } from './prisma-plan-selection-store.js';

const now = new Date('2026-08-27T02:00:00Z');
const catalog = loadPlanCatalog('test');
const entry = (priceId: 'free' | 'plus_annual' | 'enterprise') => {
  const found = catalog.entries.find(
    (candidate) => candidate.priceId === priceId,
  );
  if (!found) throw new Error(`Missing test plan ${priceId}`);
  return found;
};

function harness(continuation: unknown, advanced = 1) {
  const transaction = {
    onboardingContinuation: {
      findUnique: vi.fn().mockResolvedValue(continuation),
      update: vi.fn(),
    },
    onboardingJourney: {
      updateMany: vi.fn().mockResolvedValue({ count: advanced }),
    },
    onboardingPlanSelection: { upsert: vi.fn() },
  };
  const prisma = {
    onboardingContinuation: { findUnique: vi.fn() },
    $transaction: vi.fn(
      async (callback: (value: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  return {
    store: createPrismaPlanSelectionStore(prisma as never),
    prisma,
    transaction,
  };
}

describe('Prisma plan-selection store [onboarding-plan-selection REQ-006, REQ-008, REQ-009]', () => {
  it('loads only an unexpired plan-selection continuation with a profile', async () => {
    const { store, prisma } = harness(null);
    prisma.onboardingContinuation.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        expiresAt: new Date('2026-08-27T02:15:00Z'),
        user: {
          personalProfile: { firstName: 'Nabin' },
          planSelection: null,
          journeys: [{ id: 'journey' }],
        },
      })
      .mockResolvedValueOnce({
        expiresAt: new Date('2026-08-27T02:15:00Z'),
        user: {
          personalProfile: { firstName: 'Nabin' },
          planSelection: { priceId: 'plus_annual' },
          journeys: [{ id: 'journey' }],
        },
      });
    await expect(
      store.loadPage({ credentialDigest: 'missing', now }),
    ).resolves.toBeNull();
    await expect(
      store.loadPage({ credentialDigest: 'new', now }),
    ).resolves.toEqual({ firstName: 'Nabin', selectedPriceId: null });
    await expect(
      store.loadPage({ credentialDigest: 'digest', now }),
    ).resolves.toEqual({ firstName: 'Nabin', selectedPriceId: 'plus_annual' });
  });

  it.each([
    ['free', 'ORGANIZATION_PROFILE'],
    ['plus_annual', 'PAYMENT'],
    ['enterprise', 'PLAN_SELECTION'],
  ] as const)(
    'saves %s and advances to %s atomically',
    async (priceId, currentStep) => {
      const { store, transaction } = harness({
        userId: 'user',
        expiresAt: new Date('2026-08-27T02:15:00Z'),
      });
      await expect(
        store.save({
          credentialDigest: 'digest',
          nextCredentialDigest: 'next',
          nextCredentialExpiresAt: new Date('2026-08-27T02:15:00Z'),
          now,
          catalogVersion: catalog.version,
          entry: entry(priceId),
        }),
      ).resolves.toBe(true);
      expect(transaction.onboardingJourney.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { currentStep } }),
      );
      expect(transaction.onboardingPlanSelection.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user' } }),
      );
      expect(transaction.onboardingContinuation.update).toHaveBeenCalledWith({
        where: { userId: 'user' },
        data: {
          credentialDigest: 'next',
          expiresAt: new Date('2026-08-27T02:15:00Z'),
        },
      });
    },
  );

  it('rejects expired and concurrently advanced transitions without persisting', async () => {
    const expired = harness({ userId: 'user', expiresAt: now });
    await expect(
      expired.store.save({
        credentialDigest: 'digest',
        nextCredentialDigest: 'next',
        nextCredentialExpiresAt: now,
        now,
        catalogVersion: catalog.version,
        entry: entry('free'),
      }),
    ).resolves.toBe(false);
    const concurrent = harness(
      { userId: 'user', expiresAt: new Date('2026-08-27T02:15:00Z') },
      0,
    );
    await expect(
      concurrent.store.save({
        credentialDigest: 'digest',
        nextCredentialDigest: 'next',
        nextCredentialExpiresAt: now,
        now,
        catalogVersion: catalog.version,
        entry: entry('free'),
      }),
    ).resolves.toBe(false);
    expect(
      concurrent.transaction.onboardingPlanSelection.upsert,
    ).not.toHaveBeenCalled();
  });

  it('does not mask unexpected database failures', async () => {
    const failure = new Error('database unavailable');
    const store = createPrismaPlanSelectionStore({
      $transaction: vi.fn().mockRejectedValue(failure),
    } as never);
    await expect(
      store.save({
        credentialDigest: 'digest',
        nextCredentialDigest: 'next',
        nextCredentialExpiresAt: now,
        now,
        catalogVersion: catalog.version,
        entry: entry('free'),
      }),
    ).rejects.toBe(failure);
  });
});
