import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnboardingStart } from './OnboardingStart.js';

afterEach(cleanup);

describe('OnboardingStart [REQ-005, REQ-016, REQ-023, REQ-049, REQ-056]', () => {
  it('explains the verified-email fallback [google-local-auth REQ-004]', () => {
    window.history.replaceState(
      null,
      '',
      '/onboarding?error=google_email_required',
    );
    try {
      render(<OnboardingStart createAccount={vi.fn()} />);
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Google didn’t provide a verified email',
      );
      expect(
        screen.getByRole('button', { name: 'Create with email' }),
      ).toBeEnabled();
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });
  it('renders the approved account choices and catches empty fields', async () => {
    const createAccount = vi.fn();
    render(<OnboardingStart createAccount={createAccount} />);

    expect(
      screen.getByRole('heading', { name: "Let's get started" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Hansel home' }).querySelector('img'),
    ).toHaveAttribute('src', '/assets/hansel-logo-beta.svg');
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'placeholder',
      'you@gmail.com',
    );
    expect(screen.getByLabelText('Password')).not.toHaveAccessibleDescription();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    for (const name of ['Terms of Service', 'Privacy Policy', 'Log in']) {
      expect(screen.getByRole('link', { name })).toHaveClass('underline');
    }
    expect(
      screen.getByRole('button', { name: 'Continue with Google' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continue with Microsoft' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continue with Apple' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create with email' }));

    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Use at least 15 characters.')).toBeInTheDocument();
    expect(createAccount).not.toHaveBeenCalled();
  });

  it('submits accepted values and advances after the server accepts them', async () => {
    const createAccount = vi
      .fn()
      .mockResolvedValue({ nextStep: 'verify-email' });
    const onCreated = vi.fn();
    render(
      <OnboardingStart createAccount={createAccount} onCreated={onCreated} />,
    );

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correct horse battery staple!7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create with email' }));

    await waitFor(() => {
      expect(createAccount).toHaveBeenCalledWith({
        email: 'owner@example.com',
        password: 'Correct horse battery staple!7',
        acceptsTerms: true,
        termsVersion: '2026-08-27',
        privacyVersion: '2026-08-27',
      });
    });
    expect(onCreated).toHaveBeenCalledWith('owner@example.com', 'verify-email');
  });

  it('rejects passwords over 128 Unicode characters', async () => {
    const createAccount = vi.fn();
    render(<OnboardingStart createAccount={createAccount} />);

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: '😀'.repeat(129) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create with email' }));

    expect(
      await screen.findByText('Use no more than 128 characters.'),
    ).toBeInTheDocument();
    expect(createAccount).not.toHaveBeenCalled();
  });

  it.each([
    ['uppercase letter', 'correct horse battery staple!7'],
    ['lowercase letter', 'CORRECT HORSE BATTERY STAPLE!7'],
    ['number', 'Correct horse battery staple!'],
    ['special character', 'Correct horse battery staple 7'],
  ])('rejects a password without a %s', async (_rule, password) => {
    const createAccount = vi.fn();
    render(<OnboardingStart createAccount={createAccount} />);

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: password },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create with email' }));

    expect(
      await screen.findByText(
        'Include an uppercase letter, lowercase letter, number, and special character.',
      ),
    ).toBeInTheDocument();
    expect(createAccount).not.toHaveBeenCalled();
  });
});
