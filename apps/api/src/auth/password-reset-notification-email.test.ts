import { describe, expect, it, vi } from 'vitest';
import {
  createConsolePasswordResetNotificationSender,
  createPasswordResetNotificationContent,
  createResendPasswordResetNotificationSender,
  PasswordResetNotificationSendError,
} from './password-reset-notification-email.js';

describe('password reset notification email [password-recovery REQ-017]', () => {
  it('contains the approved security statements', () => {
    const content = createPasswordResetNotificationContent();
    expect(content.subject).toBe('Your Hansel password was changed');
    for (const statement of [
      'The password for your Hansel account was changed using account recovery.',
      'If you made this change, no further action is required.',
      'If you did not make this change, contact support@hanselapp.io immediately.',
    ]) {
      expect(content.text).toContain(statement);
      expect(content.html).toContain(statement);
    }
  });

  it('uses a stable Resend idempotency key', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: { id: 'message_1' }, error: null });
    const sender = createResendPasswordResetNotificationSender(
      { emails: { send } },
      'security@example.com',
    );
    await expect(
      sender({ recipient: 'owner@example.com', intentId: 'intent-1' }),
    ).resolves.toBe('message_1');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['owner@example.com'] }),
      { idempotencyKey: 'password-reset-notification/intent-1' },
    );
  });

  it.each([
    [Promise.resolve({ data: null, error: { statusCode: 429 } }), 'transient'],
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
  ])('classifies provider failures safely', async (result, kind) => {
    const sender = createResendPasswordResetNotificationSender(
      { emails: { send: vi.fn().mockReturnValue(result) } },
      'security@example.com',
    );
    await expect(
      sender({ recipient: 'owner@example.com', intentId: 'intent-1' }),
    ).rejects.toEqual(new PasswordResetNotificationSendError(kind as never));
  });

  it('classifies a thrown provider failure as ambiguous', async () => {
    const sender = createResendPasswordResetNotificationSender(
      { emails: { send: vi.fn().mockRejectedValue(new Error('private')) } },
      'security@example.com',
    );
    await expect(
      sender({ recipient: 'owner@example.com', intentId: 'intent-1' }),
    ).rejects.toEqual(new PasswordResetNotificationSendError('ambiguous'));
  });

  it('uses a redacted console fallback', async () => {
    const recordEvent = vi.fn();
    const sender = createConsolePasswordResetNotificationSender(recordEvent);
    await expect(
      sender({ recipient: 'owner@example.com', intentId: 'intent-1' }),
    ).resolves.toBe('console-intent-1');
    expect(recordEvent).toHaveBeenCalledWith(
      'password_reset_notification_console_delivery',
    );
  });
});
