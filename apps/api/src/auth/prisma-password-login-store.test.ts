import { describe, expect, it, vi } from 'vitest';
import { createPrismaPasswordLoginStore } from './prisma-password-login-store.js';

describe('Prisma password login store [user-login REQ-005..REQ-011]', () => {
  it('loads only password verification and current lock data by normalized email', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 'user-1',
      password: { passwordHash: 'stored-hash' },
      passwordAuthenticationState: {
        lockedUntil: new Date('2026-08-29T00:15:00.000Z'),
      },
    });
    const store = createPrismaPasswordLoginStore({
      user: { findUnique },
    } as never);

    await expect(store.loadAccount('owner@example.com')).resolves.toEqual({
      userId: 'user-1',
      passwordHash: 'stored-hash',
      lockedUntil: new Date('2026-08-29T00:15:00.000Z'),
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'owner@example.com' },
      select: {
        id: true,
        password: { select: { passwordHash: true } },
        passwordAuthenticationState: { select: { lockedUntil: true } },
      },
    });
  });

  it('returns null without a password and defaults missing lock state', async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'user-1', password: null })
      .mockResolvedValueOnce({
        id: 'user-1',
        password: { passwordHash: 'hash' },
        passwordAuthenticationState: null,
      });
    const store = createPrismaPasswordLoginStore({
      user: { findUnique },
    } as never);
    await expect(store.loadAccount('one@example.com')).resolves.toBeNull();
    await expect(store.loadAccount('two@example.com')).resolves.toBeNull();
    await expect(store.loadAccount('three@example.com')).resolves.toEqual({
      userId: 'user-1',
      passwordHash: 'hash',
      lockedUntil: null,
    });
  });

  it('atomically turns the fifth in-window failure into one 15-minute lock intent', async () => {
    const transaction = {
      passwordAuthenticationState: {
        findUnique: vi.fn().mockResolvedValue({
          failedAttempts: 4,
          windowStartedAt: new Date('2026-08-28T23:50:00.000Z'),
          lockedUntil: null,
        }),
        upsert: vi.fn(),
      },
      passwordLockNotificationIntent: { upsert: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (value: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const store = createPrismaPasswordLoginStore(prisma as never);
    const now = new Date('2026-08-29T00:00:00.000Z');

    await expect(
      store.recordFailure({ userId: 'user-1', now }),
    ).resolves.toBeUndefined();
    expect(transaction.passwordAuthenticationState.upsert).toHaveBeenCalledWith(
      {
        where: { userId: 'user-1' },
        create: {
          userId: 'user-1',
          failedAttempts: 5,
          windowStartedAt: new Date('2026-08-28T23:50:00.000Z'),
          lockedUntil: new Date('2026-08-29T00:15:00.000Z'),
        },
        update: {
          failedAttempts: 5,
          windowStartedAt: new Date('2026-08-28T23:50:00.000Z'),
          lockedUntil: new Date('2026-08-29T00:15:00.000Z'),
        },
      },
    );
    expect(
      transaction.passwordLockNotificationIntent.upsert,
    ).toHaveBeenCalledWith({
      where: {
        userId_lockStartedAt: { userId: 'user-1', lockStartedAt: now },
      },
      create: {
        userId: 'user-1',
        lockStartedAt: now,
        nextAttemptAt: now,
      },
      update: {},
    });
  });

  it('ignores an active lock and starts or advances non-terminal windows', async () => {
    const state = {
      failedAttempts: 1,
      windowStartedAt: new Date('2026-08-29T00:00:00.000Z'),
      lockedUntil: new Date('2026-08-29T00:30:00.000Z'),
    };
    const transaction = {
      passwordAuthenticationState: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(state)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            failedAttempts: undefined,
            windowStartedAt: new Date('2026-08-29T00:09:00.000Z'),
            lockedUntil: null,
          }),
        upsert: vi.fn(),
      },
      passwordLockNotificationIntent: { upsert: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (value: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const store = createPrismaPasswordLoginStore(prisma as never);
    const now = new Date('2026-08-29T00:10:00.000Z');
    await store.recordFailure({ userId: 'user-1', now });
    expect(
      transaction.passwordAuthenticationState.upsert,
    ).not.toHaveBeenCalled();

    await store.recordFailure({ userId: 'user-1', now });
    expect(
      transaction.passwordAuthenticationState.upsert,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          failedAttempts: 1,
          windowStartedAt: now,
        }),
      }),
    );

    await store.recordFailure({ userId: 'user-1', now });
    expect(
      transaction.passwordAuthenticationState.upsert,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ failedAttempts: 1 }),
      }),
    );
    expect(
      transaction.passwordLockNotificationIntent.upsert,
    ).not.toHaveBeenCalled();
  });

  it('retries PostgreSQL serialization conflicts with a strict bound', async () => {
    const transaction = {
      passwordAuthenticationState: {
        findUnique: vi.fn().mockResolvedValue({
          failedAttempts: 0,
          windowStartedAt: null,
          lockedUntil: new Date('2026-08-29T01:00:00.000Z'),
        }),
        upsert: vi.fn(),
      },
      passwordLockNotificationIntent: { upsert: vi.fn() },
    };
    const transactionCall = vi
      .fn()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(
        async (callback: (value: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      );
    const store = createPrismaPasswordLoginStore({
      $transaction: transactionCall,
    } as never);
    await expect(
      store.recordFailure({
        userId: 'user-1',
        now: new Date('2026-08-29T00:10:00.000Z'),
      }),
    ).resolves.toBeUndefined();
    expect(transactionCall).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['database unavailable', 1],
    [null, 1],
    [new Error('database unavailable'), 1],
    [{ code: 'P2034' }, 10],
  ])(
    'surfaces non-retryable or exhausted transaction failures',
    async (error, calls) => {
      const transactionCall = vi.fn().mockRejectedValue(error);
      const store = createPrismaPasswordLoginStore({
        $transaction: transactionCall,
      } as never);
      await expect(
        store.recordFailure({ userId: 'user-1', now: new Date() }),
      ).rejects.toBe(error);
      expect(transactionCall).toHaveBeenCalledTimes(calls);
    },
  );

  it('resets failures, evicts the oldest of five families, and issues one completed-account session', async () => {
    const transaction = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          emailVerifiedAt: new Date('2026-08-28T00:00:00.000Z'),
          password: { passwordHash: 'stored-hash' },
          passwordAuthenticationState: { lockedUntil: null },
          journeys: [{ currentStep: 'COMPLETE', completedAt: new Date() }],
          memberships: [{ tenantId: 'tenant-1' }],
          sessionFamilies: Array.from({ length: 5 }, (_, index) => ({
            id: `family-${String(index + 1)}`,
          })),
        }),
      },
      passwordAuthenticationState: { upsert: vi.fn() },
      onboardingContinuation: { upsert: vi.fn() },
      applicationSessionFamily: {
        update: vi.fn(),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (value: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const store = createPrismaPasswordLoginStore(prisma as never);
    const now = new Date('2026-08-29T00:00:00.000Z');

    await expect(
      store.completeSuccess({
        userId: 'user-1',
        expectedPasswordHash: 'stored-hash',
        now,
        accessCredentialDigest: 'access-digest',
        accessExpiresAt: new Date('2026-08-29T00:15:00.000Z'),
        refreshCredentialDigest: 'refresh-digest',
        absoluteExpiresAt: new Date('2026-09-28T00:00:00.000Z'),
        onboardingCredentialDigest: 'onboarding-digest',
        onboardingExpiresAt: new Date('2026-08-29T00:15:00.000Z'),
      }),
    ).resolves.toEqual({
      destination: '/dashboard',
      sessionKind: 'application',
    });
    expect(transaction.applicationSessionFamily.update).toHaveBeenCalledWith({
      where: { id: 'family-1' },
      data: {
        revokedAt: now,
        revocationReason: 'active_family_limit',
      },
    });
    expect(transaction.applicationSessionFamily.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        absoluteExpiresAt: new Date('2026-09-28T00:00:00.000Z'),
        credentials: {
          create: [
            {
              kind: 'ACCESS',
              credentialDigest: 'access-digest',
              expiresAt: new Date('2026-08-29T00:15:00.000Z'),
            },
            {
              kind: 'REFRESH',
              credentialDigest: 'refresh-digest',
              expiresAt: new Date('2026-09-28T00:00:00.000Z'),
            },
          ],
        },
      },
    });
  });

  it('resumes verification and each supported onboarding destination', async () => {
    const cases = [
      ['VERIFY_EMAIL', null, '/onboarding/verify-email', 'verification'],
      ['PERSONAL_PROFILE', new Date(), '/onboarding/about-you', 'onboarding'],
      [
        'PLAN_SELECTION',
        new Date(),
        '/onboarding/plan-selection',
        'onboarding',
      ],
      ['PAYMENT', new Date(), '/onboarding/payment', 'onboarding'],
      [
        'ORGANIZATION_PROFILE',
        new Date(),
        '/onboarding/organization-profile',
        'onboarding',
      ],
      ['DISCOVERY', new Date(), '/onboarding/discovery', 'onboarding'],
    ] as const;
    for (const [currentStep, verifiedAt, destination, sessionKind] of cases) {
      const transaction = {
        user: {
          findUnique: vi.fn().mockResolvedValue({
            emailVerifiedAt: verifiedAt,
            password: { passwordHash: 'stored-hash' },
            passwordAuthenticationState: null,
            journeys: [{ currentStep, completedAt: null }],
            memberships: [],
            sessionFamilies: [],
          }),
        },
        passwordAuthenticationState: { upsert: vi.fn() },
        onboardingContinuation: { upsert: vi.fn() },
        applicationSessionFamily: { update: vi.fn(), create: vi.fn() },
      };
      const store = createPrismaPasswordLoginStore({
        $transaction: vi.fn(
          async (callback: (value: typeof transaction) => Promise<unknown>) =>
            callback(transaction),
        ),
      } as never);
      await expect(store.completeSuccess(successInput())).resolves.toEqual({
        destination,
        sessionKind,
      });
      expect(transaction.passwordAuthenticationState.upsert).toHaveBeenCalled();
      if (sessionKind === 'onboarding')
        expect(transaction.onboardingContinuation.upsert).toHaveBeenCalled();
    }
  });

  it.each([
    ['missing user', null],
    ['changed password', validUser({ password: { passwordHash: 'changed' } })],
    [
      'new lock',
      validUser({
        passwordAuthenticationState: {
          lockedUntil: new Date('2026-08-29T01:00:00.000Z'),
        },
      }),
    ],
    ['ambiguous journey', validUser({ journeys: [] })],
    [
      'invalid verification state',
      validUser({
        emailVerifiedAt: null,
        journeys: [{ currentStep: 'PAYMENT', completedAt: null }],
      }),
    ],
    [
      'unknown onboarding state',
      validUser({ journeys: [{ currentStep: 'UNKNOWN', completedAt: null }] }),
    ],
    [
      'invalid completed state',
      validUser({
        journeys: [{ currentStep: 'DISCOVERY', completedAt: new Date() }],
      }),
    ],
    ['ambiguous membership', validUser({ memberships: [] })],
  ])('fails closed for %s during atomic success', async (_name, user) => {
    const transaction = {
      user: { findUnique: vi.fn().mockResolvedValue(user) },
      passwordAuthenticationState: { upsert: vi.fn() },
      onboardingContinuation: { upsert: vi.fn() },
      applicationSessionFamily: { update: vi.fn(), create: vi.fn() },
    };
    const store = createPrismaPasswordLoginStore({
      $transaction: vi.fn(
        async (callback: (value: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    } as never);
    await expect(store.completeSuccess(successInput())).resolves.toBeNull();
  });
});

function successInput() {
  return {
    userId: 'user-1',
    expectedPasswordHash: 'stored-hash',
    now: new Date('2026-08-29T00:00:00.000Z'),
    accessCredentialDigest: 'access',
    accessExpiresAt: new Date('2026-08-29T00:15:00.000Z'),
    refreshCredentialDigest: 'refresh',
    absoluteExpiresAt: new Date('2026-09-29T00:00:00.000Z'),
    onboardingCredentialDigest: 'onboarding',
    onboardingExpiresAt: new Date('2026-08-29T00:15:00.000Z'),
  };
}

function validUser(overrides: Record<string, unknown> = {}) {
  return {
    emailVerifiedAt: new Date('2026-08-28T00:00:00.000Z'),
    password: { passwordHash: 'stored-hash' },
    passwordAuthenticationState: null,
    journeys: [{ currentStep: 'COMPLETE', completedAt: new Date() }],
    memberships: [{ tenantId: 'tenant-1' }],
    sessionFamilies: [],
    ...overrides,
  };
}
