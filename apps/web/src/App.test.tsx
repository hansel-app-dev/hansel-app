import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('App [REQ-002]', () => {
  it('shows healthy API status', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
        ),
    );
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('API checking');
    expect(await screen.findByRole('status')).toHaveTextContent('API healthy');
    expect(fetch).toHaveBeenCalledWith('/health');
  });

  it('shows unavailable status and does not update after unmount', async () => {
    let rejectRequest: (reason: Error) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((_resolve, reject) => {
            rejectRequest = reject;
          }),
      ),
    );
    const view = render(<App apiUrl="" />);
    view.unmount();
    rejectRequest(new Error('offline'));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
    });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<App apiUrl="" />);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'API unavailable',
    );
  });
});
