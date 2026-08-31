/** @spec password-recovery REQ-012..REQ-015 @figma 132:961 */
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

export interface PasswordRecoveryEmailInput {
  recipient: string;
  firstName: string | null;
  code: string;
  challengeId: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function createPasswordRecoveryEmailContent(
  firstName: string | null,
  code: string,
  resetUrl: string,
  approvedLogoSvg: string,
) {
  const subject = 'Reset your Hansel password';
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const text = `Reset your password.\n\n${greeting}\n\nWe received a request to reset the password for your account.\nIf you made this request, use the code below to set a new password:\n\n${code}\n\nReset your password: ${resetUrl}\n\nIf you didn't request a password reset, you can safely ignore this email — your current password will remain unchanged. For security, this code will expire in 15 minutes.\n\nNeed help? Just reply to this email or contact our support team.\n\nHansel\nThis email was sent by Hansel App because a password reset was requested for your account.`;
  const safeGreeting = escapeHtml(greeting);
  const safeCode = escapeHtml(code);
  const safeResetUrl = escapeHtml(resetUrl);
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
                      <h1 style="margin:0 0 32px;font-size:28px;font-weight:600;line-height:1.25;color:#292727;">Reset your password.</h1>
                      <p style="margin:0 0 32px;font-size:16px;line-height:1.5;color:#292727;">${safeGreeting}</p>
                      <p style="margin:0 0 32px;font-size:16px;line-height:1.5;color:#292727;">We received a request to reset the password for your account.<br>If you made this request, use the code below to set a new password:</p>
                      <div style="margin:0 0 32px;"><span style="display:inline-block;padding:12px 16px;border-radius:4px;background-color:#F0EFEC;font-size:24px;font-weight:600;line-height:1;letter-spacing:4px;color:#292727;">${safeCode}</span></div>
                      <p style="margin:0 0 32px;"><a href="${safeResetUrl}" style="display:inline-block;padding:12px 20px;border-radius:4px;background-color:#485463;color:#FFFFFF;font-size:16px;font-weight:600;line-height:1.5;text-decoration:none;">Reset your password</a></p>
                      <p style="margin:0 0 32px;font-size:16px;line-height:1.5;color:#292727;">If you didn't request a password reset, you can safely ignore this email — your current password will remain unchanged. For security, this code will expire in 15 minutes.</p>
                      <p style="margin:0;font-size:16px;line-height:1.5;color:#292727;">Need help? Just reply to this email or contact our support team.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:32px;">
                <p style="margin:0 0 8px;font-size:24px;font-weight:600;line-height:1;color:#C7C4BA;">Hansel</p>
                <p style="margin:0;font-size:14px;line-height:1.5;color:#77746D;">This email was sent by Hansel App because a password reset was requested for your account.</p>
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

export function createResendPasswordRecoverySender(
  client: ResendClient,
  fromEmail: string,
  resetUrl: string,
  approvedLogoSvg: string,
) {
  return async function sendPasswordRecoveryEmail(
    input: PasswordRecoveryEmailInput,
  ): Promise<void> {
    const content = createPasswordRecoveryEmailContent(
      input.firstName,
      input.code,
      resetUrl,
      approvedLogoSvg,
    );
    const { data, error } = await client.emails.send(
      { from: fromEmail, to: [input.recipient], ...content },
      { idempotencyKey: `password-recovery/${input.challengeId}` },
    );
    if (error || !data) throw new Error('Password recovery email failed');
  };
}

export function createConsolePasswordRecoverySender(
  recordEvent: (name: string) => void,
) {
  return (_input: PasswordRecoveryEmailInput): Promise<void> => {
    recordEvent('password_recovery_email_console_delivery');
    return Promise.resolve();
  };
}
