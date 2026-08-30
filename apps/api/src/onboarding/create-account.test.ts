import { describe, expect, it, vi } from 'vitest';
import { createAccountRegistration } from './create-account.js';

describe('account registration [REQ-005, REQ-006, REQ-007, REQ-023, REQ-024, REQ-049, REQ-050]', () => {
  it('stores protected account material and delivers the raw verification code', async () => {
    const storePendingAccount = vi
      .fn()
      .mockResolvedValue({ shouldSend: true, nextStep: 'verify-email' });
    const sendVerificationCode = vi.fn().mockResolvedValue(undefined);
    const register = createAccountRegistration({
      hashPassword: vi.fn().mockResolvedValue('argon2id-hash'),
      createVerificationCode: vi.fn().mockReturnValue('123456'),
      digestVerificationCode: vi.fn().mockReturnValue('code-digest'),
      storePendingAccount,
      sendVerificationCode,
      now: () => new Date('2026-08-27T00:00:00.000Z'),
    });

    await expect(
      register({
        email: 'owner@example.com',
        password: 'Correct horse battery staple!7',
        acceptsTerms: true,
        termsVersion: '2026-08-27',
        privacyVersion: '2026-08-27',
      }),
    ).resolves.toEqual({ nextStep: 'verify-email' });

    expect(storePendingAccount).toHaveBeenCalledWith({
      email: 'owner@example.com',
      passwordHash: 'argon2id-hash',
      verificationCodeDigest: 'code-digest',
      verificationExpiresAt: new Date('2026-08-27T00:15:00.000Z'),
      termsVersion: '2026-08-27',
      privacyVersion: '2026-08-27',
      consentedAt: new Date('2026-08-27T00:00:00.000Z'),
    });
    expect(sendVerificationCode).toHaveBeenCalledWith(
      'owner@example.com',
      '123456',
    );
    expect(storePendingAccount).not.toHaveBeenCalledWith(
      expect.objectContaining({ password: expect.anything() }),
    );
  });

  it('routes an existing account to login without sending verification [REQ-088]', async () => {
    const sendVerificationCode = vi.fn();
    const hashPassword = vi.fn().mockResolvedValue('unused-hash');
    const register = createAccountRegistration({
      hashPassword,
      createVerificationCode: () => '123456',
      digestVerificationCode: () => 'unused-digest',
      storePendingAccount: vi
        .fn()
        .mockResolvedValue({ shouldSend: false, nextStep: 'login' }),
      sendVerificationCode,
      now: () => new Date('2026-08-27T00:00:00.000Z'),
    });

    await expect(
      register({
        email: 'owner@example.com',
        password: 'Correct horse battery staple!7',
        acceptsTerms: true,
        termsVersion: '2026-08-27',
        privacyVersion: '2026-08-27',
      }),
    ).resolves.toEqual({ nextStep: 'login' });

    expect(hashPassword).toHaveBeenCalledOnce();
    expect(sendVerificationCode).not.toHaveBeenCalled();
  });
});
