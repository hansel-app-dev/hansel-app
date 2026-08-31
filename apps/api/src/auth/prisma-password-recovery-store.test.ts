import { describe, expect, it, vi } from 'vitest';
import { createPrismaPasswordRecoveryStore } from './prisma-password-recovery-store.js';

const now = new Date('2026-08-31T12:00:00.000Z');

function harness() {
  const transaction = {
    passwordRecoveryInitiation: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([{ id: 'expired-id' }]),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'user-id',
        email: 'owner@example.com',
        emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
        password: { userId: 'user-id' },
        personalProfile: { firstName: 'Ava' },
        challenges: [],
      }),
    },
    verificationChallenge: {
      updateMany: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'challenge-id' }),
    },
  };
  const prisma = {
    $transaction: vi.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  return {
    store: createPrismaPasswordRecoveryStore(prisma as never),
    transaction,
    prisma,
  };
}

describe('Prisma password recovery store [password-recovery REQ-005..REQ-011]', () => {
  it('counts the normalized identifier and replaces an eligible challenge', async () => {
    const h = harness();
    await expect(
      h.store.requestChallenge({
        email: 'owner@example.com',
        identifierDigest: 'identifier-digest',
        codeDigest: 'code-digest',
        expiresAt: new Date('2026-08-31T12:15:00.000Z'),
        now,
      }),
    ).resolves.toEqual({
      challengeId: 'challenge-id',
      recipient: 'owner@example.com',
      firstName: 'Ava',
    });
    expect(h.transaction.passwordRecoveryInitiation.count).toHaveBeenCalledWith(
      {
        where: {
          identifierDigest: 'identifier-digest',
          requestedAt: { gt: new Date('2026-08-31T11:00:00.000Z') },
        },
      },
    );
    expect(
      h.transaction.passwordRecoveryInitiation.create,
    ).toHaveBeenCalledWith({
      data: {
        identifierDigest: 'identifier-digest',
        requestedAt: now,
        expiresAt: new Date('2026-09-30T12:00:00.000Z'),
      },
    });
    expect(
      h.transaction.passwordRecoveryInitiation.deleteMany,
    ).toHaveBeenCalledWith({
      where: { id: { in: ['expired-id'] } },
    });
    expect(h.transaction.verificationChallenge.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-id',
        purpose: 'PASSWORD_RECOVERY',
        codeDigest: 'code-digest',
        expiresAt: new Date('2026-08-31T12:15:00.000Z'),
        sentAt: now,
      },
      select: { id: true },
    });
  });

  it('suppresses rate-limited, unknown, ineligible, and cooldown requests', async () => {
    const input = {
      email: 'owner@example.com',
      identifierDigest: 'identifier-digest',
      codeDigest: 'code-digest',
      expiresAt: new Date('2026-08-31T12:15:00.000Z'),
      now,
    };
    const rateLimited = harness();
    rateLimited.transaction.passwordRecoveryInitiation.count.mockResolvedValue(
      3,
    );
    await expect(rateLimited.store.requestChallenge(input)).resolves.toBe(
      false,
    );
    expect(
      rateLimited.transaction.passwordRecoveryInitiation.create,
    ).not.toHaveBeenCalled();

    for (const user of [
      null,
      {
        id: 'user-id',
        email: input.email,
        emailVerifiedAt: null,
        password: { userId: 'user-id' },
        personalProfile: null,
        challenges: [],
      },
      {
        id: 'user-id',
        email: input.email,
        emailVerifiedAt: now,
        password: null,
        personalProfile: null,
        challenges: [],
      },
      {
        id: 'user-id',
        email: input.email,
        emailVerifiedAt: now,
        password: { userId: 'user-id' },
        personalProfile: null,
        challenges: [{ sentAt: new Date(now.getTime() - 30_000) }],
      },
    ]) {
      const h = harness();
      h.transaction.user.findUnique.mockResolvedValue(user);
      await expect(h.store.requestChallenge(input)).resolves.toBe(false);
    }
  });

  it('returns a nullable name and retries only serialization conflicts', async () => {
    const h = harness();
    h.transaction.user.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'owner@example.com',
      emailVerifiedAt: now,
      password: { userId: 'user-id' },
      personalProfile: null,
      challenges: [{ sentAt: new Date(now.getTime() - 60_000) }],
    });
    h.prisma.$transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(
        async (callback: (tx: typeof h.transaction) => Promise<unknown>) =>
          callback(h.transaction),
      );
    await expect(
      h.store.requestChallenge({
        email: 'owner@example.com',
        identifierDigest: 'digest',
        codeDigest: 'code',
        expiresAt: new Date(now.getTime() + 1),
        now,
      }),
    ).resolves.toEqual(expect.objectContaining({ firstName: null }));

    const fatal = harness();
    fatal.prisma.$transaction.mockRejectedValue(new Error('database'));
    await expect(
      fatal.store.requestChallenge({
        email: 'owner@example.com',
        identifierDigest: 'digest',
        codeDigest: 'code',
        expiresAt: now,
        now,
      }),
    ).rejects.toThrow('database');

    const exhausted = harness();
    exhausted.prisma.$transaction.mockRejectedValue({ code: 'P2034' });
    await expect(
      exhausted.store.requestChallenge({
        email: 'owner@example.com',
        identifierDigest: 'digest',
        codeDigest: 'code',
        expiresAt: now,
        now,
      }),
    ).rejects.toEqual({ code: 'P2034' });
    expect(exhausted.prisma.$transaction).toHaveBeenCalledTimes(10);
  });

  it('atomically replaces the password and removes prior recovery access', async () => {
    const transaction = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-id',
          emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
          password: { userId: 'user-id' },
          challenges: [
            {
              id: 'challenge-id',
              codeDigest: 'code-digest',
              expiresAt: new Date('2026-08-31T12:15:00.000Z'),
              failedAttempts: 0,
              consumedAt: null,
            },
          ],
        }),
      },
      verificationChallenge: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      passwordCredential: { update: vi.fn() },
      passwordAuthenticationState: { upsert: vi.fn() },
      applicationSessionFamily: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      onboardingContinuation: { deleteMany: vi.fn() },
      passwordRecoveryNotificationIntent: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(
        async (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const recordEvent = vi.fn();
    const store = createPrismaPasswordRecoveryStore(
      prisma as never,
      recordEvent,
    );

    await expect(
      store.resetPassword({
        email: 'owner@example.com',
        codeDigest: 'code-digest',
        passwordHash: 'new-password-hash',
        pepperVersion: 1,
        now,
      }),
    ).resolves.toBe(true);
    expect(transaction.passwordCredential.update).toHaveBeenCalledWith({
      where: { userId: 'user-id' },
      data: { passwordHash: 'new-password-hash', pepperVersion: 1 },
    });
    expect(
      transaction.applicationSessionFamily.updateMany,
    ).toHaveBeenCalledWith({
      where: { userId: 'user-id', revokedAt: null },
      data: { revokedAt: now, revocationReason: 'password_recovery' },
    });
    expect(
      transaction.passwordRecoveryNotificationIntent.create,
    ).toHaveBeenCalledWith({
      data: {
        userId: 'user-id',
        resetChallengeId: 'challenge-id',
        nextAttemptAt: now,
      },
    });
    expect(recordEvent).toHaveBeenCalledWith(
      'password_recovery_sessions_revoked',
      { count: 2 },
    );
    expect(recordEvent).toHaveBeenCalledWith(
      'password_reset_notification_created',
      { count: 1 },
    );
    await expect(
      createPrismaPasswordRecoveryStore(prisma as never).resetPassword({
        email: 'owner@example.com',
        codeDigest: 'code-digest',
        passwordHash: 'new-password-hash',
        pepperVersion: 1,
        now,
      }),
    ).resolves.toBe(true);
  });

  it('rejects ineligible, invalid, expired, exhausted, consumed, and raced resets', async () => {
    const baseChallenge = {
      id: 'challenge-id',
      codeDigest: 'code-digest',
      expiresAt: new Date(now.getTime() + 60_000),
      failedAttempts: 0,
      consumedAt: null,
    };
    const input = {
      email: 'owner@example.com',
      codeDigest: 'code-digest',
      passwordHash: 'hash',
      pepperVersion: 1,
      now,
    };
    for (const user of [
      null,
      {
        id: 'user',
        emailVerifiedAt: null,
        password: { userId: 'user' },
        challenges: [baseChallenge],
      },
      {
        id: 'user',
        emailVerifiedAt: now,
        password: null,
        challenges: [baseChallenge],
      },
      {
        id: 'user',
        emailVerifiedAt: now,
        password: { userId: 'user' },
        challenges: [],
      },
      {
        id: 'user',
        emailVerifiedAt: now,
        password: { userId: 'user' },
        challenges: [{ ...baseChallenge, consumedAt: now }],
      },
      {
        id: 'user',
        emailVerifiedAt: now,
        password: { userId: 'user' },
        challenges: [{ ...baseChallenge, expiresAt: now }],
      },
      {
        id: 'user',
        emailVerifiedAt: now,
        password: { userId: 'user' },
        challenges: [{ ...baseChallenge, failedAttempts: 5 }],
      },
    ]) {
      const h = harness();
      h.transaction.user.findUnique.mockResolvedValue(user);
      await expect(h.store.resetPassword(input)).resolves.toBe(false);
    }

    const wrong = harness();
    wrong.transaction.user.findUnique.mockResolvedValue({
      id: 'user',
      emailVerifiedAt: now,
      password: { userId: 'user' },
      challenges: [baseChallenge],
    });
    await expect(
      wrong.store.resetPassword({ ...input, codeDigest: 'different-length' }),
    ).resolves.toBe(false);
    expect(
      wrong.transaction.verificationChallenge.updateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ data: { failedAttempts: { increment: 1 } } }),
    );

    const equalLengthWrong = harness();
    equalLengthWrong.transaction.user.findUnique.mockResolvedValue({
      id: 'user',
      emailVerifiedAt: now,
      password: { userId: 'user' },
      challenges: [baseChallenge],
    });
    await expect(
      equalLengthWrong.store.resetPassword({
        ...input,
        codeDigest: 'code-digesx',
      }),
    ).resolves.toBe(false);

    const raced = harness();
    raced.transaction.user.findUnique.mockResolvedValue({
      id: 'user',
      emailVerifiedAt: now,
      password: { userId: 'user' },
      challenges: [baseChallenge],
    });
    raced.transaction.verificationChallenge.updateMany.mockResolvedValue({
      count: 0,
    });
    await expect(raced.store.resetPassword(input)).resolves.toBe(false);
  });
});
