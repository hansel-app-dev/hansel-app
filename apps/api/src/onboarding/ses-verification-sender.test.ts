import { describe, expect, it, vi } from 'vitest';
import { createSesVerificationSender } from './ses-verification-sender.js';

describe('SES verification sender [REQ-006, REQ-007]', () => {
  it('sends the code only to the requested recipient', async () => {
    const send = vi.fn().mockResolvedValue({ MessageId: 'message-id' });
    const sender = createSesVerificationSender(
      { send },
      'no-reply@hanselapp.io',
    );

    await sender('owner@example.com', '123456');

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0].input).toEqual({
      FromEmailAddress: 'no-reply@hanselapp.io',
      Destination: { ToAddresses: ['owner@example.com'] },
      Content: {
        Simple: {
          Subject: { Data: 'Verify your Hansel account', Charset: 'UTF-8' },
          Body: {
            Text: {
              Data: 'Your Hansel verification code is 123456. It expires in 15 minutes.',
              Charset: 'UTF-8',
            },
          },
        },
      },
    });
  });
});
