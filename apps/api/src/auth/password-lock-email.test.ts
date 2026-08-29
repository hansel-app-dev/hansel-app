import { describe, expect, it, vi } from 'vitest';
import {
  createPasswordLockEmailContent,
  createConsolePasswordLockSender,
  createResendPasswordLockSender,
  PasswordLockEmailSendError,
} from './password-lock-email.js';

describe('password lock email [user-login REQ-010]', () => {
  it('uses the approved security copy without sensitive attempt detail', () => {
    const content = createPasswordLockEmailContent();
    expect(content.subject).toBe(
      'Your Hansel password login was temporarily locked',
    );
    for (const statement of [
      'locked for 15 minutes',
      'several unsuccessful attempts',
      'linked provider or existing session',
      'support@hanselapp.io',
    ]) {
      expect(content.text).toContain(statement);
      expect(content.html).toContain(statement);
    }
  });

  it('sends through Resend with the stable intent idempotency key', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: { id: 'message_1' }, error: null });
    const sender = createResendPasswordLockSender(
      { emails: { send } },
      'Hansel <security@hanselapp.io>',
    );
    await expect(
      sender({ recipient: 'owner@example.com', intentId: 'intent-1' }),
    ).resolves.toBe('message_1');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['owner@example.com'],
        subject: 'Your Hansel password login was temporarily locked',
      }),
      { idempotencyKey: 'password-lock/intent-1' },
    );
  });

  it('classifies provider failures without exposing provider details', async () => {
    const sender = createResendPasswordLockSender(
      {
        emails: {
          send: vi.fn().mockResolvedValue({
            data: null,
            error: { statusCode: 429, message: 'private provider response' },
          }),
        },
      },
      'Hansel <security@hanselapp.io>',
    );
    await expect(
      sender({ recipient: 'owner@example.com', intentId: 'intent-1' }),
    ).rejects.toEqual(new PasswordLockEmailSendError('transient'));
  });

  it.each([
    [Promise.resolve({ data: null, error: { statusCode: 503 } }), 'transient'],
    [
      Promise.resolve({
        data: null,
        error: { name: 'concurrent_idempotent_requests' },
      }),
      'transient',
    ],
    [Promise.resolve({ data: null, error: { statusCode: 400 } }), 'permanent'],
    [Promise.resolve({ data: null, error: null }), 'ambiguous'],
    [Promise.resolve({ data: { id: 'invalid id' }, error: null }), 'ambiguous'],
  ])('classifies every provider failure safely', async (result, kind) => {
    const sender = createResendPasswordLockSender(
      { emails: { send: vi.fn().mockReturnValue(result) } },
      'Hansel <security@hanselapp.io>',
    );
    await expect(
      sender({ recipient: 'owner@example.com', intentId: 'intent-1' }),
    ).rejects.toEqual(new PasswordLockEmailSendError(kind as never));
  });

  it('classifies a thrown provider result as ambiguous', async () => {
    const sender = createResendPasswordLockSender(
      {
        emails: {
          send: vi.fn().mockRejectedValue(new Error('network detail')),
        },
      },
      'Hansel <security@hanselapp.io>',
    );
    await expect(
      sender({ recipient: 'owner@example.com', intentId: 'intent-1' }),
    ).rejects.toEqual(new PasswordLockEmailSendError('ambiguous'));
  });

  it('provides a development sender without logging an address', async () => {
    const recordEvent = vi.fn();
    const sender = createConsolePasswordLockSender(recordEvent);
    await expect(
      sender({ recipient: 'owner@example.com', intentId: 'intent-1' }),
    ).resolves.toBe('console-intent-1');
    expect(recordEvent).toHaveBeenCalledWith(
      'password_lock_email_console_delivery',
    );
  });
});
