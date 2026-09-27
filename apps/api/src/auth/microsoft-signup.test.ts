import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { expect, it, vi } from 'vitest';
import { createMicrosoftSignup } from './microsoft-signup.js';
import { externalPolicyVersion } from './external-login.js';
const now = new Date('2026-09-01T00:00:00Z');
function setup(withEvents = true) {
  const row = {
    email: null as string | null,
    sentAt: null as Date | null,
    delivered: false,
    codeDigest: '',
    subject: 'subject',
    termsVersion: externalPolicyVersion,
    privacyVersion: externalPolicyVersion,
    consentedAt: now,
  };
  const pending = {
    create: vi.fn(),
    findFirst: vi.fn().mockResolvedValue(row),
    update: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };
  const send = vi.fn().mockResolvedValue(undefined),
    events = vi.fn();
  const db = {
    microsoftPendingSignup: pending,
    microsoftVerificationSend: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: { create: vi.fn() },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi
      .fn()
      .mockImplementation((work: (tx: unknown) => Promise<unknown>) =>
        Promise.resolve(work(db)),
      ),
  };
  return {
    row,
    pending,
    db,
    send,
    events,
    api: createMicrosoftSignup({
      prisma: db as never,
      digestKey: 'test-key',
      sendVerificationCode: send,
      now: () => now,
      ...(withEvents ? { recordEvent: events } : {}),
    }),
  };
}
it('microsoft-local-auth REQ-004..008: starts current-consent pending journeys, reads cooldown and reclaims expired challenges', async () => {
  const s = setup();
  const input = {
    subject: 'subject',
    termsVersion: externalPolicyVersion,
    privacyVersion: externalPolicyVersion,
  };
  await expect(s.api.start({ ...input, termsVersion: 'old' })).rejects.toThrow(
    'Current consent required',
  );
  await expect(
    s.api.start({ ...input, privacyVersion: 'old' }),
  ).rejects.toThrow();
  expect(await s.api.start(input)).toHaveLength(43);
  await s.api.start({ ...input, emailHint: 'owner@example.com' });
  expect(s.pending.create).toHaveBeenLastCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ email: 'owner@example.com' }),
    }),
  );
  expect(await s.api.read('credential')).toEqual({
    email: '',
    sent: false,
    resendAfter: 0,
  });
  s.row.email = 'owner@example.com';
  s.row.sentAt = now;
  expect(await s.api.read('credential')).toMatchObject({
    email: s.row.email,
    resendAfter: 60,
  });
  s.row.sentAt = new Date(0);
  expect(await s.api.read('credential')).toHaveProperty('resendAfter', 0);
  s.pending.findFirst.mockResolvedValueOnce(null);
  expect(await s.api.read('credential')).toBeNull();
  await s.api.cleanup();
  expect(s.pending.deleteMany).toHaveBeenCalledOnce();
  await setup(false).api.start(input);
});
it('microsoft-local-auth REQ-006: reserves bounded sends and records only delivery-confirmed challenges', async () => {
  const s = setup();
  for (const email of ['invalid', 'x'.repeat(255) + '@example.com'])
    expect(await s.api.send('credential', email)).toBe('invalid');
  s.pending.findFirst.mockResolvedValueOnce(null);
  expect(await s.api.send('credential', 'owner@example.com')).toBe('expired');
  s.row.sentAt = now;
  expect(await s.api.send('credential', 'owner@example.com')).toBe('limited');
  s.row.sentAt = new Date(0);
  s.db.microsoftVerificationSend.count.mockResolvedValueOnce(5);
  expect(await s.api.send('credential', 'owner@example.com')).toBe('limited');
  s.send.mockRejectedValueOnce(new Error('offline'));
  expect(await s.api.send('credential', 'owner@example.com')).toBe(
    'unavailable',
  );
  expect(await s.api.send('credential', ' OWNER@EXAMPLE.COM ')).toBe('sent');
  expect(s.send).toHaveBeenLastCalledWith(
    'owner@example.com',
    expect.stringMatching(/^\d{6}$/),
  );
  s.pending.updateMany.mockResolvedValueOnce({ count: 0 });
  expect(await s.api.send('credential', 'owner@example.com')).toBe('expired');
});
it('microsoft-local-auth REQ-007,008: verifies once and handles incorrect codes, duplicate identities and dependency failures', async () => {
  const s = setup();
  s.row.email = 'owner@example.com';
  s.pending.findFirst.mockResolvedValueOnce(null);
  expect(await s.api.verify('credential', '123456')).toBeNull();
  for (const code of ['bad', '123456'])
    expect(await s.api.verify('credential', code)).toBeNull();
  s.row.codeDigest = createHmac('sha256', 'test-key')
    .update(
      'microsoft-code:' + JSON.stringify(['credential', s.row.email, '123456']),
    )
    .digest('hex');
  expect(await s.api.verify('credential', '123456')).toMatchObject({
    destination: '/onboarding/about-you',
    onboardingCredential: expect.any(String),
  });
  expect(s.db.user.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        email: s.row.email,
        externalIdentities: {
          create: { provider: 'MICROSOFT', subject: 'subject' },
        },
      }),
    }),
  );
  expect(s.pending.delete).toHaveBeenCalledOnce();
  s.db.$transaction.mockRejectedValueOnce(
    new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    }),
  );
  expect(await s.api.verify('credential', '123456')).toBeNull();
  for (const error of [
    new Error('offline'),
    new Prisma.PrismaClientKnownRequestError('other', {
      code: 'P2000',
      clientVersion: 'test',
    }),
  ]) {
    s.db.$transaction.mockRejectedValueOnce(error);
    await expect(s.api.verify('credential', '123456')).rejects.toBe(error);
  }
});
