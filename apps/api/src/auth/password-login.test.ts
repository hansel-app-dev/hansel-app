import { describe, expect, it, vi } from 'vitest';
import { createPasswordLogin } from './password-login.js';

type LoginDependencies = Parameters<typeof createPasswordLogin>[0];

function dependencies(
  overrides: Partial<LoginDependencies> = {},
): LoginDependencies {
  return {
    loadAccount: vi.fn().mockResolvedValue({
      userId: 'user-1',
      passwordHash: 'stored-hash',
      lockedUntil: null,
    }),
    verifyPassword: vi.fn().mockResolvedValue(true),
    dummyPasswordHash: 'dummy-hash',
    recordFailure: vi.fn(),
    completeSuccess: vi.fn().mockResolvedValue({
      destination: '/dashboard',
      sessionKind: 'application',
    }),
    requestVerification: vi.fn(),
    createApplicationCredential: vi
      .fn()
      .mockReturnValueOnce('access-credential')
      .mockReturnValueOnce('refresh-credential'),
    digestApplicationCredential: (value) => `digest:${value}`,
    createOnboardingCredential: () => 'onboarding-credential',
    digestOnboardingCredential: (value) => `digest:${value}`,
    createOnboardingCsrfProof: (value) => `csrf:${value}`,
    now: () => new Date('2026-08-29T00:00:00.000Z'),
    recordEvent: vi.fn(),
    ...overrides,
  };
}

describe('password login [user-login REQ-005, REQ-011]', () => {
  it('exchanges a valid completed account password for a new application session', async () => {
    const completeSuccess = vi.fn().mockResolvedValue({
      destination: '/dashboard',
      sessionKind: 'application',
    });
    const login = createPasswordLogin(
      dependencies({
        completeSuccess,
      }),
    );

    await expect(
      login({
        email: 'owner@example.com',
        password: 'Correct horse battery staple!7',
      }),
    ).resolves.toEqual({
      status: 'accepted',
      destination: '/dashboard',
      applicationSession: {
        accessCredential: 'access-credential',
        refreshCredential: 'refresh-credential',
      },
    });
    expect(completeSuccess).toHaveBeenCalledWith({
      userId: 'user-1',
      expectedPasswordHash: 'stored-hash',
      now: new Date('2026-08-29T00:00:00.000Z'),
      accessCredentialDigest: 'digest:access-credential',
      accessExpiresAt: new Date('2026-08-29T00:15:00.000Z'),
      refreshCredentialDigest: 'digest:refresh-credential',
      absoluteExpiresAt: new Date('2026-09-28T00:00:00.000Z'),
      onboardingCredentialDigest: 'digest:onboarding-credential',
      onboardingExpiresAt: new Date('2026-08-29T00:15:00.000Z'),
    });
  });

  it('performs dummy verification and returns the generic result for an unknown account', async () => {
    const verifyPassword = vi.fn().mockResolvedValue(false);
    const recordFailure = vi.fn();
    const login = createPasswordLogin(
      dependencies({
        loadAccount: vi.fn().mockResolvedValue(null),
        verifyPassword,
        recordFailure,
      }),
    );

    await expect(
      login({ email: 'unknown@example.com', password: 'anything' }),
    ).resolves.toEqual({ status: 'rejected' });
    expect(verifyPassword).toHaveBeenCalledWith('dummy-hash', 'anything');
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('records a real-account password failure and returns only the generic result', async () => {
    const recordFailure = vi.fn().mockResolvedValue(undefined);
    const login = createPasswordLogin(
      dependencies({
        verifyPassword: vi.fn().mockResolvedValue(false),
        recordFailure,
      }),
    );

    await expect(
      login({ email: 'owner@example.com', password: 'wrong' }),
    ).resolves.toEqual({ status: 'rejected' });
    expect(recordFailure).toHaveBeenCalledWith({
      userId: 'user-1',
      now: new Date('2026-08-29T00:00:00.000Z'),
    });
  });

  it('does not verify or extend a current lock', async () => {
    const verifyPassword = vi.fn().mockResolvedValue(false);
    const recordFailure = vi.fn();
    const login = createPasswordLogin(
      dependencies({
        loadAccount: vi.fn().mockResolvedValue({
          userId: 'user-1',
          passwordHash: 'stored-hash',
          lockedUntil: new Date('2026-08-29T00:15:00.000Z'),
        }),
        verifyPassword,
        recordFailure,
      }),
    );

    await expect(
      login({ email: 'owner@example.com', password: 'correct-or-not' }),
    ).resolves.toEqual({ status: 'rejected' });
    expect(verifyPassword).toHaveBeenCalledWith('dummy-hash', 'correct-or-not');
    expect(verifyPassword).not.toHaveBeenCalledWith(
      'stored-hash',
      expect.anything(),
    );
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it('resumes a verified incomplete journey with only an onboarding session', async () => {
    const login = createPasswordLogin(
      dependencies({
        completeSuccess: vi.fn().mockResolvedValue({
          destination: '/onboarding/plan-selection',
          sessionKind: 'onboarding',
        }),
      }),
    );

    await expect(
      login({ email: 'owner@example.com', password: 'correct' }),
    ).resolves.toEqual({
      status: 'accepted',
      destination: '/onboarding/plan-selection',
      onboardingSession: {
        onboardingCredential: 'onboarding-credential',
        csrfProof: 'csrf:onboarding-credential',
      },
    });
  });

  it('requests verification after a correct password for an unverified journey', async () => {
    const requestVerification = vi.fn().mockResolvedValue(undefined);
    const login = createPasswordLogin(
      dependencies({
        completeSuccess: vi.fn().mockResolvedValue({
          destination: '/onboarding/verify-email',
          sessionKind: 'verification',
        }),
        requestVerification,
      }),
    );

    await expect(
      login({ email: 'owner@example.com', password: 'correct' }),
    ).resolves.toEqual({
      status: 'accepted',
      destination: '/onboarding/verify-email',
    });
    expect(requestVerification).toHaveBeenCalledWith('owner@example.com');
  });

  it('fails closed when account state changes before session issuance', async () => {
    const login = createPasswordLogin(
      dependencies({
        loadAccount: vi.fn().mockResolvedValue({
          userId: 'user-1',
          passwordHash: 'stored-hash',
          lockedUntil: new Date('2026-08-28T23:59:00.000Z'),
        }),
        completeSuccess: vi.fn().mockResolvedValue(null),
      }),
    );

    await expect(
      login({ email: 'owner@example.com', password: 'correct' }),
    ).resolves.toEqual({ status: 'rejected' });
  });
});
