import { describe, expect, it, vi } from 'vitest';
import { createConsoleVerificationSender } from './console-verification-sender.js';

describe('console verification sender [REQ-008]', () => {
  it('outputs the local recipient and verification code', async () => {
    const info = vi.fn();
    const send = createConsoleVerificationSender({ info });

    await send('person@example.com', '123456');

    expect(info).toHaveBeenCalledWith(
      JSON.stringify({
        level: 'INFO',
        message: 'Local verification email',
        email: 'person@example.com',
        code: '123456',
      }),
    );
  });
});
