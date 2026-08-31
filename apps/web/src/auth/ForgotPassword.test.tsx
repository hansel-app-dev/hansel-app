import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForgotPassword } from './ForgotPassword.js';

afterEach(cleanup);

describe('ForgotPassword [password-recovery REQ-002..REQ-004, REQ-020]', () => {
  it('validates, normalizes, and continues through one generic request', async () => {
    const requestRecovery = vi.fn().mockResolvedValue({ status: 'accepted' });
    const onRequested = vi.fn();
    render(
      <ForgotPassword
        onRequested={onRequested}
        requestRecovery={requestRecovery}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Forgot your password?' }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Send reset code' }));
    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeVisible();
    expect(requestRecovery).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: '  OWNER@Example.com ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset code' }));
    await waitFor(() => {
      expect(requestRecovery).toHaveBeenCalledWith({
        email: 'owner@example.com',
      });
    });
    expect(onRequested).toHaveBeenCalledWith('owner@example.com');
    expect(
      screen.getByRole('link', { name: 'Back to log in' }),
    ).toHaveAttribute('href', '/login');
  });

  it('announces a safe temporary failure', async () => {
    render(
      <ForgotPassword requestRecovery={() => Promise.reject(new Error())} />,
    );
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password recovery is temporarily unavailable. Please try again.',
    );
  });
});
