/** @spec user-login REQ-010 */
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

export class PasswordLockEmailSendError extends Error {
  constructor(readonly kind: 'transient' | 'permanent' | 'ambiguous') {
    super('Password lock email delivery failed');
    this.name = 'PasswordLockEmailSendError';
  }
}

export function createPasswordLockEmailContent() {
  const subject = 'Your Hansel password login was temporarily locked';
  const text = `Your Hansel password login is locked for 15 minutes after several unsuccessful attempts.

A linked provider or existing session still works.

If these attempts were unexpected, contact support@hanselapp.io.`;
  const html = `<!doctype html><html lang="en"><body><h1>${subject}</h1><p>Your Hansel password login is locked for 15 minutes after several unsuccessful attempts.</p><p>A linked provider or existing session still works.</p><p>If these attempts were unexpected, contact <a href="mailto:support@hanselapp.io">support@hanselapp.io</a>.</p></body></html>`;
  return { subject, text, html };
}

export function createResendPasswordLockSender(
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
          ...createPasswordLockEmailContent(),
        },
        { idempotencyKey: `password-lock/${input.intentId}` },
      );
    } catch {
      throw new PasswordLockEmailSendError('ambiguous');
    }
    if (result.error) {
      const error = result.error as { statusCode?: unknown; name?: unknown };
      const transient =
        error.statusCode === 429 ||
        (typeof error.statusCode === 'number' && error.statusCode >= 500) ||
        error.name === 'concurrent_idempotent_requests';
      throw new PasswordLockEmailSendError(
        transient ? 'transient' : 'permanent',
      );
    }
    if (!result.data || !/^[A-Za-z0-9_-]{1,256}$/.test(result.data.id))
      throw new PasswordLockEmailSendError('ambiguous');
    return result.data.id;
  };
}

export function createConsolePasswordLockSender(
  recordEvent: (name: string) => void,
) {
  return (input: { recipient: string; intentId: string }): Promise<string> => {
    recordEvent('password_lock_email_console_delivery');
    return Promise.resolve(`console-${input.intentId}`);
  };
}
