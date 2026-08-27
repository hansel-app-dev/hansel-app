import { describe, expect, it, vi } from 'vitest';
import {
  createResendVerificationSender,
  createVerificationEmailContent,
} from './resend-verification-sender.js';

describe('Resend verification sender [REQ-006, REQ-007, REQ-085]', () => {
  it('renders the Figma-approved HTML and equivalent plain text', () => {
    const content = createVerificationEmailContent('123456');
    expect(content.subject).toBe('Verify your Hansel account');
    expect(content.text).toBe(
      'Verify your account.\n\nThanks for signing up! To complete your registration, please verify your account using the code below:\n\n123456\n\nThe code will expire in 15 minutes for your security.\nIf you didn’t sign up or received this by mistake, you can ignore this email.\n\nNeed help? Just reply to this email or contact our support team.\n\nHansel\nThis email was sent by Hansel App as a result of your account creation.',
    );
    expect(content.html).toContain('max-width:800px');
    expect(content.html).toContain('max-width:600px');
    expect(content.html).toContain('background-color:#F7F5EB');
    expect(content.html).toContain('Verify your account.');
    expect(content.html).toContain('>123456<');
    expect(content.html).toContain(
      'The code will expire in 15 minutes for your security.',
    );
    expect(content.html).toContain(
      'This email was sent by Hansel App as a result of your account creation.',
    );
  });

  it('sends the approved verification message to one recipient', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: { id: 'email-id' }, error: null });
    const sender = createResendVerificationSender(
      { emails: { send } },
      'Hansel <onboarding@hanselapp.io>',
    );
    await sender('owner@example.com', '123456');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Hansel <onboarding@hanselapp.io>',
        to: ['owner@example.com'],
        subject: 'Verify your Hansel account',
        html: expect.stringContaining('>123456<'),
      }),
    );
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
