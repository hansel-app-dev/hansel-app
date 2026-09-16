/** @spec microsoft-local-auth REQ-004..REQ-008 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createMicrosoftSignup } from './microsoft-signup.js';
const createSignup = (deps: Parameters<typeof createMicrosoftSignup>[0]) =>
  createMicrosoftSignup({ recordEvent: vi.fn(), ...deps });

const databaseUrl = process.env.TEST_DATABASE_URL;
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl ?? 'postgresql://unused:unused@localhost:1/skipped',
    },
  },
});
describe.skipIf(!databaseUrl)('Microsoft mailbox verification', () => {
  afterAll(() => prisma.$disconnect());
  it('reports dependency failure without leaking credentials [microsoft-local-auth REQ-008]', async () => {
    const events = vi.fn();
    const outagePrisma = new PrismaClient();
    const signup = createSignup({
      prisma: outagePrisma,
      digestKey: 'test-only-key',
      now: () => new Date(),
      recordEvent: events,
      sendVerificationCode: () => Promise.resolve(),
    });
    const failure = vi
      .spyOn(outagePrisma, '$transaction')
      .mockRejectedValueOnce(new Error('Database offline'));
    try {
      await expect(
        signup.verify('private-credential', '123456'),
      ).rejects.toThrow('Database offline');
      expect(events).toHaveBeenCalledWith('microsoft_signup_dependency_failed');
      expect(JSON.stringify(events.mock.calls)).not.toContain(
        'private-credential',
      );
    } finally {
      failure.mockRestore();
      await outagePrisma.$disconnect();
    }
  });
  it('rejects stale consent, invalid emails and delivery past absolute expiry with safe events [microsoft-local-auth REQ-004, REQ-006, REQ-008]', async () => {
    let now = new Date();
    const events: string[] = [];
    const signup = createSignup({
      prisma,
      digestKey: 'test-only-key',
      now: () => now,
      recordEvent: (category) => {
        events.push(category);
      },
      sendVerificationCode: () => {
        now = new Date(now.getTime() + 31 * 60_000);
        return Promise.resolve();
      },
    });
    const input = {
      subject: randomUUID(),
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
    };
    await expect(
      signup.start({ ...input, termsVersion: 'old' }),
    ).rejects.toThrow('Current consent');
    await expect(
      signup.start({ ...input, privacyVersion: 'old' }),
    ).rejects.toThrow('Current consent');
    const pending = await signup.start(input);
    expect(await signup.read(pending)).toMatchObject({
      email: '',
      sent: false,
    });
    expect(await signup.send(pending, 'invalid')).toBe('invalid');
    expect(await signup.send(pending, 'a'.repeat(255))).toBe('invalid');
    expect(
      await signup.send(pending, `microsoft-test-${randomUUID()}@example.com`),
    ).toBe('expired');
    expect(events).toEqual([
      'microsoft_signup_started',
      'microsoft_verification_send_rejected',
    ]);
  });
  it('limits attempts and mailbox sends and never extends pending expiry [microsoft-local-auth REQ-006, REQ-007, REQ-008]', async () => {
    const email = `microsoft-test-${randomUUID()}@example.com`;
    let now = new Date();
    const sent: string[] = [];
    const signup = createSignup({
      prisma,
      digestKey: 'test-only-key',
      now: () => now,
      sendVerificationCode: (_email, value) => {
        sent.push(value);
        return Promise.resolve();
      },
    });
    const pending = await signup.start({
      subject: randomUUID(),
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
    });
    await signup.send(pending, email);
    expect(await signup.read(pending)).toMatchObject({
      sent: true,
      resendAfter: 60,
    });
    for (let attempt = 0; attempt < 5; attempt++)
      expect(await signup.verify(pending, 'invalid')).toBeNull();
    expect(await signup.verify(pending, sent[0] ?? 'missing')).toBeNull();
    for (let send = 1; send < 5; send++) {
      now = new Date(now.getTime() + 61_000);
      expect(await signup.send(pending, email)).toBe('sent');
    }
    now = new Date(now.getTime() + 61_000);
    expect(await signup.send(pending, email)).toBe('limited');
    now = new Date(now.getTime() + 15 * 60_000);
    expect(await signup.verify(pending, sent.at(-1) ?? 'missing')).toBeNull();
    now = new Date(now.getTime() + 10 * 60_000);
    expect(await signup.read(pending)).toBeNull();
    await signup.cleanup();
  });
  it('enforces expiry, browser binding, single use, resend, and concurrent completion [microsoft-local-auth REQ-006, REQ-007, REQ-008]', async () => {
    const suffix = randomUUID();
    const email = `microsoft-test-${suffix}@example.com`;
    let now = new Date();
    const sent: string[] = [];
    const signup = createSignup({
      prisma,
      digestKey: 'test-only-key',
      sendVerificationCode: (_email, code) => {
        sent.push(code);
        return Promise.resolve();
      },
      now: () => now,
    });
    const pending = await signup.start({
      subject: suffix,
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
    });
    try {
      expect(await signup.read('wrong-browser')).toBeNull();
      expect(await signup.send(pending, email)).toBe('sent');
      expect(await signup.send(pending, email)).toBe('limited');
      now = new Date(now.getTime() + 61_000);
      expect(await signup.send(pending, email)).toBe('sent');
      expect(await signup.verify(pending, sent[0] ?? 'missing')).toBeNull();
      expect(
        await signup.verify('wrong-browser', sent[1] ?? 'missing'),
      ).toBeNull();
      const results = await Promise.all([
        signup.verify(pending, sent[1] ?? 'missing'),
        signup.verify(pending, sent[1] ?? 'missing'),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
      const expired = await signup.start({
        subject: suffix,
        termsVersion: '2026-08-27',
        privacyVersion: '2026-08-27',
      });
      now = new Date(now.getTime() + 30 * 60_000);
      expect(await signup.read(expired)).toBeNull();
      expect(await signup.send(expired, email)).toBe('expired');
      await signup.cleanup();
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });
  it('does not link an existing email or accept an undelivered code [microsoft-local-auth REQ-006, REQ-007, REQ-008]', async () => {
    const email = `microsoft-test-${randomUUID()}@example.com`;
    let code = '';
    const signup = createSignup({
      prisma,
      digestKey: 'test-only-key',
      now: () => new Date(),
      sendVerificationCode: (_email, value) => {
        code = value;
        return Promise.resolve();
      },
    });
    await prisma.user.create({ data: { email } });
    const pending = await signup.start({
      subject: randomUUID(),
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
    });
    try {
      await signup.send(pending, email);
      expect(await signup.verify(pending, code)).toBeNull();
      expect(
        await prisma.externalIdentity.count({ where: { user: { email } } }),
      ).toBe(0);
      const unavailable = createSignup({
        prisma,
        digestKey: 'test-only-key',
        now: () => new Date(),
        sendVerificationCode: (_email, value) => {
          code = value;
          throw new Error('Delivery failed');
        },
      });
      const second = await unavailable.start({
        subject: randomUUID(),
        termsVersion: '2026-08-27',
        privacyVersion: '2026-08-27',
      });
      expect(await unavailable.send(second, email)).toBe('unavailable');
      expect(await unavailable.verify(second, code)).toBeNull();
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });
  it('requires mailbox proof before atomically creating a passwordless Microsoft identity [microsoft-local-auth REQ-006, REQ-007, REQ-008]', async () => {
    const suffix = randomUUID();
    const email = `microsoft-test-${suffix}@example.com`;
    const sent: string[] = [];
    const signup = createSignup({
      prisma,
      digestKey: 'test-only-key',
      sendVerificationCode: (_email, code) => {
        sent.push(code);
        return Promise.resolve();
      },
      now: () => new Date(),
    });
    const pending = await signup.start({
      subject: `test-${suffix}`,
      emailHint: email,
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
    });
    try {
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
      expect(await signup.read(pending)).toMatchObject({ email, sent: false });
      expect(await signup.send(pending, email)).toBe('sent');
      expect(await signup.verify(pending, 'incorrect')).toBeNull();
      const completed = await signup.verify(pending, sent[0] ?? 'missing');
      expect(completed).toMatchObject({ destination: '/onboarding/about-you' });
      const user = await prisma.user.findUnique({
        where: { email },
        include: { password: true, externalIdentities: true, journeys: true },
      });
      expect(user?.emailVerifiedAt).toBeTruthy();
      expect(user?.password).toBeNull();
      expect(user?.externalIdentities[0]).toMatchObject({
        provider: 'MICROSOFT',
        subject: `test-${suffix}`,
      });
      expect(user?.journeys[0]?.currentStep).toBe('PERSONAL_PROFILE');
      expect(await signup.verify(pending, sent[0] ?? 'missing')).toBeNull();
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });
});
