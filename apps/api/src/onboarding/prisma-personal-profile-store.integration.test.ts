import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createPrismaPersonalProfileStore } from './prisma-personal-profile-store.js';
import { createPrismaVerificationStore } from './prisma-verification-store.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);
const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        databaseUrl ??
        'postgresql://unused:unused@127.0.0.1:1/skipped?schema=public',
    },
  },
});
const profile = {
  firstName: 'Nabin',
  lastName: 'Singh',
  jobTitle: 'manager' as const,
  department: 'marketing_communications' as const,
};
const rotation = () => ({
  nextCredentialDigest: `next-${randomUUID()}`,
  nextCredentialExpiresAt: new Date(Date.now() + 60_000),
});

integration('PostgreSQL personal-profile transition [REQ-018, REQ-086]', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('has a single winner under concurrent retries [REQ-018]', async () => {
    const testId = randomUUID();
    const credentialDigest = `concurrent-${testId}`;
    const user = await prisma.user.create({
      data: {
        email: `profile-integration-concurrency-${testId}@example.com`,
        emailVerifiedAt: new Date(),
        journeys: {
          create: {
            entryPath: 'NEW_ORGANIZATION',
            currentStep: 'PERSONAL_PROFILE',
          },
        },
        continuation: {
          create: {
            credentialDigest,
            expiresAt: new Date(Date.now() + 60_000),
          },
        },
      },
    });
    const save = createPrismaPersonalProfileStore(prisma);
    const results = await Promise.all([
      save({ credentialDigest, now: new Date(), profile, ...rotation() }),
      save({ credentialDigest, now: new Date(), profile, ...rotation() }),
    ]);
    expect(results.sort()).toEqual([false, true]);
    await expect(
      prisma.personalProfile.count({ where: { userId: user.id } }),
    ).resolves.toBe(1);
    await expect(
      prisma.onboardingJourney.count({
        where: { userId: user.id, currentStep: 'PLAN_SELECTION' },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.onboardingContinuation.count({ where: { userId: user.id } }),
    ).resolves.toBe(1);
  });

  it('rolls back every journey update when the invariant is violated [REQ-018]', async () => {
    const testId = randomUUID();
    const credentialDigest = `rollback-${testId}`;
    const user = await prisma.user.create({
      data: {
        email: `profile-integration-rollback-${testId}@example.com`,
        emailVerifiedAt: new Date(),
        journeys: {
          create: [
            { entryPath: 'NEW_ORGANIZATION', currentStep: 'PERSONAL_PROFILE' },
            { entryPath: 'NEW_ORGANIZATION', currentStep: 'PERSONAL_PROFILE' },
          ],
        },
        continuation: {
          create: {
            credentialDigest,
            expiresAt: new Date(Date.now() + 60_000),
          },
        },
      },
    });
    const save = createPrismaPersonalProfileStore(prisma);
    await expect(
      save({ credentialDigest, now: new Date(), profile, ...rotation() }),
    ).resolves.toBe(false);
    await expect(
      prisma.onboardingJourney.count({
        where: { userId: user.id, currentStep: 'PERSONAL_PROFILE' },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.personalProfile.count({ where: { userId: user.id } }),
    ).resolves.toBe(0);
  });

  it('rolls back verification when its journey transition is invalid [REQ-012, REQ-018]', async () => {
    const testId = randomUUID();
    const codeDigest = `code-${testId}`;
    const user = await prisma.user.create({
      data: {
        email: `profile-integration-verification-${testId}@example.com`,
        journeys: {
          create: [
            { entryPath: 'NEW_ORGANIZATION', currentStep: 'VERIFY_EMAIL' },
            { entryPath: 'NEW_ORGANIZATION', currentStep: 'VERIFY_EMAIL' },
          ],
        },
        challenges: {
          create: {
            purpose: 'ONBOARDING_EMAIL',
            codeDigest,
            sentAt: new Date(),
            expiresAt: new Date(Date.now() + 60_000),
          },
        },
      },
    });
    const store = createPrismaVerificationStore(prisma);
    await expect(
      store.verify({
        email: user.email,
        codeDigest,
        onboardingCredentialDigest: `verification-${testId}`,
        onboardingCredentialExpiresAt: new Date(Date.now() + 60_000),
        now: new Date(),
      }),
    ).resolves.toBe(false);
    await expect(
      prisma.user.findUnique({
        where: { id: user.id },
        select: { emailVerifiedAt: true },
      }),
    ).resolves.toEqual({ emailVerifiedAt: null });
    await expect(
      prisma.verificationChallenge.count({
        where: { userId: user.id, consumedAt: null },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.onboardingJourney.count({
        where: { userId: user.id, currentStep: 'VERIFY_EMAIL' },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.onboardingContinuation.count({ where: { userId: user.id } }),
    ).resolves.toBe(0);
  });
});
