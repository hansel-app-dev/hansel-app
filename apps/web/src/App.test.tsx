import {
  act,
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
  vi.useRealTimers();
  window.sessionStorage.clear();
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
      screen.getByRole('heading', { name: 'Verify your account' }),
    ).toBeInTheDocument();
  });

  it('routes the personal profile step', () => {
    render(<App path="/onboarding/about-you" />);
    expect(
      screen.getByRole('heading', { name: 'Tell us about you' }),
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
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
    });
    expect(
      await screen.findByRole('heading', { name: 'Tell us about you' }),
    ).toBeInTheDocument();
    cleanup();
    render(
      <App apiUrl="https://api.example" path="/onboarding/verify-email" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Request new code' }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('submits personal details and advances to plan selection', async () => {
    window.history.replaceState({}, '', '/onboarding/about-you');
    document.cookie = 'hansel_onboarding_csrf=csrf-proof';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ nextStep: 'plan-selection' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<App apiUrl="https://api.example" />);
    for (const [label, value] of [
      ['First name', 'Nabin'],
      ['Last name', 'Singh'],
      ['Job title', 'manager'],
      ['Department', 'marketing_communications'],
    ] as const)
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/onboarding/plan-selection');
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/api/onboarding/personal-profile',
      expect.objectContaining({ credentials: 'include' }),
    );
    window.history.replaceState({}, '', '/');
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
      await screen.findByRole('heading', { name: 'Verify your account' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Request new code in 60s')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('hansel.verificationEmail')).toBe(
      'owner@example.com',
    );
    window.history.replaceState({}, '', '/');
  });

  it('resends to the stored destination after a same-tab reload [REQ-084]', async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(
      'hansel.verificationEmail',
      'owner@example.com',
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'accepted' }), { status: 202 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <App apiUrl="https://api.example" path="/onboarding/verify-email" />,
    );
    for (let second = 0; second < 60; second += 1) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Request new code' }));
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example/api/onboarding/email-verification/resend',
        expect.objectContaining({
          body: JSON.stringify({ email: 'owner@example.com' }),
        }),
      );
    });
  });
});
