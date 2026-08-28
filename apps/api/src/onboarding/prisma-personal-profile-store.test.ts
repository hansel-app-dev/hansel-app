import { describe, expect, it, vi } from 'vitest';
import {
  createPrismaPersonalProfileLoader,
  createPrismaPersonalProfileStore,
} from './prisma-personal-profile-store.js';

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

function harness(
  continuation: unknown,
  advanced = 1,
  editable = 1,
  rotated = 1,
) {
  const transaction = {
    onboardingContinuation: {
      findUnique: vi.fn().mockResolvedValue(continuation),
      updateMany: vi.fn().mockResolvedValue({ count: rotated }),
    },
    onboardingJourney: {
      updateMany: vi.fn().mockResolvedValue({ count: advanced }),
      count: vi.fn().mockResolvedValue(editable),
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
  it('loads the saved profile for an eligible continuation [REQ-011, REQ-014]', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      expiresAt: new Date('2026-08-27T02:15:00Z'),
      user: {
        personalProfile: profile,
        journeys: [{ id: 'journey' }],
      },
    });
    const load = createPrismaPersonalProfileLoader({
      onboardingContinuation: { findUnique },
    } as never);

    await expect(load({ credentialDigest: 'digest', now })).resolves.toEqual({
      profile,
    });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { credentialDigest: 'digest' } }),
    );
  });

  it.each([
    ['unknown credential', null],
    [
      'expired credential',
      {
        expiresAt: now,
        user: { personalProfile: profile, journeys: [{ id: 'journey' }] },
      },
    ],
    [
      'wrong step',
      {
        expiresAt: new Date('2026-08-27T02:15:00Z'),
        user: { personalProfile: profile, journeys: [] },
      },
    ],
  ])('does not load a profile for %s', async (_name, continuation) => {
    const load = createPrismaPersonalProfileLoader({
      onboardingContinuation: {
        findUnique: vi.fn().mockResolvedValue(continuation),
      },
    } as never);

    await expect(load({ credentialDigest: 'digest', now })).resolves.toBeNull();
  });

  it('returns an empty profile for the first visit to the step', async () => {
    const load = createPrismaPersonalProfileLoader({
      onboardingContinuation: {
        findUnique: vi.fn().mockResolvedValue({
          expiresAt: new Date('2026-08-27T02:15:00Z'),
          user: { personalProfile: null, journeys: [{ id: 'journey' }] },
        }),
      },
    } as never);

    await expect(load({ credentialDigest: 'digest', now })).resolves.toEqual({
      profile: null,
    });
  });

  it('loads accepted Other details from nullable database columns', async () => {
    const otherProfile = {
      firstName: 'Nabin',
      lastName: 'Singh',
      jobTitle: 'other',
      jobTitleOther: 'Founder',
      department: 'other',
      departmentOther: 'Operations',
    };
    const load = createPrismaPersonalProfileLoader({
      onboardingContinuation: {
        findUnique: vi.fn().mockResolvedValue({
          expiresAt: new Date('2026-08-27T02:15:00Z'),
          user: {
            personalProfile: otherProfile,
            journeys: [{ id: 'journey' }],
          },
        }),
      },
    } as never);

    await expect(load({ credentialDigest: 'digest', now })).resolves.toEqual({
      profile: otherProfile,
    });
  });

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
      0,
    );
    await expect(
      save({ credentialDigest: 'digest', now, profile, ...rotation }),
    ).resolves.toBe(false);
    expect(transaction.personalProfile.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ['ambiguous journey transition', 2, 0, 1],
    ['conflicting eligible journeys', 1, 2, 1],
    ['replayed continuation credential', 1, 1, 0],
  ])('rejects %s', async (_name, advanced, editable, rotated) => {
    const { save } = harness(
      { userId: 'user', expiresAt: new Date('2026-08-27T02:15:00Z') },
      advanced,
      editable,
      rotated,
    );

    await expect(
      save({ credentialDigest: 'digest', now, profile, ...rotation }),
    ).resolves.toBe(false);
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
    expect(transaction.onboardingContinuation.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user', credentialDigest: 'digest' },
      data: {
        credentialDigest: 'next-digest',
        expiresAt: new Date('2026-08-27T02:15:00Z'),
      },
    });
  });

  it('updates an accepted profile after returning from plan selection [REQ-011, REQ-014]', async () => {
    const { save, transaction } = harness(
      { userId: 'user', expiresAt: new Date('2026-08-27T02:15:00Z') },
      0,
      1,
    );

    await expect(
      save({ credentialDigest: 'digest', now, profile, ...rotation }),
    ).resolves.toBe(true);
    expect(transaction.personalProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user' } }),
    );
    expect(transaction.onboardingContinuation.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user', credentialDigest: 'digest' },
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
