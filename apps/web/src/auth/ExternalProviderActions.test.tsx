import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExternalProviderActions } from './ExternalProviderActions.js';

describe('External provider actions [google-local-auth REQ-001, REQ-003]', () => {
  it('leaves providers disabled for unsuccessful capability responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<ExternalProviderActions intent="login" />);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    expect(
      screen.getByRole('button', { name: 'Continue with Google' }),
    ).toBeDisabled();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it('disables unavailable providers and exposes a native Google login link', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ providers: ['google'] }),
      }),
    );
    render(<ExternalProviderActions intent="login" />);
    expect(
      await screen.findByRole('link', { name: 'Continue with Google' }),
    ).toHaveAttribute('href', '/auth/start/google?intent=login');
    expect(
      screen.getByRole('button', { name: 'Continue with Apple' }),
    ).toBeDisabled();
  });
  it('posts explicit consent for onboarding and fails closed on capability failure', async () => {
    const { unmount } = render(
      <ExternalProviderActions
        intent="onboarding"
        availableProviders={['google']}
      />,
    );
    const button = screen.getByRole('button', { name: 'Continue with Google' });
    expect(button.closest('form')).toHaveAttribute('method', 'post');
    expect(button.closest('form')).toHaveAttribute(
      'action',
      '/auth/start/google',
    );
    expect(
      button.closest('form')?.querySelector('[name="acceptsTerms"]'),
    ).toHaveValue('true');
    unmount();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<ExternalProviderActions intent="login" />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Continue with Google' }),
      ).toBeDisabled(),
    );
  });
});
