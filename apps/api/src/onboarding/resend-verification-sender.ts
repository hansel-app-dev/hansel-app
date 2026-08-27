interface ResendClient {
  emails: {
    send(input: {
      from: string;
      to: string[];
      subject: string;
      text: string;
    }): Promise<{ error: unknown }>;
  };
}

export function createResendVerificationSender(
  client: ResendClient,
  fromEmail: string,
) {
  return async function sendVerificationCode(
    recipient: string,
    code: string,
  ): Promise<void> {
    const { error } = await client.emails.send({
      from: fromEmail,
      to: [recipient],
      subject: 'Verify your Hansel account',
      text: `Verify your account.\n\nThanks for signing up! To complete your registration, please verify your account using the code below:\n\n${code}\n\nThe code will expire in 15 minutes for your security.`,
    });
    if (error) throw new Error('Resend failed to send verification email');
  };
}
