import { describe, expect, it, vi } from 'vitest';
import { createPrismaDiscoveryStore } from './prisma-discovery-store.js';

const now = new Date('2026-08-28T02:00:00Z');
const future = new Date('2026-08-28T02:15:00Z');

function harness(welcomeEmailEnabled = true) {
  const recordEvent = vi.fn();
  const transaction = {
    onboardingContinuation: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ userId: 'user', expiresAt: future }),
      delete: vi.fn(),
    },
    onboardingJourney: {
      findFirst: vi.fn().mockResolvedValue({ id: 'journey' }),
      findUnique: vi.fn().mockResolvedValue({ tenantId: 'tenant' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    onboardingDiscoverySubmission: {
      upsert: vi.fn(),
      findUnique: vi.fn().mockResolvedValue({
        journeyId: 'journey',
        credentialDigest: 'credential',
        requestDigest: null,
        consumedAt: null,
        expiresAt: future,
      }),
      update: vi.fn(),
    },
    onboardingDiscoveryResponse: { create: vi.fn() },
    emailDeliveryIntent: {
      create: vi.fn().mockResolvedValue({ id: 'delivery-id' }),
    },
    applicationSessionFamily: { create: vi.fn() },
  };
  const prisma = {
    onboardingDiscoverySubmission: { findUnique: vi.fn() },
    $transaction: vi.fn(
      async (callback: (value: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  return {
    store: createPrismaDiscoveryStore(
      prisma as never,
      welcomeEmailEnabled,
      recordEvent,
    ),
    prisma,
    recordEvent,
    transaction,
  };
}

const prepareInput = {
  credentialDigest: 'credential',
  submissionKeyDigest: 'key',
  now,
  expiresAt: future,
};
const completeInput = {
  credentialDigest: 'credential',
  submissionKeyDigest: 'key',
  requestDigest: 'request',
  now,
  answers: {
    outcome: 'submitted' as const,
    currentManagement: 'pdf' as const,
    currentManagementOther: null,
    challenges: 'Version control',
  },
  applicationSession: {
    accessCredentialDigest: 'access-digest',
    refreshCredentialDigest: 'refresh-digest',
    accessExpiresAt: future,
    absoluteExpiresAt: new Date('2026-09-27T02:00:00Z'),
  },
};

describe('Prisma discovery store [onboarding-discovery REQ-005..REQ-009, REQ-017; onboarding-welcome-email REQ-001..REQ-003, REQ-014, REQ-016]', () => {
  it('prepares a key only for the owner journey at discovery', async () => {
    const { store, transaction } = harness();
    await expect(store.prepare(prepareInput)).resolves.toBe(true);
    expect(transaction.onboardingJourney.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        currentStep: 'DISCOVERY',
        tenant: {
          memberships: { some: { userId: 'user', roleId: 'owner' } },
        },
      }),
      select: { id: true },
    });
    expect(
      transaction.onboardingDiscoverySubmission.upsert,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ where: { journeyId: 'journey' } }),
    );
  });

  it('rejects missing, expired, or ineligible preparation and exposes database failures', async () => {
    for (const continuation of [null, { userId: 'user', expiresAt: now }]) {
      const h = harness();
      h.transaction.onboardingContinuation.findUnique.mockResolvedValue(
        continuation,
      );
      await expect(h.store.prepare(prepareInput)).resolves.toBe(false);
    }
    const missingJourney = harness();
    missingJourney.transaction.onboardingJourney.findFirst.mockResolvedValue(
      null,
    );
    await expect(missingJourney.store.prepare(prepareInput)).resolves.toBe(
      false,
    );
    const failure = new Error('database unavailable');
    const store = createPrismaDiscoveryStore({
      $transaction: vi.fn().mockRejectedValue(failure),
    } as never);
    await expect(store.prepare(prepareInput)).rejects.toBe(failure);
  });

  it.each([
    ['submitted', completeInput.answers],
    [
      'skipped',
      {
        outcome: 'skipped' as const,
        currentManagement: null,
        currentManagementOther: null,
        challenges: null,
      },
    ],
  ])('atomically completes a %s response', async (_name, answers) => {
    const { store, transaction, recordEvent } = harness();
    await expect(store.complete({ ...completeInput, answers })).resolves.toBe(
      'created',
    );
    expect(transaction.onboardingJourney.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        currentStep: 'DISCOVERY',
        completedAt: null,
      }),
      data: { currentStep: 'COMPLETE', completedAt: now },
    });
    expect(transaction.onboardingDiscoveryResponse.create).toHaveBeenCalledWith(
      { data: expect.objectContaining({ journeyId: 'journey', ...answers }) },
    );
    expect(transaction.onboardingContinuation.delete).toHaveBeenCalledWith({
      where: { userId: 'user' },
    });
    expect(transaction.applicationSessionFamily.create).toHaveBeenCalledWith({
      data: {
        userId: 'user',
        tenantId: 'tenant',
        absoluteExpiresAt: completeInput.applicationSession.absoluteExpiresAt,
        credentials: {
          create: [
            {
              kind: 'ACCESS',
              credentialDigest: 'access-digest',
              expiresAt: future,
            },
            {
              kind: 'REFRESH',
              credentialDigest: 'refresh-digest',
              expiresAt: completeInput.applicationSession.absoluteExpiresAt,
            },
          ],
        },
      },
    });
    expect(transaction.emailDeliveryIntent.create).toHaveBeenCalledWith({
      data: {
        journeyId: 'journey',
        kind: 'ONBOARDING_WELCOME',
        nextAttemptAt: now,
      },
      select: { id: true },
    });
    expect(recordEvent).toHaveBeenCalledWith('welcome_email_intent_created', {
      correlationId: 'delivery-id',
      intentId: 'delivery-id',
      template: 'ONBOARDING_WELCOME',
      state: 'pending',
      attempt: 0,
      ageSeconds: 0,
      category: 'created',
    });
  });

  it('returns replay or conflict before checking the deleted continuation', async () => {
    const replay = harness();
    replay.transaction.onboardingDiscoverySubmission.findUnique.mockResolvedValue(
      {
        journeyId: 'journey',
        credentialDigest: 'credential',
        requestDigest: 'request',
        consumedAt: now,
        expiresAt: future,
      },
    );
    await expect(replay.store.complete(completeInput)).resolves.toBe('replay');
    await expect(
      replay.store.complete({ ...completeInput, requestDigest: 'different' }),
    ).resolves.toBe('conflict');
  });

  it('does not create a Welcome delivery intent while rollout is disabled', async () => {
    const { store, transaction } = harness(false);
    await expect(store.complete(completeInput)).resolves.toBe('created');
    expect(transaction.emailDeliveryIntent.create).not.toHaveBeenCalled();
  });

  it('rejects invalid and concurrent completion without writing a response', async () => {
    const cases = [
      (h: ReturnType<typeof harness>) =>
        h.transaction.onboardingDiscoverySubmission.findUnique.mockResolvedValue(
          null,
        ),
      (h: ReturnType<typeof harness>) =>
        h.transaction.onboardingDiscoverySubmission.findUnique.mockResolvedValue(
          {
            journeyId: 'journey',
            credentialDigest: 'other',
            requestDigest: null,
            consumedAt: null,
            expiresAt: future,
          },
        ),
      (h: ReturnType<typeof harness>) =>
        h.transaction.onboardingContinuation.findUnique.mockResolvedValue(null),
      (h: ReturnType<typeof harness>) =>
        h.transaction.onboardingContinuation.findUnique.mockResolvedValue({
          userId: 'user',
          expiresAt: now,
        }),
      (h: ReturnType<typeof harness>) =>
        h.transaction.onboardingJourney.updateMany.mockResolvedValue({
          count: 0,
        }),
      (h: ReturnType<typeof harness>) =>
        h.transaction.onboardingJourney.findUnique.mockResolvedValue(null),
    ];
    for (const arrange of cases) {
      const h = harness();
      arrange(h);
      await expect(h.store.complete(completeInput)).resolves.toBe('rejected');
      expect(
        h.transaction.onboardingDiscoveryResponse.create,
      ).not.toHaveBeenCalled();
    }
  });

  it('resolves a concurrent loser and maps database failures safely', async () => {
    const concurrent = harness();
    concurrent.transaction.onboardingJourney.updateMany.mockResolvedValue({
      count: 0,
    });
    concurrent.prisma.onboardingDiscoverySubmission.findUnique.mockResolvedValue(
      {
        credentialDigest: 'credential',
        requestDigest: 'request',
        consumedAt: now,
        expiresAt: future,
      },
    );
    await expect(concurrent.store.complete(completeInput)).resolves.toBe(
      'replay',
    );
    concurrent.prisma.onboardingDiscoverySubmission.findUnique.mockResolvedValue(
      {
        credentialDigest: 'credential',
        requestDigest: 'different',
        consumedAt: now,
        expiresAt: future,
      },
    );
    await expect(concurrent.store.complete(completeInput)).resolves.toBe(
      'conflict',
    );
    concurrent.prisma.onboardingDiscoverySubmission.findUnique.mockResolvedValue(
      null,
    );
    await expect(concurrent.store.complete(completeInput)).resolves.toBe(
      'rejected',
    );

    const unique = createPrismaDiscoveryStore({
      $transaction: vi.fn().mockRejectedValue({ code: 'P2002' }),
      onboardingDiscoverySubmission: { findUnique: vi.fn() },
    } as never);
    await expect(unique.complete(completeInput)).resolves.toBe('rejected');
    const failure = new Error('database unavailable');
    const broken = createPrismaDiscoveryStore({
      $transaction: vi.fn().mockRejectedValue(failure),
      onboardingDiscoverySubmission: { findUnique: vi.fn() },
    } as never);
    await expect(broken.complete(completeInput)).rejects.toBe(failure);
    const malformed = createPrismaDiscoveryStore({
      $transaction: vi.fn().mockRejectedValue('unknown'),
      onboardingDiscoverySubmission: { findUnique: vi.fn() },
    } as never);
    await expect(malformed.complete(completeInput)).rejects.toThrow(
      'Unexpected discovery database failure',
    );
  });
});
