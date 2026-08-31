/** @spec password-recovery REQ-017 */
interface ResendClient {
  emails: {
    send(
      input: {
        from: string;
        to: string[];
        subject: string;
        text: string;
        html: string;
      },
      options: { idempotencyKey: string },
    ): Promise<{ data: { id: string } | null; error: unknown }>;
  };
}

export class PasswordResetNotificationSendError extends Error {
  constructor(readonly kind: 'transient' | 'permanent' | 'ambiguous') {
    super('Password reset notification delivery failed');
    this.name = 'PasswordResetNotificationSendError';
  }
}

export function createPasswordResetNotificationContent() {
  const subject = 'Your Hansel password was changed';
  const text = `Your Hansel password was changed\n\nThe password for your Hansel account was changed using account recovery.\n\nIf you made this change, no further action is required.\n\nIf you did not make this change, contact support@hanselapp.io immediately.`;
  const html = `<!doctype html><html lang="en"><body><h1>${subject}</h1><p>The password for your Hansel account was changed using account recovery.</p><p>If you made this change, no further action is required.</p><p>If you did not make this change, contact support@hanselapp.io immediately.</p></body></html>`;
  return { subject, text, html };
}

export function createResendPasswordResetNotificationSender(
  client: ResendClient,
  fromEmail: string,
) {
  return async (input: {
    recipient: string;
    intentId: string;
  }): Promise<string> => {
    let result: Awaited<ReturnType<ResendClient['emails']['send']>>;
    try {
      result = await client.emails.send(
        {
          from: fromEmail,
          to: [input.recipient],
          ...createPasswordResetNotificationContent(),
        },
        { idempotencyKey: `password-reset-notification/${input.intentId}` },
      );
    } catch {
      throw new PasswordResetNotificationSendError('ambiguous');
    }
    if (result.error) {
      const error = result.error as { statusCode?: unknown; name?: unknown };
      const transient =
        error.statusCode === 429 ||
        (typeof error.statusCode === 'number' && error.statusCode >= 500) ||
        error.name === 'concurrent_idempotent_requests';
      throw new PasswordResetNotificationSendError(
        transient ? 'transient' : 'permanent',
      );
    }
    if (!result.data || !/^[A-Za-z0-9_-]{1,256}$/.test(result.data.id))
      throw new PasswordResetNotificationSendError('ambiguous');
    return result.data.id;
  };
}

export function createConsolePasswordResetNotificationSender(
  recordEvent: (name: string) => void,
) {
  return (input: { recipient: string; intentId: string }): Promise<string> => {
    recordEvent('password_reset_notification_console_delivery');
    return Promise.resolve(`console-${input.intentId}`);
  };
}
