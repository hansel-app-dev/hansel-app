import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccountRegistration } from './create-account.js';
import { createPrismaPendingAccountStore } from './prisma-account-store.js';

const prisma = new PrismaClient({
  datasourceUrl:
    process.env.DATABASE_URL ??
    'postgresql://hansel:hansel@localhost:5433/hansel?schema=public',
});

beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: 'owner@example.com' } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: 'owner@example.com' } });
  await prisma.$disconnect();
});

describe('Prisma pending account store [REQ-006, REQ-012, REQ-024, REQ-049, REQ-050]', () => {
  it('atomically stores protected account, consent, challenge, and journey data', async () => {
    const store = createPrismaPendingAccountStore(prisma);
    const input = {
      email: 'owner@example.com',
      passwordHash: 'argon2id-hash',
      verificationCodeDigest: 'code-digest',
      verificationExpiresAt: new Date('2026-08-27T00:15:00.000Z'),
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
      consentedAt: new Date('2026-08-27T00:00:00.000Z'),
    };

    await expect(store(input)).resolves.toEqual({ shouldSend: true });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: input.email },
      include: {
        password: true,
        consents: true,
        challenges: true,
        journeys: true,
      },
    });
    expect(user.password?.passwordHash).toBe('argon2id-hash');
    expect(user.consents).toEqual([
      expect.objectContaining({
        termsVersion: '2026-08-27',
        privacyVersion: '2026-08-27',
        onboardingPath: 'new-organization',
        country: 'unknown',
      }),
    ]);
    expect(user.challenges).toEqual([
      expect.objectContaining({
        codeDigest: 'code-digest',
        expiresAt: input.verificationExpiresAt,
        failedAttempts: 0,
      }),
    ]);
    expect(user.journeys).toEqual([
      expect.objectContaining({
        entryPath: 'NEW_ORGANIZATION',
        currentStep: 'VERIFY_EMAIL',
      }),
    ]);
  });

  it('does not overwrite an existing account', async () => {
    const store = createPrismaPendingAccountStore(prisma);
    const input = {
      email: 'owner@example.com',
      passwordHash: 'original-hash',
      verificationCodeDigest: 'original-digest',
      verificationExpiresAt: new Date('2026-08-27T00:15:00.000Z'),
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
      consentedAt: new Date('2026-08-27T00:00:00.000Z'),
    };
    await store(input);

    await expect(
      store({ ...input, passwordHash: 'replacement-hash' }),
    ).resolves.toEqual({ shouldSend: false });
    await expect(
      prisma.passwordCredential.findUniqueOrThrow({
        where: {
          userId: (
            await prisma.user.findUniqueOrThrow({
              where: { email: input.email },
            })
          ).id,
        },
      }),
    ).resolves.toEqual(
      expect.objectContaining({ passwordHash: 'original-hash' }),
    );
  });

  it('issues a fresh challenge without overwriting a verified plan-selection journey [REQ-088]', async () => {
    const store = createPrismaPendingAccountStore(prisma);
    const initial = {
      email: 'owner@example.com',
      passwordHash: 'original-hash',
      verificationCodeDigest: 'original-digest',
      verificationExpiresAt: new Date('2026-08-27T00:15:00.000Z'),
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
      consentedAt: new Date('2026-08-27T00:00:00.000Z'),
    };
    await store(initial);
    const user = await prisma.user.update({
      where: { email: initial.email },
      data: {
        emailVerifiedAt: new Date('2026-08-27T00:05:00.000Z'),
        journeys: {
          updateMany: {
            where: { currentStep: 'VERIFY_EMAIL' },
            data: { currentStep: 'PLAN_SELECTION' },
          },
        },
      },
    });

    const sendVerificationCode = vi.fn();
    const register = createAccountRegistration({
      hashPassword: vi.fn().mockResolvedValue('replacement-hash'),
      createVerificationCode: () => '654321',
      digestVerificationCode: () => 'recovery-digest',
      storePendingAccount: store,
      sendVerificationCode,
      now: () => new Date('2026-08-27T02:00:00.000Z'),
    });
    await expect(
      register({
        email: initial.email,
        password: 'Replacement password!7',
        acceptsTerms: true,
        termsVersion: initial.termsVersion,
        privacyVersion: initial.privacyVersion,
      }),
    ).resolves.toEqual({ nextStep: 'verify-email' });
    expect(sendVerificationCode).toHaveBeenCalledWith(initial.email, '654321');

    await expect(
      prisma.passwordCredential.findUniqueOrThrow({
        where: { userId: user.id },
      }),
    ).resolves.toEqual(
      expect.objectContaining({ passwordHash: 'original-hash' }),
    );
    await expect(
      prisma.verificationChallenge.findMany({
        where: { userId: user.id },
        orderBy: { sentAt: 'asc' },
      }),
    ).resolves.toEqual([
      expect.objectContaining({ codeDigest: 'original-digest' }),
      expect.objectContaining({ codeDigest: 'recovery-digest' }),
    ]);
    await expect(
      prisma.consentRecord.count({ where: { userId: user.id } }),
    ).resolves.toBe(1);

    await expect(
      prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { journeys: true },
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        emailVerifiedAt: new Date('2026-08-27T00:05:00.000Z'),
        journeys: [expect.objectContaining({ currentStep: 'PLAN_SELECTION' })],
      }),
    );
  });

  it.each([
    new Error('database unavailable'),
    new Prisma.PrismaClientKnownRequestError('foreign key failure', {
      code: 'P2003',
      clientVersion: 'test',
    }),
  ])('propagates non-duplicate database failures', async (databaseError) => {
    const failingPrisma = {
      $transaction: () => Promise.reject(databaseError),
    } as unknown as PrismaClient;
    const store = createPrismaPendingAccountStore(failingPrisma);

    await expect(
      store({
        email: 'owner@example.com',
        passwordHash: 'argon2id-hash',
        verificationCodeDigest: 'code-digest',
        verificationExpiresAt: new Date('2026-08-27T00:15:00.000Z'),
        termsVersion: '2026-08-27',
        privacyVersion: '2026-08-27',
        consentedAt: new Date('2026-08-27T00:00:00.000Z'),
      }),
    ).rejects.toBe(databaseError);
  });
});
