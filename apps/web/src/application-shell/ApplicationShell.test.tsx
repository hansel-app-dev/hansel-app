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

it('uses the designed custom tooltip for nested site names', () => {
  render(
    <ApplicationShell
      activePage="Sites"
      headerActions={null}
      headerLeading={null}
      loadDashboard={vi.fn()}
      loadErrorMessage="Unavailable"
      logout={vi.fn()}
      preloadedDashboard={{
        viewer,
        organization: { name: 'Workspace', planDisplayName: 'Free Plan' },
      }}
      siteNavigation={[{ id: 'site-1', name: 'Westlake Campus – Building A' }]}
    >
      <p>Content</p>
    </ApplicationShell>,
  );

  const siteLink = screen.getByRole('link', {
    name: 'Westlake Campus – Building A',
  });
  fireEvent.mouseEnter(siteLink);
  expect(screen.queryByTitle('Westlake Campus – Building A')).toBeNull();
  expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent(
    'Westlake Campus – Building A',
  );
});

it('shows only the first five sites in the sidebar', () => {
  render(
    <ApplicationShell
      activePage="Sites"
      headerActions={null}
      headerLeading={null}
      loadDashboard={vi.fn()}
      loadErrorMessage="Unavailable"
      logout={vi.fn()}
      preloadedDashboard={{
        viewer,
        organization: { name: 'Workspace', planDisplayName: 'Free Plan' },
      }}
      siteNavigation={Array.from({ length: 6 }, (_, index) => ({
        id: `site-${String(index + 1)}`,
        name: `Site ${String(index + 1)}`,
      }))}
    >
      <p>Content</p>
    </ApplicationShell>,
  );

  expect(screen.getByRole('link', { name: 'Site 5' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Site 6' })).toBeNull();
});

it('shows the My Sites count in both active and inactive states', () => {
  const props = {
    headerActions: null,
    loadDashboard: vi.fn(),
    loadErrorMessage: 'Unavailable',
    logout: vi.fn(),
    preloadedDashboard: {
      viewer,
      organization: { name: 'Workspace', planDisplayName: 'Free Plan' },
    },
    siteNavigation: [
      { id: 'site-1', name: 'First site' },
      { id: 'site-2', name: 'Second site' },
    ],
  } as const;

  const { rerender } = render(
    <ApplicationShell {...props} activePage="Dashboard">
      <p>Content</p>
    </ApplicationShell>,
  );
  expect(screen.getByRole('link', { name: 'My Sites 2' })).toBeInTheDocument();

  rerender(
    <ApplicationShell {...props} activePage="Sites">
      <p>Content</p>
    </ApplicationShell>,
  );
  expect(screen.getByRole('link', { name: 'My Sites 2' })).toBeInTheDocument();
});

it('shows the dashboard site count without a loaded site list', () => {
  render(
    <ApplicationShell
      activePage="Dashboard"
      headerActions={null}
      loadDashboard={vi.fn()}
      loadErrorMessage="Unavailable"
      logout={vi.fn()}
      siteCount={3}
      preloadedDashboard={{ viewer }}
    >
      <p>Content</p>
    </ApplicationShell>,
  );
  expect(screen.getByRole('link', { name: 'My Sites 3' })).toBeInTheDocument();
});

it('shows the New site action on a selected-site sidebar', () => {
  const navigate = vi.fn();
  render(
    <ApplicationShell
      activePage="Sites"
      headerActions={null}
      headerLeading={null}
      loadDashboard={vi.fn()}
      loadErrorMessage="Unavailable"
      logout={vi.fn()}
      navigate={navigate}
      preloadedDashboard={{
        viewer,
        organization: { name: 'Workspace', planDisplayName: 'Free Plan' },
      }}
      siteNavigation={[{ id: 'site-1', name: 'Selected site' }]}
    >
      <p>Content</p>
    </ApplicationShell>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'New site' }));
  expect(navigate).toHaveBeenCalledWith('/sites');
});

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
