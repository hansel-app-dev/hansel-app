import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasswordResetRejectedError } from '../api.js';
import { ResetPassword } from './ResetPassword.js';

afterEach(cleanup);

function fillValid() {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: ' OWNER@Example.com ' },
  });
  fireEvent.change(screen.getByLabelText('Reset code'), {
    target: { value: '123456' },
  });
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: 'Correct horse battery staple!7' },
  });
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'Correct horse battery staple!7' },
  });
}

describe('ResetPassword [password-recovery REQ-008..REQ-010, REQ-016, REQ-020]', () => {
  it('submits the strict reset and returns to login', async () => {
    const resetPassword = vi.fn().mockResolvedValue({ destination: '/login' });
    const onReset = vi.fn();
    render(
      <ResetPassword
        email="owner@example.com"
        onReset={onReset}
        requestRecovery={vi.fn()}
        resetPassword={resetPassword}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      "If an eligible Hansel account exists for that email, we've sent a reset code.",
    );
    expect(screen.getByLabelText('Reset code')).toHaveAttribute(
      'autocomplete',
      'one-time-code',
    );
    fillValid();
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith({
        email: 'owner@example.com',
        code: '123456',
        password: 'Correct horse battery staple!7',
      });
    });
    expect(onReset).toHaveBeenCalledWith('/login');
  });

  it('validates every field before submission', async () => {
    const resetPassword = vi.fn();
    render(
      <ResetPassword requestRecovery={vi.fn()} resetPassword={resetPassword} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeVisible();
    expect(screen.getByText('Enter the six-digit reset code.')).toBeVisible();
    expect(screen.getByText('Use at least 15 characters.')).toBeVisible();
    expect(resetPassword).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Reset code'), {
      target: { value: '123456' },
    });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'correct horse battery staple!7' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'different' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(
      await screen.findByText(
        'Include an uppercase letter, lowercase letter, number, and special character.',
      ),
    ).toBeVisible();
    expect(screen.getByText('Passwords must match.')).toBeVisible();
  });

  it.each([
    [
      new PasswordResetRejectedError(),
      "We couldn't reset your password. Request a new code and try again.",
    ],
    [
      new Error('unavailable'),
      'Password reset is temporarily unavailable. Please try again.',
    ],
  ])('announces the safe reset result', async (failure, message) => {
    render(
      <ResetPassword
        requestRecovery={vi.fn()}
        resetPassword={() => Promise.reject(failure)}
      />,
    );
    fillValid();
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('resends generically using the current normalized email', async () => {
    const requestRecovery = vi.fn().mockResolvedValue({ status: 'accepted' });
    render(
      <ResetPassword
        requestRecovery={requestRecovery}
        resetPassword={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: ' OWNER@Example.com ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request a new code' }));
    await waitFor(() => {
      expect(requestRecovery).toHaveBeenCalledWith({
        email: 'owner@example.com',
      });
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      "If an eligible Hansel account exists for that email, we've sent a reset code.",
    );
  });

  it('validates the resend email without making a request', async () => {
    const requestRecovery = vi.fn();
    render(
      <ResetPassword
        requestRecovery={requestRecovery}
        resetPassword={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Request a new code' }));
    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeVisible();
    expect(requestRecovery).not.toHaveBeenCalled();
  });

  it('notifies navigation so transient recovery state can be cleared', () => {
    const onBackToLogin = vi.fn();
    render(
      <ResetPassword
        onBackToLogin={onBackToLogin}
        requestRecovery={vi.fn()}
        resetPassword={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Back to log in' }));
    expect(onBackToLogin).toHaveBeenCalledOnce();
  });

  it('keeps ordinary link navigation when no client router is supplied', () => {
    render(<ResetPassword requestRecovery={vi.fn()} resetPassword={vi.fn()} />);
    const link = screen.getByRole('link', { name: 'Back to log in' });
    expect(link).toHaveAttribute('href', '/login');
  });

  it('announces a temporarily unavailable resend', async () => {
    render(
      <ResetPassword
        requestRecovery={() => Promise.reject(new Error('unavailable'))}
        resetPassword={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request a new code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password recovery is temporarily unavailable. Please try again.',
    );
  });
});
