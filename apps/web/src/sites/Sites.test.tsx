import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sites } from './Sites.js';

afterEach(cleanup);

const viewer = {
  viewer: {
    displayName: 'Nabin Singh',
    initials: 'NS',
    roleLabel: 'Owner',
  },
};

describe('Sites empty state [sites-empty-state REQ-001..REQ-013]', () => {
  it('renders the authenticated Figma empty state without invented site behavior', async () => {
    render(
      <Sites
        loadDashboard={() => Promise.resolve(viewer)}
        logout={() => Promise.resolve()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Sites', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'No sites', level: 2 }),
    ).toBeVisible();
    expect(screen.getByText('Create a new site to get started.')).toBeVisible();
    expect(await screen.findByText('Nabin Singh')).toBeVisible();

    const navigation = within(screen.getByRole('navigation'));
    expect(navigation.getByRole('link', { name: 'Sites' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      navigation.getByRole('link', { name: 'Dashboard' }),
    ).not.toHaveAttribute('aria-current');

    const newSiteActions = screen.getAllByRole('button', {
      name: 'New site',
    });
    expect(newSiteActions).toHaveLength(2);
    for (const action of newSiteActions) {
      expect(action).toHaveAttribute('aria-disabled', 'true');
      expect(action).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: 'Grid view' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'List view' })).toBeDisabled();

    const preventDocumentNavigation = vi.fn((event: MouseEvent) => {
      event.preventDefault();
    });
    document.addEventListener('click', preventDocumentNavigation);
    fireEvent.click(navigation.getByRole('link', { name: 'Sites' }));
    document.removeEventListener('click', preventDocumentNavigation);
    expect(preventDocumentNavigation).toHaveBeenCalledOnce();
  });

  it('uses the shared navigation without a document reload', async () => {
    const navigate = vi.fn();
    render(
      <Sites
        loadDashboard={() => Promise.resolve(viewer)}
        logout={() => Promise.resolve()}
        navigate={navigate}
      />,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(navigate).toHaveBeenCalledWith('/dashboard');
    await screen.findByText('Nabin Singh');
  });

  it('offers the shared retry state after a recoverable viewer failure', async () => {
    let attempts = 0;
    render(
      <Sites
        loadDashboard={() => {
          attempts += 1;
          return attempts === 1
            ? Promise.reject(new Error('unavailable'))
            : Promise.resolve(viewer);
        }}
        logout={() => Promise.resolve()}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't load your account. Please try again.",
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Nabin Singh')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
