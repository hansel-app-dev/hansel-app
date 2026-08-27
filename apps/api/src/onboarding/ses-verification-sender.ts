import { SendEmailCommand } from '@aws-sdk/client-sesv2';

interface EmailClient {
  send(command: SendEmailCommand): Promise<unknown>;
}

export function createSesVerificationSender(
  client: EmailClient,
  fromEmailAddress: string,
) {
  return async function sendVerificationCode(
    recipient: string,
    code: string,
  ): Promise<void> {
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: fromEmailAddress,
        Destination: { ToAddresses: [recipient] },
        Content: {
          Simple: {
            Subject: {
              Data: 'Verify your Hansel account',
              Charset: 'UTF-8',
            },
            Body: {
              Text: {
                Data: `Your Hansel verification code is ${code}. It expires in 15 minutes.`,
                Charset: 'UTF-8',
              },
            },
          },
        },
      }),
    );
  };
}
