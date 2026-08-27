interface ResendClient {
  emails: {
    send(input: {
      from: string;
      to: string[];
      subject: string;
      text: string;
      html: string;
    }): Promise<{ error: unknown }>;
  };
}

export function createVerificationEmailContent(code: string) {
  const subject = 'Verify your Hansel account';
  const text = `Verify your account.\n\nThanks for signing up! To complete your registration, please verify your account using the code below:\n\n${code}\n\nThe code will expire in 15 minutes for your security.\nIf you didn’t sign up or received this by mistake, you can ignore this email.\n\nNeed help? Just reply to this email or contact our support team.\n\nHansel\nThis email was sent by Hansel App as a result of your account creation.`;
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
                      <div style="margin:0 0 64px;font-size:28px;font-weight:700;line-height:1;color:#F57C00;">Hansel <span style="display:inline-block;padding:3px 5px;border-radius:3px;background-color:#E8E6DE;color:#77746D;font-size:10px;font-weight:500;vertical-align:middle;">Beta</span></div>
                      <h1 style="margin:0 0 32px;font-size:28px;font-weight:600;line-height:1.25;color:#292727;">Verify your account.</h1>
                      <p style="margin:0 0 32px;font-size:16px;line-height:1.5;color:#292727;">Thanks for signing up! To complete your registration, please verify your account using the code below:</p>
                      <div style="margin:0 0 32px;"><span style="display:inline-block;padding:12px 16px;border-radius:4px;background-color:#F0EFEC;font-size:24px;font-weight:600;line-height:1;letter-spacing:4px;color:#292727;">${code}</span></div>
                      <p style="margin:0 0 32px;font-size:16px;line-height:1.5;color:#292727;">The code will expire in 15 minutes for your security.<br>If you didn’t sign up or received this by mistake, you can ignore this email.</p>
                      <p style="margin:0;font-size:16px;line-height:1.5;color:#292727;">Need help? Just reply to this email or contact our support team.</p>
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

export function createResendVerificationSender(
  client: ResendClient,
  fromEmail: string,
) {
  return async function sendVerificationCode(
    recipient: string,
    code: string,
  ): Promise<void> {
    const content = createVerificationEmailContent(code);
    const { error } = await client.emails.send({
      from: fromEmail,
      to: [recipient],
      ...content,
    });
    if (error) throw new Error('Resend failed to send verification email');
  };
}
