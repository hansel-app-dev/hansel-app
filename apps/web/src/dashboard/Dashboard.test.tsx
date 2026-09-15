import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard.js';

afterEach(cleanup);

describe('Dashboard [dashboard-home REQ-001..REQ-017]', () => {
  it('opens the Organization tray and Account settings with unavailable actions disabled [organization-tray-settings REQ-001..REQ-011]', async () => {
    render(
      <Dashboard
        loadDashboard={() =>
          Promise.resolve({
            viewer: {
              displayName: 'John Smith',
              initials: 'JS',
              roleLabel: 'Owner',
              email: 'john@example.com',
            },
            organization: {
              name: 'Workspace Name',
              planDisplayName: 'Pro Plan',
            },
          })
        }
        logout={() => Promise.resolve()}
      />,
    );

    const trigger = await screen.findByRole('button', {
      name: 'Open Organization menu',
    });
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu', { name: 'Organization' });
    expect(within(menu).getByText('Pro Plan')).toBeVisible();
    expect(
      within(menu).getByRole('menuitem', { name: 'Invite members' }),
    ).toBeDisabled();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Settings' }));

    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(dialog).getByText('john@example.com')).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Manage email' }),
    ).toBeDisabled();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Close settings' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('hides Organization management from Viewers [organization-tray-settings REQ-004]', async () => {
    render(
      <Dashboard
        loadDashboard={() =>
          Promise.resolve({
            viewer: {
              displayName: 'Vera Viewer',
              initials: 'VV',
              roleLabel: 'Viewer',
              email: 'vera@example.com',
            },
            organization: {
              name: 'Workspace Name',
              planDisplayName: 'Free Plan',
            },
          })
        }
        logout={() => Promise.resolve()}
      />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Open Organization menu' }),
    );
    expect(
      screen.queryByRole('menuitem', { name: 'Settings' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Invite members' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toHaveFocus();
  });

  it('opens the signed-in account menu and restores focus on Escape [dashboard-logout REQ-001..REQ-003]', async () => {
    render(
      <Dashboard
        loadDashboard={() =>
          Promise.resolve({
            viewer: {
              displayName: 'Nabin Singh',
              initials: 'NS',
              roleLabel: 'Owner',
            },
          })
        }
        logout={() => Promise.resolve()}
      />,
    );

    const account = await screen.findByRole('button', {
      name: 'Nabin Singh, Owner',
    });
    fireEvent.click(account);
    const logout = screen.getByRole('menuitem', { name: 'Log out' });
    expect(logout).toHaveFocus();
    expect(account).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByRole('menu')).toBeVisible();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(account).toHaveFocus();
    expect(account).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders the authenticated Figma shell without fake functionality', async () => {
    render(
      <Dashboard
        loadDashboard={() =>
          Promise.resolve({
            viewer: {
              displayName: 'Nabin Singh',
              initials: 'NS',
              roleLabel: 'Owner',
            },
          })
        }
        logout={() => Promise.resolve()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Dashboard', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Hansel Beta' })).toHaveAttribute(
      'src',
      '/assets/hansel-logo-beta.svg',
    );
    const navigation = within(screen.getByRole('navigation'));
    expect(navigation.getByText('Dashboard')).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(navigation.getByRole('link', { name: 'Sites' })).toHaveAttribute(
      'href',
      '/sites',
    );
    for (const label of ['Styleguide', 'Documents']) {
      expect(navigation.getByText(label)).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    }
    expect(navigation.getByText('Libraries')).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { name: 'Widget title', level: 2 }),
    ).toHaveLength(4);
    expect(await screen.findByText('Nabin Singh')).toBeVisible();
    expect(screen.getByText('Owner')).toBeVisible();
    expect(screen.getByText('NS')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Nabin Singh, Owner' }),
    ).toBeVisible();
  });

  it('offers a retry without showing stale identity after a recoverable failure', async () => {
    let attempts = 0;
    render(
      <Dashboard
        loadDashboard={() => {
          attempts += 1;
          return attempts === 1
            ? Promise.reject(new Error('unavailable'))
            : Promise.resolve({
                viewer: {
                  displayName: 'Nabin Singh',
                  initials: 'NS',
                  roleLabel: 'Owner',
                },
              });
        }}
        logout={() => Promise.resolve()}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't load your dashboard. Please try again.",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Nabin Singh')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('prevents duplicate logout and closes after success [dashboard-logout REQ-004]', async () => {
    let finishLogout: (() => void) | undefined;
    const logout = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishLogout = resolve;
        }),
    );
    render(
      <Dashboard
        loadDashboard={() =>
          Promise.resolve({
            viewer: {
              displayName: 'Nabin Singh',
              initials: 'NS',
              roleLabel: 'Owner',
            },
          })
        }
        logout={logout}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Nabin Singh, Owner' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    const pending = screen.getByRole('menuitem', { name: 'Logging out…' });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(logout).toHaveBeenCalledOnce();

    act(() => {
      finishLogout?.();
    });
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('keeps a failed logout open for retry and closes on outside click or toggle [dashboard-logout REQ-002, REQ-010]', async () => {
    const logout = vi
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(undefined);
    render(
      <Dashboard
        loadDashboard={() =>
          Promise.resolve({
            viewer: {
              displayName: 'Nabin Singh',
              initials: 'NS',
              roleLabel: 'Owner',
            },
          })
        }
        logout={logout}
      />,
    );

    const account = await screen.findByRole('button', {
      name: 'Nabin Singh, Owner',
    });
    fireEvent.click(account);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't log you out. Please try again.",
    );
    expect(screen.getByRole('menu')).toBeVisible();

    fireEvent.click(account);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(account);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(account);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
    expect(logout).toHaveBeenCalledTimes(2);
  });

  it('reopens a pending menu when logout later fails [dashboard-logout REQ-010]', async () => {
    let rejectLogout: ((error: Error) => void) | undefined;
    render(
      <Dashboard
        loadDashboard={() =>
          Promise.resolve({
            viewer: {
              displayName: 'Nabin Singh',
              initials: 'NS',
              roleLabel: 'Owner',
            },
          })
        }
        logout={() =>
          new Promise<void>((_resolve, reject) => {
            rejectLogout = reject;
          })
        }
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Nabin Singh, Owner' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    act(() => {
      rejectLogout?.(new Error('unavailable'));
    });
    expect(await screen.findByRole('menu')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't log you out. Please try again.",
    );
  });
});
