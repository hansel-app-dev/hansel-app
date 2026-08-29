/** @spec onboarding-welcome-email REQ-007..REQ-012 @figma 131:549 */

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
    ): Promise<{
      data: { id: string } | null;
      error: unknown;
    }>;
  };
}

export interface WelcomeEmailInput {
  recipient: string;
  firstName: string;
  idempotencyKey: string;
}

export type WelcomeEmailFailureKind = 'transient' | 'permanent' | 'ambiguous';

export class WelcomeEmailSendError extends Error {
  constructor(readonly kind: WelcomeEmailFailureKind) {
    super('Welcome email delivery failed');
    this.name = 'WelcomeEmailSendError';
  }
}

function providerFailureKind(error: unknown): WelcomeEmailFailureKind {
  const providerError = error as { statusCode?: unknown; name?: unknown };
  return providerError.statusCode === 429 ||
    (typeof providerError.statusCode === 'number' &&
      providerError.statusCode >= 500) ||
    providerError.name === 'concurrent_idempotent_requests'
    ? 'transient'
    : 'permanent';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function createWelcomeEmailContent(
  firstName: string,
  dashboardUrl: string,
  approvedLogoSvg: string,
) {
  const subject = 'Welcome to Hansel';
  const text = `Welcome ${firstName}!\n\nYou're in! Thanks for completing your setup — your account and organization are ready to go.\n\nHere's what you can do next:\n- Start managing your signage\n- Invite your team or collaborators\n- Explore to get the most value right away\n\nWe're excited to have you with us.\n\nLog in: ${dashboardUrl}\n\nHansel\nThis email was sent by Hansel App as a result of your account creation.`;
  const safeFirstName = escapeHtml(firstName);
  const safeDashboardUrl = escapeHtml(dashboardUrl);
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#F7F5EB;color:#292727;font-family:Figtree,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#F7F5EB;">
      <tr>
        <td align="center" style="padding:64px 24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:800px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;">
                  <tr>
                    <td style="padding:32px;">
                      <div role="img" aria-label="Hansel Beta" style="margin:0 0 64px;width:114px;height:20px;">${approvedLogoSvg.replace('<svg ', '<svg aria-hidden="true" focusable="false" ')}</div>
                      <h1 style="margin:0 0 32px;font-size:28px;font-weight:600;line-height:1.25;color:#292727;">Welcome ${safeFirstName}!</h1>
                      <p style="margin:0 0 32px;font-size:16px;line-height:1.5;color:#292727;">You're in! Thanks for completing your setup — your account and organization are ready to go.</p>
                      <p style="margin:0 0 16px;font-size:16px;font-weight:600;line-height:1.5;color:#292727;">Here's what you can do next:</p>
                      <ul style="margin:0 0 32px;padding-left:24px;font-size:16px;line-height:1.75;color:#292727;">
                        <li>Start managing your signage</li>
                        <li>Invite your team or collaborators</li>
                        <li>Explore to get the most value right away</li>
                      </ul>
                      <div aria-hidden="true" style="height:280px;margin:0 0 32px;background-color:#E8E6DE;text-align:center;line-height:280px;color:#77746D;font-size:40px;">&#9654;</div>
                      <p style="margin:0 0 32px;font-size:16px;line-height:1.5;color:#292727;">We're excited to have you with us.</p>
                      <a href="${safeDashboardUrl}" style="display:inline-block;padding:12px 24px;border-radius:4px;background-color:#F57C00;color:#292727;font-size:16px;font-weight:600;line-height:1.5;text-decoration:none;">Log in</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:32px;">
                <p style="margin:0 0 8px;font-size:24px;font-weight:600;line-height:1;color:#C7C4BA;">Hansel</p>
                <p style="margin:0;font-size:14px;line-height:1.5;color:#77746D;">This email was sent by Hansel App as a result of your account creation.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return { subject, text, html };
}

export function createResendWelcomeSender(
  client: ResendClient,
  fromEmail: string,
  dashboardUrl: string,
  approvedLogoSvg: string,
) {
  return async function sendWelcomeEmail(
    input: WelcomeEmailInput,
  ): Promise<string> {
    const content = createWelcomeEmailContent(
      input.firstName,
      dashboardUrl,
      approvedLogoSvg,
    );
    let result: Awaited<ReturnType<ResendClient['emails']['send']>>;
    try {
      result = await client.emails.send(
        { from: fromEmail, to: [input.recipient], ...content },
        { idempotencyKey: input.idempotencyKey },
      );
    } catch {
      throw new WelcomeEmailSendError('ambiguous');
    }
    const { data, error } = result;
    if (error) throw new WelcomeEmailSendError(providerFailureKind(error));
    if (!data || !/^[A-Za-z0-9_-]{1,256}$/.test(data.id))
      throw new WelcomeEmailSendError('ambiguous');
    return data.id;
  };
}

export function createConsoleWelcomeSender(
  recordEvent: (
    name: string,
    details: {
      correlationId: string;
      intentId: string;
      template: 'ONBOARDING_WELCOME';
      state: 'delivered';
      category: 'console';
    },
  ) => void,
) {
  return function sendWelcomeEmail(input: WelcomeEmailInput): Promise<string> {
    const deliveryId = input.idempotencyKey.replace('onboarding-welcome/', '');
    recordEvent('welcome_email_console_delivery', {
      correlationId: deliveryId,
      intentId: deliveryId,
      template: 'ONBOARDING_WELCOME',
      state: 'delivered',
      category: 'console',
    });
    return Promise.resolve(`console-${deliveryId}`);
  };
}
