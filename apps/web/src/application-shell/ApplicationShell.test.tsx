import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ApplicationShell } from './ApplicationShell.js';
const viewer = {
  displayName: 'Owner',
  initials: 'O',
  roleLabel: 'Owner' as const,
};
afterEach(cleanup);
it('retries logout failure and renders account settings without optional viewer metadata', async () => {
  const logout = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(undefined);
  render(
    <ApplicationShell
      activePage="Sites"
      headerActions={null}
      headerLeading={<span>Site</span>}
      loadDashboard={vi.fn()}
      loadErrorMessage="Unavailable"
      logout={logout}
      preloadedDashboard={{
        viewer,
        organization: { name: 'Workspace', planDisplayName: 'Free Plan' },
      }}
    >
      <p>Content</p>
    </ApplicationShell>,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Open Organization menu' }),
  );
  fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
  await waitFor(() => {
    expect(screen.queryByRole('menu')).toBeNull();
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Open Organization menu' }),
  );
  fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));
  await screen.findByText('Email unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
});
