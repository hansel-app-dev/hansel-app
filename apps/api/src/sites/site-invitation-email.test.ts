import { describe, expect, it, vi } from 'vitest';
import {
  createConsoleSiteInvitationSender,
  createResendSiteInvitationSender,
  createSiteInvitationContent,
  SiteInvitationSendError,
} from './site-invitation-email.js';

const input = {
  invitationId: 'invitation-id',
  recipient: 'viewer@example.com',
  organizationName: 'Hansel & Co',
  siteName: '<Sydney>',
  token: 'private-token',
};

describe('site invitation email [sites-add-new REQ-015]', () => {
  it('builds escaped, seven-day invitation content with the opaque token in its URL', () => {
    const content = createSiteInvitationContent(
      input,
      'https://app.example.com',
    );
    expect(content.subject).toContain('Hansel & Co');
    expect(content.text).toContain('token=private-token');
    expect(content.text).toContain('expires in 7 days');
    expect(content.html).toContain('Hansel &amp; Co');
    expect(content.html).toContain('&lt;Sydney&gt;');
    expect(content.html).not.toContain('<Sydney>');
  });

  it('sends through Resend with provider idempotency and validates the result', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: { id: 'provider_123' }, error: null });
    const sender = createResendSiteInvitationSender(
      { emails: { send } },
      'Hansel <hello@example.com>',
      'https://app.example.com',
    );
    await expect(sender(input)).resolves.toBe('provider_123');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['viewer@example.com'] }),
      { idempotencyKey: 'site-invitation/invitation-id' },
    );
  });

  it.each([
    () => Promise.resolve({ data: null, error: { statusCode: 500 } }),
    () => Promise.resolve({ data: { id: 'invalid id' }, error: null }),
    () => Promise.reject(new Error('network')),
  ])('bounds provider failures', async (result) => {
    const sender = createResendSiteInvitationSender(
      { emails: { send: vi.fn().mockImplementation(result) } },
      'hello@example.com',
      'https://app.example.com',
    );
    await expect(sender(input)).rejects.toBeInstanceOf(SiteInvitationSendError);
  });

  it('supports a redacted local sender', async () => {
    const recordEvent = vi.fn();
    await expect(
      createConsoleSiteInvitationSender(recordEvent)(input),
    ).resolves.toBe('console-invitation-id');
    expect(recordEvent).toHaveBeenCalledWith(
      'site_invitation_console_delivery',
      { invitationId: 'invitation-id' },
    );
    expect(JSON.stringify(recordEvent.mock.calls)).not.toContain(
      'viewer@example.com',
    );
    expect(JSON.stringify(recordEvent.mock.calls)).not.toContain(
      'private-token',
    );
  });
});
