import { describe, expect, it, vi } from 'vitest';
import { createPrismaExternalLoginStore } from './prisma-external-login-store.js';

describe('Prisma external login store [user-login REQ-011, REQ-013, REQ-014]', () => {
  it('persists only digests and encrypted transient provider secrets', async () => {
    const create = vi.fn();
    const store = createPrismaExternalLoginStore({
      externalAuthorizationTransaction: { create },
    } as never);
    const input = {
      provider: 'google' as const,
      intent: 'login' as const,
      stateDigest: 'state-digest',
      nonceDigest: 'nonce-digest',
      pkceVerifierDigest: 'verifier-digest',
      sealedSecrets: 'ciphertext',
      redirectUri: 'https://app.example/auth/callback/google',
      expiresAt: new Date('2026-08-30T00:10:00.000Z'),
    };
    await store.createTransaction(input);
    expect(create).toHaveBeenCalledWith({
      data: {
        ...input,
        provider: 'GOOGLE',
        intent: 'LOGIN',
      },
    });
  });

  it('atomically consumes an unexpired provider transaction once', async () => {
    const transaction = {
      externalAuthorizationTransaction: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          intent: 'LOGIN',
          redirectUri: 'https://app.example/auth/callback/google',
          nonceDigest: 'nonce-digest',
          pkceVerifierDigest: 'verifier-digest',
          sealedSecrets: 'ciphertext',
        }),
      },
    };
    const store = createPrismaExternalLoginStore({
      $transaction: vi.fn(
        async (callback: (value: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    } as never);
    const now = new Date('2026-08-30T00:00:00.000Z');
    await expect(
      store.consumeTransaction({
        provider: 'google',
        stateDigest: 'state-digest',
        now,
      }),
    ).resolves.toEqual({
      intent: 'login',
      redirectUri: 'https://app.example/auth/callback/google',
      nonceDigest: 'nonce-digest',
      pkceVerifierDigest: 'verifier-digest',
      sealedSecrets: 'ciphertext',
    });
    expect(
      transaction.externalAuthorizationTransaction.updateMany,
    ).toHaveBeenCalledWith({
      where: {
        provider: 'GOOGLE',
        stateDigest: 'state-digest',
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
  });

  it('returns null if a consumed transaction disappears and maps onboarding intent', async () => {
    const transaction = {
      externalAuthorizationTransaction: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
          intent: 'ONBOARDING',
          redirectUri: 'https://app.example/auth/callback/google',
          nonceDigest: 'nonce',
          pkceVerifierDigest: 'verifier',
          sealedSecrets: 'sealed',
        }),
      },
    };
    const store = createPrismaExternalLoginStore({
      $transaction: vi.fn(
        async (callback: (value: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    } as never);
    const input = {
      provider: 'google' as const,
      stateDigest: 'state',
      now: new Date(),
    };
    await expect(store.consumeTransaction(input)).resolves.toBeNull();
    await expect(store.consumeTransaction(input)).resolves.toEqual(
      expect.objectContaining({ intent: 'onboarding' }),
    );
  });

  it('fails closed for replay and an unbound identity', async () => {
    const replayTransaction = {
      externalAuthorizationTransaction: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi
        .fn()
        .mockImplementationOnce(
          async (
            callback: (value: typeof replayTransaction) => Promise<unknown>,
          ) => callback(replayTransaction),
        )
        .mockImplementationOnce(
          async (callback: (value: object) => Promise<unknown>) =>
            callback({
              externalIdentity: { findUnique: vi.fn().mockResolvedValue(null) },
            }),
        ),
    };
    const store = createPrismaExternalLoginStore(prisma as never);
    await expect(
      store.consumeTransaction({
        provider: 'apple',
        stateDigest: 'state',
        now: new Date(),
      }),
    ).resolves.toBeNull();
    await expect(
      store.completeIdentityLogin({
        provider: 'apple',
        subject: 'subject',
        now: new Date(),
        accessCredentialDigest: 'access',
        accessExpiresAt: new Date(),
        refreshCredentialDigest: 'refresh',
        absoluteExpiresAt: new Date(),
        onboardingCredentialDigest: 'onboarding',
        onboardingExpiresAt: new Date(),
      }),
    ).resolves.toBeNull();
  });

  it('resumes every supported onboarding step for a bound verified identity', async () => {
    const destinations = {
      PERSONAL_PROFILE: '/onboarding/about-you',
      PLAN_SELECTION: '/onboarding/plan-selection',
      PAYMENT: '/onboarding/payment',
      ORGANIZATION_PROFILE: '/onboarding/organization-profile',
      DISCOVERY: '/onboarding/discovery',
    } as const;
    for (const [currentStep, destination] of Object.entries(destinations)) {
      const transaction = identityTransaction(
        externalUser({ journeys: [{ currentStep, completedAt: null }] }),
      );
      const store = storeForTransaction(transaction);
      await expect(
        store.completeIdentityLogin(identityInput()),
      ).resolves.toEqual({
        destination,
        sessionKind: 'onboarding',
      });
      expect(transaction.onboardingContinuation.upsert).toHaveBeenCalled();
    }
  });

  it('limits completed-account session families and issues a Hansel session', async () => {
    const transaction = identityTransaction(
      externalUser({
        sessionFamilies: Array.from({ length: 6 }, (_, index) => ({
          id: `family-${String(index + 1)}`,
        })),
      }),
    );
    const store = storeForTransaction(transaction);
    await expect(store.completeIdentityLogin(identityInput())).resolves.toEqual(
      {
        destination: '/dashboard',
        sessionKind: 'application',
      },
    );
    expect(transaction.applicationSessionFamily.update).toHaveBeenCalledTimes(
      2,
    );
    expect(transaction.applicationSessionFamily.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          tenantId: 'tenant-1',
        }),
      }),
    );
  });

  it.each([
    ['unverified', externalUser({ emailVerifiedAt: null })],
    ['ambiguous journey', externalUser({ journeys: [] })],
    [
      'unknown onboarding step',
      externalUser({
        journeys: [{ currentStep: 'UNKNOWN', completedAt: null }],
      }),
    ],
    [
      'invalid completed step',
      externalUser({
        journeys: [{ currentStep: 'DISCOVERY', completedAt: new Date() }],
      }),
    ],
    ['ambiguous membership', externalUser({ memberships: [] })],
  ])('fails closed for a bound identity with %s', async (_name, user) => {
    const store = storeForTransaction(identityTransaction(user));
    await expect(
      store.completeIdentityLogin(identityInput()),
    ).resolves.toBeNull();
  });
});

function externalUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    emailVerifiedAt: new Date('2026-08-29T00:00:00.000Z'),
    journeys: [{ currentStep: 'COMPLETE', completedAt: new Date() }],
    memberships: [{ tenantId: 'tenant-1' }],
    sessionFamilies: [],
    ...overrides,
  };
}

function identityTransaction(user: ReturnType<typeof externalUser>) {
  return {
    externalIdentity: {
      findUnique: vi.fn().mockResolvedValue({ user }),
    },
    onboardingContinuation: { upsert: vi.fn() },
    applicationSessionFamily: { update: vi.fn(), create: vi.fn() },
  };
}

function storeForTransaction(
  transaction: ReturnType<typeof identityTransaction>,
) {
  return createPrismaExternalLoginStore({
    $transaction: vi.fn(
      async (callback: (value: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  } as never);
}

function identityInput() {
  return {
    provider: 'google' as const,
    subject: 'subject',
    now: new Date('2026-08-30T00:00:00.000Z'),
    accessCredentialDigest: 'access',
    accessExpiresAt: new Date('2026-08-30T00:15:00.000Z'),
    refreshCredentialDigest: 'refresh',
    absoluteExpiresAt: new Date('2026-09-30T00:00:00.000Z'),
    onboardingCredentialDigest: 'onboarding',
    onboardingExpiresAt: new Date('2026-08-30T00:15:00.000Z'),
  };
}
