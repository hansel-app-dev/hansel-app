import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Login } from './Login.js';
import { LoginAuthenticationError } from '../api.js';

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/login');
});

describe('Login [user-login REQ-001..REQ-003, REQ-008, REQ-019]', () => {
  it('shows only the generic result after a rejected provider callback', () => {
    window.history.replaceState({}, '', '/login?error=authentication_failed');
    render(<Login login={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't log you in. Check your details and try again.",
    );
    expect(screen.queryByText('authentication_failed')).not.toBeInTheDocument();
  });

  it('shows a safe temporary error after an unavailable provider callback', () => {
    window.history.replaceState({}, '', '/login?error=provider_unavailable');
    render(<Login login={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Login is temporarily unavailable. Please try again.',
    );
  });

  it('catches empty fields before submission', async () => {
    const login = vi.fn();
    render(<Login login={login} />);
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeVisible();
    expect(screen.getByText('Enter your password.')).toBeVisible();
    expect(login).not.toHaveBeenCalled();
  });

  it('renders the approved login copy and submits normalized credentials', async () => {
    const login = vi.fn().mockResolvedValue({ destination: '/dashboard' });
    const onLoggedIn = vi.fn();
    render(<Login login={login} onLoggedIn={onLoggedIn} />);

    expect(
      screen.getByRole('heading', { name: 'Log in to your account' }),
    ).toBeVisible();
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'placeholder',
      'your@email.com',
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    for (const provider of ['Google', 'Microsoft', 'Apple']) {
      const providerLink = screen.getByRole('link', {
        name: `Continue with ${provider}`,
      });
      expect(providerLink).toHaveAttribute(
        'href',
        `/auth/start/${provider.toLowerCase()}?intent=login`,
      );
      expect(providerLink.querySelector('img')).toHaveAttribute(
        'src',
        `/assets/${provider.toLowerCase()}-logo.svg`,
      );
    }
    expect(
      screen.getByTestId('auth-provider-divider').querySelector('img'),
    ).toHaveAttribute('src', '/assets/login-provider-divider.svg');
    expect(
      screen.queryByText(/By creating an account/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Create an account' }),
    ).toHaveAttribute('href', '/onboarding');
    expect(
      screen.getByRole('link', { name: 'Forgot password?' }),
    ).toHaveAttribute('href', '/forgot-password');

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: '  OWNER@Example.com ' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correct horse battery staple!7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'owner@example.com',
        password: 'Correct horse battery staple!7',
      });
    });
    expect(onLoggedIn).toHaveBeenCalledWith('/dashboard', 'owner@example.com');
  });

  it('announces a completed password reset without exposing the query value', () => {
    window.history.replaceState({}, '', '/login?password_reset=success');
    render(<Login login={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your password has been reset. Log in with your new password.',
    );
    expect(screen.queryByText('success')).not.toBeInTheDocument();
  });

  it.each([
    [
      new LoginAuthenticationError(),
      "We couldn't log you in. Check your details and try again.",
    ],
    [
      new Error('unavailable'),
      'Login is temporarily unavailable. Please try again.',
    ],
  ])('announces the safe server failure', async (failure, message) => {
    const view = render(<Login login={() => Promise.reject(failure)} />);
    fireEvent.change(view.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(view.getByLabelText('Password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(view.getByRole('button', { name: 'Log in' }));
    expect(await view.findByRole('alert')).toHaveTextContent(message);
  });
});
