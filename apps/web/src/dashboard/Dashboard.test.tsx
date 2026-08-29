import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Dashboard } from './Dashboard.js';

afterEach(cleanup);

describe('Dashboard [dashboard-home REQ-001..REQ-017]', () => {
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
    for (const label of ['Sites', 'Styleguide', 'Documents']) {
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
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
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
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't load your dashboard. Please try again.",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Nabin Singh')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
