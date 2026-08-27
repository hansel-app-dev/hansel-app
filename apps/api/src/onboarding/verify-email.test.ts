import { describe, expect, it, vi } from 'vitest';
import { createEmailVerification } from './verify-email.js';

describe('email verification [REQ-006, REQ-007, REQ-084]', () => {
  it('advances after the store accepts the current code', async () => {
    const verify = vi.fn().mockResolvedValue(true);
    const service = createEmailVerification({
      verify,
      resend: vi.fn(),
      digestVerificationCode: (code) => `digest:${code}`,
      createVerificationCode: () => '654321',
      sendVerificationCode: vi.fn(),
      now: () => new Date('2026-08-27T00:00:00Z'),
    });
    await expect(
      service.verifyEmail({ email: 'owner@example.com', code: '123456' }),
    ).resolves.toEqual({ nextStep: 'personal-profile' });
    expect(verify).toHaveBeenCalledWith({
      email: 'owner@example.com',
      codeDigest: 'digest:123456',
      now: new Date('2026-08-27T00:00:00Z'),
    });
  });

  it('returns a generic failure when the code is not accepted', async () => {
    const service = createEmailVerification({
      verify: vi.fn().mockResolvedValue(false),
      resend: vi.fn(),
      digestVerificationCode: vi.fn(),
      createVerificationCode: vi.fn(),
      sendVerificationCode: vi.fn(),
      now: () => new Date(),
    });
    await expect(
      service.verifyEmail({ email: 'owner@example.com', code: '123456' }),
    ).rejects.toMatchObject({ code: 'verification_failed' });
  });

  it('sends a replacement only when the store accepts the request', async () => {
    const send = vi.fn();
    const resend = vi.fn().mockResolvedValue(true);
    const service = createEmailVerification({
      verify: vi.fn(),
      resend,
      digestVerificationCode: (code) => `digest:${code}`,
      createVerificationCode: () => '654321',
      sendVerificationCode: send,
      now: () => new Date('2026-08-27T00:00:00Z'),
    });
    await expect(
      service.resendVerification({ email: 'owner@example.com' }),
    ).resolves.toEqual({ status: 'accepted' });
    expect(send).toHaveBeenCalledWith('owner@example.com', '654321');
  });

  it('keeps throttled or unknown resend requests generic', async () => {
    const send = vi.fn();
    const service = createEmailVerification({
      verify: vi.fn(),
      resend: vi.fn().mockResolvedValue(false),
      digestVerificationCode: vi.fn(),
      createVerificationCode: () => '654321',
      sendVerificationCode: send,
      now: () => new Date(),
    });
    await expect(
      service.resendVerification({ email: 'owner@example.com' }),
    ).resolves.toEqual({ status: 'accepted' });
    expect(send).not.toHaveBeenCalled();
  });
});
