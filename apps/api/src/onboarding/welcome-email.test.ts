import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  createConsoleWelcomeSender,
  createResendWelcomeSender,
  createWelcomeEmailContent,
  WelcomeEmailSendError,
} from './welcome-email.js';

const approvedLogoSvg = readFileSync(
  new URL('../../../web/public/assets/hansel-logo-beta.svg', import.meta.url),
  'utf8',
);

describe('Welcome email [onboarding-welcome-email REQ-005..REQ-013]', () => {
  it('renders the Figma-approved HTML and equivalent plain text safely', () => {
    const content = createWelcomeEmailContent(
      '<Ava & friends>',
      'https://app.hanselapp.io/dashboard',
      approvedLogoSvg,
    );

    expect(content.subject).toBe('Welcome to Hansel');
    expect(content.text).toBe(
      "Welcome <Ava & friends>!\n\nYou're in! Thanks for completing your setup — your account and organization are ready to go.\n\nHere's what you can do next:\n- Start managing your signage\n- Invite your team or collaborators\n- Explore to get the most value right away\n\nWe're excited to have you with us.\n\nLog in: https://app.hanselapp.io/dashboard\n\nHansel\nThis email was sent by Hansel App as a result of your account creation.",
    );
    expect(content.html).toContain('max-width:800px');
    expect(content.html).toContain('background-color:#F7F5EB');
    expect(content.html).toContain('padding:64px 24px');
    expect(content.html).toContain('max-width:600px;background-color:#FFFFFF');
    expect(content.html).toContain('style="padding:32px;"');
    expect(content.html).toContain('margin:0 0 64px;width:114px;height:20px');
    expect(content.html).toContain(
      '<svg aria-hidden="true" focusable="false" width="114" height="20"',
    );
    expect(content.html).toContain('aria-label="Hansel Beta"');
    expect(content.html).toContain(
      '<td align="center" style="padding-top:32px;">',
    );
    expect(content.html.match(/<table role="presentation"/g)).toHaveLength(3);
    expect(content.html).not.toContain('<style');
    expect(content.html).not.toContain('min-width:');
    expect(content.html).toContain('Welcome &lt;Ava &amp; friends&gt;!');
    expect(content.html).not.toContain('Welcome <Ava & friends>!');
    expect(content.html).toContain(
      "You're in! Thanks for completing your setup — your account and organization are ready to go.",
    );
    expect(content.html).toContain('Start managing your signage');
    expect(content.html).toContain('Invite your team or collaborators');
    expect(content.html).toContain('Explore to get the most value right away');
    expect(content.html).toContain("We're excited to have you with us.");
    expect(content.html).toContain('href="https://app.hanselapp.io/dashboard"');
    expect(content.html).toContain('>Log in</a>');
    expect(content.html).toContain('aria-hidden="true"');
    expect(content.html).not.toContain('<script');
    expect(content.html).not.toContain('tracking');
  });

  it('sends one idempotent Resend message and returns its identifier', async () => {
    const send = vi.fn().mockResolvedValue({
      data: { id: 'resend-message-id' },
      error: null,
    });
    const sender = createResendWelcomeSender(
      { emails: { send } },
      'Hansel <onboarding@hanselapp.io>',
      'https://app.hanselapp.io/dashboard',
      approvedLogoSvg,
    );

    await expect(
      sender({
        recipient: 'owner@example.com',
        firstName: 'Ava',
        idempotencyKey: 'onboarding-welcome/delivery-id',
      }),
    ).resolves.toBe('resend-message-id');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Hansel <onboarding@hanselapp.io>',
        to: ['owner@example.com'],
        subject: 'Welcome to Hansel',
        html: expect.stringContaining('Welcome Ava!'),
      }),
      { idempotencyKey: 'onboarding-welcome/delivery-id' },
    );
  });

  it.each([
    [{ statusCode: 429, message: 'secret rate limit detail' }, 'transient'],
    [{ statusCode: 503, message: 'secret outage detail' }, 'transient'],
    [{ statusCode: 400, message: 'secret validation detail' }, 'permanent'],
  ] as const)(
    'classifies provider error responses safely',
    async (error, kind) => {
      const sender = createResendWelcomeSender(
        {
          emails: {
            send: vi.fn().mockResolvedValue({ data: null, error }),
          },
        },
        'Hansel <onboarding@hanselapp.io>',
        'https://app.hanselapp.io/dashboard',
        approvedLogoSvg,
      );

      const promise = sender({
        recipient: 'owner@example.com',
        firstName: 'Ava',
        idempotencyKey: 'onboarding-welcome/delivery-id',
      });
      await expect(promise).rejects.toMatchObject({
        name: 'WelcomeEmailSendError',
        kind,
        message: 'Welcome email delivery failed',
      });
      await expect(promise).rejects.not.toThrow('secret');
    },
  );

  it('classifies thrown or incomplete provider results as ambiguous', async () => {
    for (const send of [
      vi.fn().mockRejectedValue(new Error('secret network detail')),
      vi.fn().mockResolvedValue({ data: null, error: null }),
      vi.fn().mockResolvedValue({
        data: { id: `unsafe\n${'x'.repeat(257)}` },
        error: null,
      }),
    ]) {
      const sender = createResendWelcomeSender(
        { emails: { send } },
        'Hansel <onboarding@hanselapp.io>',
        'https://app.hanselapp.io/dashboard',
        approvedLogoSvg,
      );
      await expect(
        sender({
          recipient: 'owner@example.com',
          firstName: 'Ava',
          idempotencyKey: 'onboarding-welcome/delivery-id',
        }),
      ).rejects.toEqual(new WelcomeEmailSendError('ambiguous'));
    }
  });

  it('records a privacy-safe local delivery without message content', async () => {
    const recordEvent = vi.fn();
    const sender = createConsoleWelcomeSender(recordEvent);

    await expect(
      sender({
        recipient: 'owner@example.com',
        firstName: 'Ava',
        idempotencyKey: 'onboarding-welcome/delivery-id',
      }),
    ).resolves.toBe('console-delivery-id');
    expect(recordEvent).toHaveBeenCalledWith('welcome_email_console_delivery', {
      correlationId: 'delivery-id',
      intentId: 'delivery-id',
      template: 'ONBOARDING_WELCOME',
      state: 'delivered',
      category: 'console',
    });
    expect(JSON.stringify(recordEvent.mock.calls)).not.toContain(
      'owner@example.com',
    );
    expect(JSON.stringify(recordEvent.mock.calls)).not.toContain('Ava');
  });
});
