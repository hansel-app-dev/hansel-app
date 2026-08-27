import { describe, expect, it, vi } from 'vitest';
import { createPrismaPersonalProfileStore } from './prisma-personal-profile-store.js';

const now = new Date('2026-08-27T02:00:00Z');
const profile = {
  firstName: 'Nabin',
  lastName: 'Singh',
  jobTitle: 'manager' as const,
  department: 'marketing_communications' as const,
};
const rotation = {
  nextCredentialDigest: 'next-digest',
  nextCredentialExpiresAt: new Date('2026-08-27T02:15:00Z'),
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
    personalProfile: { upsert: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(
      async (callback: (value: typeof transaction) => Promise<unknown>) =>
        await callback(transaction),
    ),
  };
  return {
    save: createPrismaPersonalProfileStore(prisma as never),
    transaction,
  };
}

describe('Prisma personal-profile store [REQ-086]', () => {
  it.each([
    ['unknown credential', null],
    [
      'expired credential',
      { userId: 'user', expiresAt: new Date('2026-08-27T02:00:00Z') },
    ],
  ])('rejects %s', async (_name, continuation) => {
    const { save } = harness(continuation);
    await expect(
      save({ credentialDigest: 'digest', now, profile, ...rotation }),
    ).resolves.toBe(false);
  });

  it('rejects a concurrent or wrong-step transition without saving', async () => {
    const { save, transaction } = harness(
      { userId: 'user', expiresAt: new Date('2026-08-27T02:15:00Z') },
      0,
    );
    await expect(
      save({ credentialDigest: 'digest', now, profile, ...rotation }),
    ).resolves.toBe(false);
    expect(transaction.personalProfile.upsert).not.toHaveBeenCalled();
  });

  it('advances once and upserts the verified user profile', async () => {
    const { save, transaction } = harness({
      userId: 'user',
      expiresAt: new Date('2026-08-27T02:15:00Z'),
    });
    await expect(
      save({ credentialDigest: 'digest', now, profile, ...rotation }),
    ).resolves.toBe(true);
    expect(transaction.personalProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'user' },
      create: {
        userId: 'user',
        ...profile,
        jobTitleOther: null,
        departmentOther: null,
      },
      update: {
        ...profile,
        jobTitleOther: null,
        departmentOther: null,
      },
    });
    expect(transaction.onboardingContinuation.update).toHaveBeenCalledWith({
      where: { userId: 'user' },
      data: {
        credentialDigest: 'next-digest',
        expiresAt: new Date('2026-08-27T02:15:00Z'),
      },
    });
  });

  it('does not mask unexpected persistence failures [REQ-017, REQ-086]', async () => {
    const failure = new Error('database unavailable');
    const save = createPrismaPersonalProfileStore({
      $transaction: vi.fn().mockRejectedValue(failure),
    } as never);
    await expect(
      save({ credentialDigest: 'digest', now, profile, ...rotation }),
    ).rejects.toBe(failure);
  });
});
