import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('App [REQ-002]', () => {
  it('shows only Hansel in the middle of the landing page [REQ-006]', () => {
    render(<App />);
    const main = screen.getByRole('main');
    expect(main).toHaveClass('place-items-center');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Hansel',
    );
    expect(main).toHaveTextContent(/^Hansel$/);
  });

  it('routes the approved onboarding entry to the account form', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<App path="/onboarding" />);
    expect(
      screen.getByRole('heading', { name: "Let's get started" }),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('routes the verification step', () => {
    render(<App path="/onboarding/verify-email" />);
    expect(
      screen.getByRole('heading', { name: 'Verify your email' }),
    ).toBeInTheDocument();
  });

  it('connects verification and resend actions to the configured API', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ nextStep: 'personal-profile' }), {
            status: 200,
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ status: 'accepted' }), { status: 202 }),
        ),
    );
    render(
      <App apiUrl="https://api.example" path="/onboarding/verify-email" />,
    );
    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
    });
    cleanup();
    render(
      <App apiUrl="https://api.example" path="/onboarding/verify-email" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('submits onboarding through the configured API URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ nextStep: 'verify-email' }), {
          status: 202,
        }),
      ),
    );
    render(<App apiUrl="https://api.example" path="/onboarding" />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correct horse battery staple!7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create with email' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.example/api/onboarding/accounts',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('carries the submitted destination into the verification step', async () => {
    window.history.replaceState({}, '', '/onboarding');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ nextStep: 'verify-email' }), {
          status: 202,
        }),
      ),
    );
    render(<App />);
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correct horse battery staple!7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create with email' }));
    expect(
      await screen.findByRole('heading', { name: 'Verify your email' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Resend code in 60s')).toBeInTheDocument();
    window.history.replaceState({}, '', '/');
  });
});
