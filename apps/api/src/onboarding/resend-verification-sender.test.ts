import { describe, expect, it, vi } from 'vitest';
import { createResendVerificationSender } from './resend-verification-sender.js';

describe('Resend verification sender [REQ-006, REQ-007]', () => {
  it('sends the approved verification message to one recipient', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: { id: 'email-id' }, error: null });
    const sender = createResendVerificationSender(
      { emails: { send } },
      'Hansel <onboarding@hanselapp.io>',
    );
    await sender('owner@example.com', '123456');
    expect(send).toHaveBeenCalledWith({
      from: 'Hansel <onboarding@hanselapp.io>',
      to: ['owner@example.com'],
      subject: 'Verify your Hansel account',
      text: 'Verify your account.\n\nThanks for signing up! To complete your registration, please verify your account using the code below:\n\n123456\n\nThe code will expire in 15 minutes for your security.',
    });
  });

  it('fails without exposing the provider response', async () => {
    const send = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'secret provider detail' },
    });
    const sender = createResendVerificationSender(
      { emails: { send } },
      'Hansel <onboarding@hanselapp.io>',
    );
    await expect(sender('owner@example.com', '123456')).rejects.toThrow(
      'Resend failed to send verification email',
    );
  });
});
