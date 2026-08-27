import { describe, expect, it, vi } from 'vitest';
import { createPrismaOrganizationProfileStore } from './prisma-organization-profile-store.js';

const now = new Date('2026-08-27T02:00:00Z');
const future = new Date('2026-08-27T02:15:00Z');
const profile = {
  organizationName: 'Hansel',
  country: 'AU',
  industry: 'healthcare',
  placeService: 'clinics',
  organizationSize: 'employees_11_50',
} as const;

function harness() {
  const transaction = {
    onboardingContinuation: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ userId: 'user', expiresAt: future }),
      update: vi.fn(),
    },
    onboardingJourney: {
      findFirst: vi.fn().mockResolvedValue({ id: 'journey' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
    },
    organizationProfileSubmission: {
      upsert: vi.fn(),
      findUnique: vi.fn().mockResolvedValue({
        journeyId: 'journey',
        credentialDigest: 'credential',
        nextCredentialDigest: null,
        requestDigest: null,
        consumedAt: null,
        expiresAt: future,
      }),
      update: vi.fn(),
    },
    tenant: { create: vi.fn().mockResolvedValue({ id: 'tenant' }) },
  };
  const prisma = {
    organizationProfileSubmission: { findUnique: vi.fn() },
    $transaction: vi.fn(
      async (callback: (value: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  return {
    store: createPrismaOrganizationProfileStore(prisma as never),
    prisma,
    transaction,
  };
}

const prepareInput = {
  credentialDigest: 'credential',
  submissionKeyDigest: 'key',
  now,
  expiresAt: future,
};
const saveInput = {
  ...prepareInput,
  requestDigest: 'request',
  nextCredentialDigest: 'next',
  nextCredentialExpiresAt: future,
  profile,
};

describe('Prisma organization-profile store [onboarding-organization-profile REQ-006..REQ-012]', () => {
  it('prepares a server-issued submission key for the active journey', async () => {
    const { store, transaction } = harness();
    await expect(store.prepare(prepareInput)).resolves.toBe(true);
    expect(
      transaction.organizationProfileSubmission.upsert,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ where: { journeyId: 'journey' } }),
    );
  });

  it('rejects missing, expired, or ineligible preparation and exposes database failures', async () => {
    for (const continuation of [null, { userId: 'user', expiresAt: now }]) {
      const { store, transaction } = harness();
      transaction.onboardingContinuation.findUnique.mockResolvedValue(
        continuation,
      );
      await expect(store.prepare(prepareInput)).resolves.toBe(false);
    }
    const missingJourney = harness();
    missingJourney.transaction.onboardingJourney.findFirst.mockResolvedValue(
      null,
    );
    await expect(missingJourney.store.prepare(prepareInput)).resolves.toBe(
      false,
    );
    const failure = new Error('database unavailable');
    const store = createPrismaOrganizationProfileStore({
      $transaction: vi.fn().mockRejectedValue(failure),
    } as never);
    await expect(store.prepare(prepareInput)).rejects.toBe(failure);
  });

  it('creates the tenant, sole owner membership, journey link, and rotated continuation atomically', async () => {
    const { store, transaction } = harness();
    await expect(store.save(saveInput)).resolves.toBe('created');
    expect(transaction.tenant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Hansel',
        memberships: { create: { userId: 'user', roleId: 'owner' } },
      }),
      select: { id: true },
    });
    expect(transaction.onboardingJourney.update).toHaveBeenCalledWith({
      where: { id: 'journey' },
      data: { tenantId: 'tenant' },
    });
    expect(transaction.onboardingContinuation.update).toHaveBeenCalled();
  });

  it('returns replay or conflict for a consumed submission before checking the old continuation', async () => {
    const replay = harness();
    replay.transaction.organizationProfileSubmission.findUnique.mockResolvedValue(
      {
        journeyId: 'journey',
        credentialDigest: 'credential',
        nextCredentialDigest: 'next',
        requestDigest: 'request',
        consumedAt: now,
        expiresAt: future,
      },
    );
    await expect(replay.store.save(saveInput)).resolves.toBe('replay-initial');
    await expect(
      replay.store.save({ ...saveInput, credentialDigest: 'next' }),
    ).resolves.toBe('replay-current');
    const conflict = harness();
    conflict.transaction.organizationProfileSubmission.findUnique.mockResolvedValue(
      {
        journeyId: 'journey',
        credentialDigest: 'credential',
        nextCredentialDigest: 'next',
        requestDigest: 'different',
        consumedAt: now,
        expiresAt: future,
      },
    );
    await expect(conflict.store.save(saveInput)).resolves.toBe('conflict');
  });

  it('rejects invalid and concurrent saves without creating a tenant', async () => {
    const cases = [
      (h: ReturnType<typeof harness>) =>
        h.transaction.organizationProfileSubmission.findUnique.mockResolvedValue(
          null,
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
      (h: ReturnType<typeof harness>) => {
        h.transaction.organizationProfileSubmission.findUnique.mockResolvedValue(
          {
            journeyId: 'journey',
            credentialDigest: 'credential',
            nextCredentialDigest: 'next',
            requestDigest: null,
            consumedAt: null,
            expiresAt: future,
          },
        );
        return undefined;
      },
    ];
    for (const arrange of cases) {
      const h = harness();
      arrange(h);
      const credentialDigest =
        cases.indexOf(arrange) === cases.length - 1 ? 'next' : 'credential';
      await expect(
        h.store.save({ ...saveInput, credentialDigest }),
      ).resolves.toBe('rejected');
      expect(h.transaction.tenant.create).not.toHaveBeenCalled();
    }
  });

  it('maps uniqueness races to rejection but does not mask unexpected failures', async () => {
    const unique = createPrismaOrganizationProfileStore({
      $transaction: vi.fn().mockRejectedValue({ code: 'P2002' }),
    } as never);
    await expect(unique.save(saveInput)).resolves.toBe('rejected');
    const failure = new Error('database unavailable');
    const broken = createPrismaOrganizationProfileStore({
      $transaction: vi.fn().mockRejectedValue(failure),
    } as never);
    await expect(broken.save(saveInput)).rejects.toBe(failure);
    const malformed = createPrismaOrganizationProfileStore({
      $transaction: vi.fn().mockRejectedValue('unknown failure'),
    } as never);
    await expect(malformed.save(saveInput)).rejects.toThrow(
      'Unexpected organization profile database failure',
    );
  });

  it.each([
    ['credential', 'request', future, 'replay-initial'],
    ['next', 'request', future, 'replay-current'],
    ['credential', 'different', future, 'conflict'],
    ['other', 'request', future, 'rejected'],
    ['credential', 'request', now, 'rejected'],
  ] as const)(
    'resolves a concurrent loser for credential %s as %s',
    async (credentialDigest, requestDigest, expiresAt, expected) => {
      const h = harness();
      h.transaction.onboardingJourney.updateMany.mockResolvedValue({
        count: 0,
      });
      h.prisma.organizationProfileSubmission.findUnique.mockResolvedValue({
        credentialDigest: 'credential',
        nextCredentialDigest: 'next',
        requestDigest: 'request',
        consumedAt: now,
        expiresAt,
      });
      await expect(
        h.store.save({ ...saveInput, credentialDigest, requestDigest }),
      ).resolves.toBe(expected);
    },
  );
});
