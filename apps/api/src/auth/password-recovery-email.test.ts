import { describe, expect, it, vi } from 'vitest';
import {
  createConsolePasswordRecoverySender,
  createPasswordRecoveryEmailContent,
  createResendPasswordRecoverySender,
} from './password-recovery-email.js';

const logo = '<svg viewBox="0 0 114 20"><path /></svg>';

describe('password recovery email [password-recovery REQ-012..REQ-015]', () => {
  it('renders the adapted Figma email with a code and no URL secret', () => {
    const content = createPasswordRecoveryEmailContent(
      'Ava',
      '123456',
      'https://app.hanselapp.io/reset-password',
      logo,
    );
    expect(content.subject).toBe('Reset your Hansel password');
    expect(content.text).toBe(
      "Reset your password.\n\nHi Ava,\n\nWe received a request to reset the password for your account.\nIf you made this request, use the code below to set a new password:\n\n123456\n\nReset your password: https://app.hanselapp.io/reset-password\n\nIf you didn't request a password reset, you can safely ignore this email — your current password will remain unchanged. For security, this code will expire in 15 minutes.\n\nNeed help? Just reply to this email or contact our support team.\n\nHansel\nThis email was sent by Hansel App because a password reset was requested for your account.",
    );
    expect(content.html).toContain('max-width:800px');
    expect(content.html).toContain('max-width:600px');
    expect(content.html).toContain('background-color:#F7F5EB');
    expect(content.html).toContain('Reset your password.');
    expect(content.html).toContain('>123456<');
    expect(content.html).toContain(
      'href="https://app.hanselapp.io/reset-password"',
    );
    expect(content.html).not.toContain('123456</a>');
    expect(content.html).toContain('code will expire in 15 minutes');
  });

  it('uses a neutral greeting and escapes every email-controlled value', () => {
    const content = createPasswordRecoveryEmailContent(
      null,
      '<123&>',
      'https://example.com/?a=1&b="two"',
      logo,
    );
    expect(content.text).toContain('Hi,');
    expect(content.html).toContain('&lt;123&amp;&gt;');
    expect(content.html).toContain('a=1&amp;b=&quot;two&quot;');
  });

  it('sends one escaped message with a stable non-personal idempotency key', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: { id: 'provider-id' }, error: null });
    const sender = createResendPasswordRecoverySender(
      { emails: { send } },
      'Hansel <onboarding@hanselapp.io>',
      'https://app.hanselapp.io/reset-password',
      logo,
    );

    await expect(
      sender({
        recipient: 'owner@example.com',
        firstName: '<Ava>',
        code: '123456',
        challengeId: '8a6e3fc8-c916-4c2d-9e97-2b5f8dece5f6',
      }),
    ).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['owner@example.com'],
        subject: 'Reset your Hansel password',
        html: expect.stringContaining('&lt;Ava&gt;'),
      }),
      {
        idempotencyKey:
          'password-recovery/8a6e3fc8-c916-4c2d-9e97-2b5f8dece5f6',
      },
    );
  });

  it('keeps console delivery free of recipient and code data', async () => {
    const recordEvent = vi.fn();
    const sender = createConsolePasswordRecoverySender(recordEvent);
    await sender({
      recipient: 'owner@example.com',
      firstName: 'Ava',
      code: '123456',
      challengeId: 'challenge-id',
    });
    expect(recordEvent).toHaveBeenCalledWith(
      'password_recovery_email_console_delivery',
    );
  });

  it.each([
    [{ data: null, error: { statusCode: 503 } }],
    [{ data: null, error: null }],
  ])('maps provider failure to a categorical error', async (result) => {
    const sender = createResendPasswordRecoverySender(
      { emails: { send: vi.fn().mockResolvedValue(result) } },
      'security@example.com',
      'https://app.example.com/reset-password',
      logo,
    );
    await expect(
      sender({
        recipient: 'owner@example.com',
        firstName: null,
        code: '123456',
        challengeId: 'challenge',
      }),
    ).rejects.toThrow('Password recovery email failed');
  });
});
