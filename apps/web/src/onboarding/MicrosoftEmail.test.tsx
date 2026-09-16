/** @spec microsoft-local-auth REQ-005..REQ-008 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MicrosoftEmail } from './MicrosoftEmail.js';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each([401, 503])(
  'handles pending-state HTTP %s [microsoft-local-auth REQ-008]',
  async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status })),
    );
    render(<MicrosoftEmail />);
    expect(
      await screen.findByText(
        status === 401
          ? 'Your signup has expired. Start again with Microsoft.'
          : 'Signup is temporarily unavailable. Please try again.',
      ),
    ).toBeVisible();
  },
);

it.each([401, 429, 503])(
  'shows safe email-delivery HTTP %s [microsoft-local-auth REQ-006, REQ-008]',
  async (status) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          email: 'person@example.com',
          sent: false,
          resendAfter: 0,
        }),
      )
      .mockResolvedValueOnce(new Response('', { status }));
    vi.stubGlobal('fetch', fetcher);
    render(<MicrosoftEmail />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Send verification code' }),
    );
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(fetcher).toHaveBeenLastCalledWith(
      '/api/auth/microsoft/signup/send',
      expect.objectContaining({
        body: JSON.stringify({ email: 'person@example.com' }),
        credentials: 'same-origin',
      }),
    );
  },
);

it.each([200, 400])(
  'submits verification through the API with HTTP %s [microsoft-local-auth REQ-007, REQ-008]',
  async (status) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          email: 'person@example.com',
          sent: true,
          resendAfter: 0,
        }),
      )
      .mockResolvedValueOnce(new Response('', { status }));
    vi.stubGlobal('fetch', fetcher);
    render(<MicrosoftEmail />);
    fireEvent.change(await screen.findByLabelText('Verification code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    await waitFor(() => {
      expect(fetcher).toHaveBeenLastCalledWith(
        '/api/auth/microsoft/signup/verify',
        expect.objectContaining({ body: JSON.stringify({ code: '123456' }) }),
      );
    });
    if (status === 400)
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'original sign-in method',
      );
  },
);

it('counts down resend and handles non-Error failures [microsoft-local-auth REQ-006, REQ-008]', async () => {
  render(
    <MicrosoftEmail
      load={() =>
        Promise.resolve({
          email: 'person@example.com',
          sent: true,
          resendAfter: 1,
        })
      }
      send={vi.fn().mockRejectedValue('unavailable')}
    />,
  );
  expect(
    await screen.findByRole('button', { name: 'Send again in 1s' }),
  ).toBeDisabled();
  fireEvent.click(
    await screen.findByRole(
      'button',
      { name: 'Send a new code' },
      { timeout: 2000 },
    ),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Please try again.',
  );
});

it('ignores late state loads after leaving the screen [microsoft-local-auth REQ-005]', async () => {
  let resolve: (value: null) => void = vi.fn();
  let reject: (error: Error) => void = vi.fn();
  const loaded = new Promise<null>((done) => {
    resolve = done;
  });
  const failed = new Promise<null>((_done, fail) => {
    reject = fail;
  });
  const first = render(<MicrosoftEmail load={() => loaded} />);
  first.unmount();
  await act(async () => {
    resolve(null);
    await loaded;
  });
  const second = render(<MicrosoftEmail load={() => failed} />);
  second.unmount();
  await act(async () => {
    reject(new Error('Unavailable'));
    await failed.catch(() => undefined);
  });
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
});
it('announces expired signup and offers restarting [microsoft-local-auth REQ-008]', async () => {
  render(<MicrosoftEmail load={() => Promise.resolve(null)} />);
  expect(
    await screen.findByText(
      'Your signup has expired. Start again with Microsoft.',
    ),
  ).toHaveAttribute('role', 'status');
  expect(
    screen.getByRole('link', { name: 'Create an account' }),
  ).toHaveAttribute('href', '/onboarding');
});
it('verifies a delivered code and displays a safe retry failure [microsoft-local-auth REQ-006, REQ-008]', async () => {
  const verify = vi.fn().mockRejectedValue(new Error('Request a new code.'));
  render(
    <MicrosoftEmail
      load={() =>
        Promise.resolve({
          email: 'person@example.com',
          sent: true,
          resendAfter: 0,
        })
      }
      verify={verify}
    />,
  );
  fireEvent.change(await screen.findByLabelText('Verification code'), {
    target: { value: '123456' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Request a new code.',
  );
  expect(verify).toHaveBeenCalledWith('123456');
});
it('requires explicit email submission and never asks for a password [microsoft-local-auth REQ-004, REQ-005]', async () => {
  const send = vi.fn().mockResolvedValue(undefined);
  render(
    <MicrosoftEmail
      load={() =>
        Promise.resolve({
          email: 'hint@example.com',
          sent: false,
          resendAfter: 0,
        })
      }
      send={send}
      verify={vi.fn()}
    />,
  );
  const email = await screen.findByLabelText('Email');
  expect(email).toHaveValue('hint@example.com');
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  expect(send).not.toHaveBeenCalled();
  fireEvent.change(email, { target: { value: 'chosen@example.com' } });
  fireEvent.click(
    screen.getByRole('button', { name: 'Send verification code' }),
  );
  expect(await screen.findByLabelText('Verification code')).toBeInTheDocument();
  expect(send).toHaveBeenCalledWith('chosen@example.com');
});
