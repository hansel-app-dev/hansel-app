import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { maskEmail, VerifyEmail } from './VerifyEmail.js';

afterEach(cleanup);

describe('VerifyEmail [REQ-006, REQ-007, REQ-084]', () => {
  it('uses the approved Figma verify-account wording', () => {
    render(
      <VerifyEmail
        email="owner@example.com"
        verify={vi.fn()}
        resend={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Verify your account.' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Thanks for signing up!/)).toHaveTextContent(
      'The code will expire in 15 minutes for your security.',
    );
    expect(
      screen.getByRole('button', { name: 'Verify account' }),
    ).toBeInTheDocument();
  });

  it('masks the destination and validates six digits before submission', async () => {
    const verify = vi.fn();
    render(
      <VerifyEmail
        email="owner@example.com"
        verify={verify}
        resend={vi.fn()}
      />,
    );
    expect(screen.getByText(/o\*+@example.com/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify account' }));
    expect(await screen.findByText('Enter all six digits')).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });

  it('submits deliberately and continues after success', async () => {
    const verify = vi.fn().mockResolvedValue(undefined);
    const onVerified = vi.fn();
    render(
      <VerifyEmail
        email="owner@example.com"
        verify={verify}
        resend={vi.fn()}
        onVerified={onVerified}
      />,
    );
    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '012345' },
    });
    expect(verify).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Verify account' }));
    await waitFor(() => {
      expect(onVerified).toHaveBeenCalledOnce();
    });
  });

  it('shows the same recoverable error for a rejected code', async () => {
    render(
      <VerifyEmail
        email="owner@example.com"
        verify={vi.fn().mockRejectedValue(new Error())}
        resend={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not be verified',
    );
  });

  it('reveals resend only when available and reports generic acceptance', async () => {
    const resend = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <VerifyEmail
        email="owner@example.com"
        verify={vi.fn()}
        resend={resend}
      />,
    );
    expect(screen.getByText('Resend code in 60s')).toBeInTheDocument();
    rerender(
      <VerifyEmail
        email="owner@example.com"
        verify={vi.fn()}
        resend={resend}
        resendAvailableInSeconds={0}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    expect(await screen.findByText(/address is eligible/)).toBeInTheDocument();
  });

  it('reports resend transport failure generically', async () => {
    render(
      <VerifyEmail
        email="owner@example.com"
        verify={vi.fn()}
        resend={vi.fn().mockRejectedValue(new Error())}
        resendAvailableInSeconds={0}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not send',
    );
  });

  it('masks short and malformed local parts safely', () => {
    expect(maskEmail('a@example.com')).toBe('a**@example.com');
    expect(maskEmail('')).toBe('**@');
  });

  it('counts down until resend becomes available', () => {
    vi.useFakeTimers();
    render(
      <VerifyEmail
        email="owner@example.com"
        verify={vi.fn()}
        resend={vi.fn()}
        resendAvailableInSeconds={1}
      />,
    );
    expect(screen.getByText('Resend code in 1s')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(
      screen.getByRole('button', { name: 'Resend code' }),
    ).toBeInTheDocument();
    vi.useRealTimers();
  });
});
