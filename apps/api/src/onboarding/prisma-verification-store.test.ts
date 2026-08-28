import { describe, expect, it, vi } from 'vitest';
import { createPrismaVerificationStore } from './prisma-verification-store.js';

const now = new Date('2026-08-27T01:00:00Z');
const validVerification = {
  email: 'owner@example.com',
  codeDigest: 'good',
  onboardingCredentialDigest: 'continuation-digest',
  onboardingCredentialExpiresAt: new Date('2026-08-27T01:15:00Z'),
  now,
};
function challenge(overrides: Record<string, unknown> = {}) {
  return {
    id: 'challenge',
    codeDigest: 'good',
    expiresAt: new Date('2026-08-27T01:15:00Z'),
    failedAttempts: 0,
    sentAt: new Date('2026-08-27T00:58:00Z'),
    consumedAt: null,
    ...overrides,
  };
}
function harness(user: unknown, consumedCount = 1, transitionCount = 1) {
  const transaction = {
    user: { findUnique: vi.fn().mockResolvedValue(user), update: vi.fn() },
    verificationChallenge: {
      updateMany: vi.fn().mockResolvedValue({ count: consumedCount }),
      create: vi.fn(),
      count: vi
        .fn()
        .mockResolvedValue(
          Array.isArray((user as { challenges?: unknown[] } | null)?.challenges)
            ? (user as { challenges: unknown[] }).challenges.length
            : 0,
        ),
    },
    onboardingJourney: {
      updateMany: vi.fn().mockResolvedValue({ count: transitionCount }),
    },
    onboardingContinuation: { upsert: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(
      async (callback: (value: typeof transaction) => Promise<unknown>) =>
        await callback(transaction),
    ),
  };
  return { store: createPrismaVerificationStore(prisma as never), transaction };
}

describe('Prisma verification store [REQ-006, REQ-007]', () => {
  it.each([
    ['unknown user', null],
    ['missing challenge', { id: 'user', challenges: [] }],
    [
      'consumed challenge',
      { id: 'user', challenges: [challenge({ consumedAt: now })] },
    ],
    [
      'expired challenge',
      { id: 'user', challenges: [challenge({ expiresAt: now })] },
    ],
    [
      'exhausted challenge',
      { id: 'user', challenges: [challenge({ failedAttempts: 5 })] },
    ],
  ])('rejects %s', async (_name, user) => {
    const { store } = harness(user);
    await expect(store.verify(validVerification)).resolves.toBe(false);
  });

  it('counts a wrong current code', async () => {
    const { store, transaction } = harness({
      id: 'user',
      challenges: [challenge()],
    });
    await expect(
      store.verify({ ...validVerification, codeDigest: 'wrong' }),
    ).resolves.toBe(false);
    expect(transaction.verificationChallenge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { failedAttempts: { increment: 1 } } }),
    );
  });

  it('rejects a code consumed concurrently', async () => {
    const { store } = harness({ id: 'user', challenges: [challenge()] }, 0);
    await expect(store.verify(validVerification)).resolves.toBe(false);
  });

  it('consumes a valid code and advances the journey', async () => {
    const { store, transaction } = harness({
      id: 'user',
      challenges: [challenge()],
    });
    await expect(store.verify(validVerification)).resolves.toBe(true);
    expect(transaction.user.update).toHaveBeenCalled();
    expect(transaction.onboardingJourney.updateMany).toHaveBeenCalled();
    expect(transaction.onboardingContinuation.upsert).toHaveBeenCalledWith({
      where: { userId: 'user' },
      create: {
        userId: 'user',
        credentialDigest: 'continuation-digest',
        expiresAt: new Date('2026-08-27T01:15:00Z'),
      },
      update: {
        credentialDigest: 'continuation-digest',
        expiresAt: new Date('2026-08-27T01:15:00Z'),
      },
    });
  });

  it('re-establishes continuation for a verified personal-profile journey without replaying verification [REQ-088]', async () => {
    const { store, transaction } = harness({
      id: 'user',
      emailVerifiedAt: new Date('2026-08-27T00:30:00Z'),
      journeys: [{ id: 'journey', currentStep: 'PERSONAL_PROFILE' }],
      challenges: [challenge()],
    });

    await expect(store.verify(validVerification)).resolves.toBe(true);
    expect(transaction.user.update).not.toHaveBeenCalled();
    expect(transaction.onboardingJourney.updateMany).not.toHaveBeenCalled();
    expect(transaction.onboardingContinuation.upsert).toHaveBeenCalledOnce();
  });

  it('rejects a missing or duplicate journey transition [REQ-012, REQ-086]', async () => {
    const { store, transaction } = harness(
      { id: 'user', challenges: [challenge()] },
      1,
      0,
    );
    await expect(store.verify(validVerification)).resolves.toBe(false);
    expect(transaction.onboardingContinuation.upsert).not.toHaveBeenCalled();
  });

  it('does not mask unexpected verification persistence failures [REQ-017]', async () => {
    const failure = new Error('database unavailable');
    const store = createPrismaVerificationStore({
      $transaction: vi.fn().mockRejectedValue(failure),
    } as never);
    await expect(store.verify(validVerification)).rejects.toBe(failure);
  });

  it.each([
    ['unknown user', null],
    [
      'verified user',
      { id: 'user', emailVerifiedAt: now, challenges: [challenge()] },
    ],
    [
      'missing challenge',
      { id: 'user', emailVerifiedAt: null, challenges: [] },
    ],
    [
      'hourly limit',
      {
        id: 'user',
        emailVerifiedAt: null,
        challenges: Array.from({ length: 5 }, () => challenge()),
      },
    ],
    [
      'cooldown',
      {
        id: 'user',
        emailVerifiedAt: null,
        challenges: [challenge({ sentAt: new Date('2026-08-27T00:59:30Z') })],
      },
    ],
  ])('does not resend for %s', async (_name, user) => {
    const { store } = harness(user);
    await expect(
      store.resend({
        email: 'owner@example.com',
        codeDigest: 'new',
        expiresAt: new Date('2026-08-27T01:15:00Z'),
        now,
      }),
    ).resolves.toBe(false);
  });

  it('invalidates earlier codes and creates a replacement', async () => {
    const { store, transaction } = harness({
      id: 'user',
      emailVerifiedAt: null,
      challenges: [challenge({ sentAt: new Date('2026-08-27T00:58:00Z') })],
    });
    await expect(
      store.resend({
        email: 'owner@example.com',
        codeDigest: 'new',
        expiresAt: new Date('2026-08-27T01:15:00Z'),
        now,
      }),
    ).resolves.toBe(true);
    expect(transaction.verificationChallenge.updateMany).toHaveBeenCalled();
    expect(transaction.verificationChallenge.create).toHaveBeenCalled();
  });

  it('replaces the recovery code for a verified personal-profile journey [REQ-088]', async () => {
    const { store, transaction } = harness({
      id: 'user',
      emailVerifiedAt: now,
      journeys: [{ id: 'journey', currentStep: 'PERSONAL_PROFILE' }],
      challenges: [challenge({ sentAt: new Date('2026-08-27T00:58:00Z') })],
    });

    await expect(
      store.resend({
        email: 'owner@example.com',
        codeDigest: 'recovery',
        expiresAt: new Date('2026-08-27T01:15:00Z'),
        now,
      }),
    ).resolves.toBe(true);
    expect(transaction.verificationChallenge.updateMany).toHaveBeenCalled();
    expect(transaction.verificationChallenge.create).toHaveBeenCalled();
  });
});
